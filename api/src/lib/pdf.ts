import { chromium, type Browser } from "playwright";
import { HttpError } from "./http";

/**
 * HTML -> PDF con Chromium (Playwright).
 *
 * - UN navegador reutilizado (arrancarlo cuesta ~1 s); un CONTEXTO nuevo por petición
 *   (aislado: sin cookies/estado compartido) que se cierra siempre (finally).
 * - Sin JavaScript (`javaScriptEnabled: false`) y sin red (toda petición se aborta):
 *   aunque algo se colara en el HTML, no puede ejecutar ni llamar a nada.
 * - Timeout por petición y máximo de PDFs simultáneos (cada página consume memoria).
 */
const g = globalThis as unknown as { browser?: Promise<Browser> };

function getBrowser(): Promise<Browser> {
  if (!g.browser) {
    // Guardamos la PROMESA (no el Browser): si llegan 5 peticiones a la vez mientras
    // arranca, todas esperan al mismo arranque en vez de lanzar 5 navegadores.
    g.browser = chromium.launch({ args: ["--disable-dev-shm-usage"] });
    g.browser.then(
      (b) => b.on("disconnected", () => (g.browser = undefined)), // se cayó -> relanzar la próxima vez
      () => (g.browser = undefined), // no arrancó -> reintentar la próxima vez
    );
  }
  return g.browser;
}

// Semáforo mínimo: como mucho MAX_CONCURRENT PDFs a la vez; el resto espera en cola.
const MAX_CONCURRENT = 3;
let running = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

export function htmlToPdf(html: string, timeoutMs = 20_000): Promise<Buffer> {
  return withSlot(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      await page.route("**/*", (route) => route.abort("blockedbyclient")); // sin red
      await page.setContent(html, { waitUntil: "load" });
      return await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") throw new HttpError(504, "El PDF tardó demasiado");
      throw e;
    } finally {
      await context.close();
    }
  });
}
