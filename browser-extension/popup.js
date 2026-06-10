
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
  await chrome.storage.sync.set({
    apiToken: apiTokenInput.value.trim(),
    scanId: scanIdInput.value.trim(),
  });
};

const loadSettings = async () => {
  const settings = await chrome.storage.sync.get(['apiToken', 'scanId']);
  apiTokenInput.value = settings.apiToken || '';
  scanIdInput.value = settings.scanId || '';
};

const injectAuditScripts = async (tabId) => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['axe.min.js'] });
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
  const apiBase = normalizeApiBase('https://sinbarreras-production.up.railway.app');
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
    setStatus('No se pudo detectar la pestana activa.', 'error');
    return;
  }

  if (!apiTokenInput.value.trim() || !scanIdInput.value.trim()) {
    setStatus('Completa API, token e ID del escaneo antes de continuar.', 'error');
    return;
  }

  runButton.disabled = true;
  setStatus('Analizando DOM autenticado de la pestana actual...');

  try {
    await saveSettings();
    await injectAuditScripts(tab.id);
    const audit = await collectAudit(tab.id);
    if (!audit) throw new Error('La pagina no devolvio resultados de auditoria.');

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
    setStatus(
      `Listo. Score ${audit.score}/100, ${audit.violations.length} hallazgos confirmados y ${audit.manualVerifications.length} revisiones.`,
      'success'
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Ocurrio un error durante la auditoria.', 'error');
  } finally {
    runButton.disabled = false;
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
});

runButton.addEventListener('click', runAudit);
[apiTokenInput, scanIdInput].forEach((input) => input.addEventListener('change', saveSettings));
