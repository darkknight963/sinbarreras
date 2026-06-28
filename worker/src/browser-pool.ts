import { chromium, Browser } from 'playwright';

// Flags que reducen RAM sin afectar la precisión del escaneo WCAG.
// - process-per-site: agrupa tabs del mismo origen en un solo renderer (menos procesos)
// - in-process-gpu: mueve GPU al thread principal (elimina proceso GPU separado ~50MB)
// - disable-dev-shm-usage: evita crashes en containers con /dev/shm pequeño
// - disable-gpu: sin renderizado visual, la GPU no aporta nada
// Nunca tocar: JS, CSS, imágenes, iframes, fetch — afectan criterios WCAG
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--in-process-gpu',
  '--process-per-site',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
];

class BrowserPool {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    // Si ya hay un launch en curso, esperamos el mismo en lugar de lanzar otro
    if (this.launching) return this.launching;

    this.launching = this.launch();
    try {
      this.browser = await this.launching;
      this.scheduleHealthCheck();
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  private async launch(): Promise<Browser> {
    console.log('[BrowserPool] Lanzando instancia de Chromium...');
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    browser.on('disconnected', () => {
      console.warn('[BrowserPool] Browser desconectado — se relanzará en el próximo scan');
      this.browser = null;
      this.clearHealthCheck();
    });
    console.log('[BrowserPool] Chromium listo');
    return browser;
  }

  // Crea un contexto incógnito aislado para un scan.
  // Cada contexto tiene su propio storage, cookies y caché — equivalente a un browser nuevo
  // pero con costo de kilobytes en lugar de ~150MB.
  async acquireContext(viewport: { width: number; height: number }, userAgent: string) {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ viewport, userAgent });
    return context;
  }

  private scheduleHealthCheck() {
    this.clearHealthCheck();
    // Cada 5 minutos verificamos que el browser sigue respondiendo
    this.healthCheckInterval = setInterval(async () => {
      if (!this.browser?.isConnected()) {
        console.warn('[BrowserPool] Health check: browser no conectado, se limpia referencia');
        this.browser = null;
        this.clearHealthCheck();
        return;
      }
      try {
        // Abrir y cerrar un contexto vacío como ping
        const ctx = await this.browser.newContext();
        await ctx.close();
      } catch {
        console.warn('[BrowserPool] Health check falló — browser será relanzado en el próximo scan');
        this.browser = null;
        this.clearHealthCheck();
      }
    }, 5 * 60 * 1000);
  }

  private clearHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async shutdown() {
    this.clearHealthCheck();
    if (this.browser?.isConnected()) {
      await this.browser.close().catch(() => {});
    }
    this.browser = null;
  }
}

// Singleton — un solo browser para todos los jobs del worker
export const browserPool = new BrowserPool();
