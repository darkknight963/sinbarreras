// La URL base se lee del manifest para que cambiar de host no requiera publicar
// una nueva versión de la extensión — solo actualizar host_permissions en manifest.json.
//
// IMPORTANTE: debe apuntar a la raíz del API (Railway), NO al dominio del
// frontend (Vercel). Vercel solo reenvía /api/* hacia Railway (ver
// frontend/vercel.json); cualquier otra ruta como /scans/... la sirve el
// propio Vercel y responde 404 NOT_FOUND. Por eso se prioriza el host de
// Railway explícitamente en vez de tomar "el primero que no sea localhost".
const getApiBase = () => {
  const hosts = chrome.runtime.getManifest().host_permissions || [];
  const apiHost = hosts.find(h => h.includes('api.gzakgroup.com'));
  if (apiHost) return apiHost.replace(/\/\*$/, '');
  const prodHost = hosts.find(h => !h.includes('localhost') && !h.includes('127.0.0.1'));
  return prodHost ? prodHost.replace(/\/\*$/, '') : 'https://api.gzakgroup.com';
};
const API_BASE = getApiBase();

const apiTokenInput = document.getElementById('api-token');
const scanIdInput = document.getElementById('scan-id');
const runButton = document.getElementById('run-audit');
const sendButton = document.getElementById('send-results');
const statusBox = document.getElementById('status');

const setStatus = (message, tone = '') => {
  statusBox.textContent = message;
  statusBox.className = `extension-status ${tone}`.trim();
};

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
};

const normalizeApiBase = (value) => value.replace(/\/+$/, '');

const saveSettings = async () => {
  await chrome.storage.local.set({
    apiToken: apiTokenInput.value.trim(),
    scanId: scanIdInput.value.trim(),
  });
};

const loadSettings = async () => {
  const settings = await chrome.storage.local.get(['apiToken', 'scanId']);
  apiTokenInput.value = settings.apiToken || '';
  scanIdInput.value = settings.scanId || '';
  return settings;
};

const clearScanSession = async () => {
  await chrome.storage.local.remove(['apiToken', 'scanId', 'targetUrl', 'pendingAudit', 'pendingStates', 'pendingScanId']);
  apiTokenInput.value = '';
  scanIdInput.value = '';
};

// --- Acumulación multi-estado -------------------------------------------------
// Patrón de los scanners líderes (axe DevTools User Flow Analysis): el USUARIO
// abre menús/modales y escanea cada estado; la extensión fusiona los hallazgos
// y envía un único resultado al sistema (el backend acepta un solo envío por scan).

const findingKey = (f) => `${f.normalizedRuleId || f.ruleId || ''}|${f.selector || ''}`;

const mergeAudits = (base, next, stateNumber) => {
  const seen = new Set([...(base.violations || []), ...(base.manualVerifications || [])].map(findingKey));
  const label = `Estado ${stateNumber}: ${(next.title || 'sin título').slice(0, 60)}`;
  const tag = (f) => ({ ...f, pageState: 'user_state', pageStateLabel: f.pageStateLabel || label });
  const newViolations = (next.violations || []).filter((f) => !seen.has(findingKey(f))).map(tag);
  const newManuals = (next.manualVerifications || []).filter((f) => !seen.has(findingKey(f))).map(tag);

  const violations = [...(base.violations || []), ...newViolations];
  const manualVerifications = [...(base.manualVerifications || []), ...newManuals];
  const score = Math.min(base.score ?? 100, next.score ?? 100);
  const failedCount = new Set(violations.map((i) => i.wcagCriterion || i.criterion).filter(Boolean)).size;
  const reviewCount = new Set(manualVerifications.map((i) => i.wcagCriterion || i.criterion).filter(Boolean)).size;
  const applicableCount = base.applicability?.summary?.applicableCount ?? 0;

  return {
    ...base,
    score,
    violations,
    manualVerifications,
    applicability: base.applicability
      ? {
          ...base.applicability,
          summary: {
            ...base.applicability.summary,
            failedCount,
            reviewCount,
            passedCount: Math.max(0, applicableCount - failedCount),
            score,
          },
        }
      : base.applicability,
    engineReport: [
      ...(base.engineReport || []),
      ...(next.engineReport || []).map((e) => ({ ...e, pageState: `user_state_${stateNumber}` })),
    ],
  };
};

const loadPendingAudit = async (scanId) => {
  const stored = await chrome.storage.local.get(['pendingAudit', 'pendingStates', 'pendingScanId']);
  if (stored.pendingScanId !== scanId || !stored.pendingAudit) return { audit: null, states: 0 };
  return { audit: stored.pendingAudit, states: stored.pendingStates || 1 };
};

const savePendingAudit = async (scanId, audit, states) => {
  await chrome.storage.local.set({ pendingAudit: audit, pendingStates: states, pendingScanId: scanId });
};

const injectAuditScripts = async (tabId) => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['axe.min.js'] });
  // Locale español: traduce descripciones y mensajes por elemento de axe.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['axe-locale-es.js'] });
  } catch (_) { /* sin locale, axe corre en inglés */ }
  // IBM Equal Access engine — injected best-effort; content-script guards with window.ace check
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['ace.js'] });
  } catch (_) { /* graceful skip if injection fails */ }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] });
};

