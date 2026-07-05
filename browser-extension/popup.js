// La URL base se lee del manifest para que cambiar de host no requiera publicar
// una nueva versión de la extensión — solo actualizar host_permissions en manifest.json.
const getApiBase = () => {
  const hosts = chrome.runtime.getManifest().host_permissions || [];
  // Usa el primer host que no sea localhost ni 127.0.0.1
  const prodHost = hosts.find(h => !h.includes('localhost') && !h.includes('127.0.0.1'));
  return prodHost ? prodHost.replace(/\/\*$/, '') : 'https://sinbarreras.gzakgroup.com';
};
const API_BASE = getApiBase();

const apiTokenInput = document.getElementById('api-token');
const scanIdInput = document.getElementById('scan-id');
const runButton = document.getElementById('run-audit');
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
  await chrome.storage.local.remove(['apiToken', 'scanId', 'targetUrl']);
  apiTokenInput.value = '';
  scanIdInput.value = '';
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

const runAudit = async () => {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    setStatus('No se pudo detectar la pestaña activa.', 'error');
    return;
  }

  if (!apiTokenInput.value.trim() || !scanIdInput.value.trim()) {
    setStatus('Completa API, token e ID del escaneo antes de continuar.', 'error');
    return;
  }

  runButton.disabled = true;
  setStatus('Analizando DOM autenticado de la pestaña actual...');

  try {
    await saveSettings();
    await injectAuditScripts(tab.id);
    const audit = await collectAudit(tab.id);
    if (!audit) throw new Error('La página no devolvió resultados de auditoría.');

    const screenshot = await captureVisibleScreenshot();
    const auditWithScreenshot = attachScreenshot(audit, screenshot);
    setStatus('Enviando resultados al sistema...');
    try {
      await postAudit(auditWithScreenshot);
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 413')) {
        setStatus('La captura visual era muy pesada. Reintentando sin imagen...');
        await postAudit(removeScreenshot(auditWithScreenshot));
      } else {
        throw error;
      }
    }
    await clearScanSession();
    const engineStatuses = audit.engineStatuses || [];
    const ibmEngine = engineStatuses.find((e) => e.engine === 'ibm-equal-access-extension');
    const ibmWarning = ibmEngine && (ibmEngine.status === 'not_available' || ibmEngine.status === 'failed')
      ? ' (Motor IBM Equal Access no disponible — algunos hallazgos de teclado y ARIA pueden estar incompletos.)'
      : '';
    setStatus(
      `Listo. Score ${audit.score}/100. La sesión de este escaneo fue cerrada y no puede reutilizarse.${ibmWarning}`,
      ibmWarning ? 'warning' : 'success'
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Ocurrió un error durante la auditoría.', 'error');
  } finally {
    runButton.disabled = false;
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
});

runButton.addEventListener('click', runAudit);
[apiTokenInput, scanIdInput].forEach((input) => input.addEventListener('change', saveSettings));
