chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_SCAN_DATA') {
    const { token, scanId } = request;
    
    if (token && scanId) {
      chrome.storage.local.set({
        apiToken: token,
        scanId: scanId
      }, () => {
        console.log('Sin Barreras: Datos de escaneo recibidos exitosamente.');
        sendResponse({ success: true });
      });
      return true; // Indicates we will send response asynchronously
    } else {
      sendResponse({ success: false, error: 'Datos incompletos' });
    }
  }
});