const collectAudit = async (tabId) => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => window.__sinBarrerasAuditCurrentPage(),
  });
  return result?.result;
};

const captureVisibleScreenshot = async () => {
  try {
    return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 58 });
  } catch {
    return '';
  }
};

const attachScreenshot = (audit, screenshotUrl) => {
  if (!screenshotUrl || !audit?.visualMap?.states?.length) return audit;
  return {
    ...audit,
    visualMap: {
      ...audit.visualMap,
      states: audit.visualMap.states.map((state, index) => index === 0 ? { ...state, screenshotUrl } : state),
    },
    focusTraversal: audit.focusTraversal ? { ...audit.focusTraversal, screenshotUrl } : audit.focusTraversal,
  };
};

const removeScreenshot = (audit) => ({
  ...audit,
  visualMap: audit?.visualMap?.states
    ? {
        ...audit.visualMap,
        states: audit.visualMap.states.map((state) => ({ ...state, screenshotUrl: '' })),
      }
    : audit.visualMap,
  focusTraversal: audit?.focusTraversal ? { ...audit.focusTraversal, screenshotUrl: '' } : audit?.focusTraversal,
});

const postAudit = async (audit) => {
  const apiBase = normalizeApiBase(API_BASE);
  const token = apiTokenInput.value.trim();
  const scanId = scanIdInput.value.trim();

  const response = await fetch(`${apiBase}/scans/${encodeURIComponent(scanId)}/extension-result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(audit),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`HTTP ${response.status}: ${message || 'No se pudo enviar el resultado.'}`);
  }

  return response.json();
};

const scanCurrentState = async () => {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    setStatus('No se pudo detectar la pestaña activa.', 'error');
    return;
  }

  if (!apiTokenInput.value.trim() || !scanIdInput.value.trim()) {
    setStatus('Completa el token y el ID del escaneo antes de continuar.', 'error');
    return;
  }

  runButton.disabled = true;
  sendButton.disabled = true;
  setStatus('Analizando el estado actual de la página...');

  try {
    await saveSettings();
    const scanId = scanIdInput.value.trim();
    await injectAuditScripts(tab.id);
    const audit = await collectAudit(tab.id);
    if (!audit) throw new Error('La página no devolvió resultados de auditoría.');

    const pending = await loadPendingAudit(scanId);
    const states = pending.audit ? pending.states + 1 : 1;
    let merged = pending.audit ? mergeAudits(pending.audit, audit, states) : audit;
    // La captura de evidencia se toma AQUÍ (estado 1), no al enviar: los
    // marcadores visuales se calculan en este momento y si el usuario abre
    // menús o hace scroll antes de enviar, la foto ya no coincidiría.
    if (states === 1) {
      const screenshot = await captureVisibleScreenshot();
      merged = attachScreenshot(merged, screenshot);
    }
    await savePendingAudit(scanId, merged, states);

    const totalFindings = (merged.violations?.length || 0) + (merged.manualVerifications?.length || 0);
    setStatus(
      `${states === 1 ? 'Estado inicial escaneado' : `${states} estados escaneados`} — ${totalFindings} hallazgos acumulados. ` +
      'Abre un menú o modal y escanea de nuevo, o envía los resultados.',
      'success'
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Ocurrió un error durante la auditoría.', 'error');
  } finally {
    runButton.disabled = false;
    await refreshSendButton();
  }
};

const sendResults = async () => {
  const scanId = scanIdInput.value.trim();
  const pending = await loadPendingAudit(scanId);
  if (!pending.audit) {
    setStatus('Primero escanea al menos un estado de la página.', 'error');
    return;
  }

  runButton.disabled = true;
  sendButton.disabled = true;
  setStatus('Enviando resultados al sistema...');

  try {
    // La evidencia visual ya viene adjunta desde el escaneo del estado 1
    // (coincide con el momento en que se calcularon los marcadores).
    try {
      await postAudit(pending.audit);
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 413')) {
        setStatus('La captura visual era muy pesada. Reintentando sin imagen...');
        await postAudit(removeScreenshot(pending.audit));
      } else {
        throw error;
      }
    }
    const score = pending.audit.score;
    await clearScanSession();
    setStatus(
      `Listo. Score ${score}/100 (${pending.states} ${pending.states === 1 ? 'estado' : 'estados'}). La sesión de este escaneo fue cerrada y no puede reutilizarse.`,
      'success'
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'No se pudo enviar el resultado.', 'error');
    sendButton.disabled = false;
  } finally {
    runButton.disabled = false;
  }
};

const refreshSendButton = async () => {
  const pending = await loadPendingAudit(scanIdInput.value.trim());
  sendButton.disabled = !pending.audit;
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  const pending = await loadPendingAudit(scanIdInput.value.trim());
  if (pending.audit) {
    sendButton.disabled = false;
    const totalFindings = (pending.audit.violations?.length || 0) + (pending.audit.manualVerifications?.length || 0);
    setStatus(`${pending.states} ${pending.states === 1 ? 'estado escaneado' : 'estados escaneados'} — ${totalFindings} hallazgos pendientes de envío.`);
  }
});

runButton.addEventListener('click', scanCurrentState);
sendButton.addEventListener('click', sendResults);
[apiTokenInput, scanIdInput].forEach((input) => input.addEventListener('change', saveSettings));
