const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas, igual que la duración del token de extensión

// Limpia tokens guardados si superaron su TTL (cada 30 minutos).
// Evita que un escaneo fallido deje credenciales en storage indefinidamente.
chrome.alarms.create('cleanupExpiredTokens', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'cleanupExpiredTokens') return;
  chrome.storage.local.get(['scanDataTimestamp'], (result) => {
    if (result.scanDataTimestamp && Date.now() - result.scanDataTimestamp > TOKEN_TTL_MS) {
      chrome.storage.local.remove(['apiToken', 'scanId', 'scanDataTimestamp']);
      console.log('Sin Barreras: Token de escaneo expirado eliminado del storage.');
    }
  });
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_SCAN_DATA') {
    const { token, scanId } = request;

    if (token && scanId) {
      chrome.storage.local.set({
        apiToken: token,
        scanId: scanId,
        scanDataTimestamp: Date.now(), // marca de tiempo para TTL
      }, () => {
        console.log('Sin Barreras: Datos de escaneo recibidos exitosamente.');
        sendResponse({ success: true });
      });
      return true;
    } else {
      sendResponse({ success: false, error: 'Datos incompletos' });
    }
  }
});
