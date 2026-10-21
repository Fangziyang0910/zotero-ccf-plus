/** Bounded requests shared by manual and automatic lookups. */
const controllers = new Set<AbortController>();
let stopped = false;
let semanticQueue: Promise<unknown> = Promise.resolve();
let nextSemanticRequest = 0;
let semanticCooldown = 0;

export class LookupError extends Error {
  constructor(public status: number | string) {
    super(`Lookup failed: ${status}`);
  }
}

export function stopRequests() {
  stopped = true;
  for (const controller of controllers) controller.abort();
}

async function fetchJSON(url: string): Promise<any> {
  if (stopped) throw new LookupError("Cancelled");
  // Zotero's plugin sandbox exposes fetch, but not AbortController on all supported versions.
  type ControllerConstructor = new () => AbortController;
  const Controller: ControllerConstructor =
    typeof AbortController === "undefined"
      ? (
          Zotero.getMainWindow() as unknown as {
            AbortController: ControllerConstructor;
          }
        ).AbortController
      : AbortController;
  const controller = new Controller();
  controllers.add(controller);
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status === 429 && url.includes("api.semanticscholar.org/")) {
        const retryAfter = response.headers?.get("Retry-After");
        const seconds = Number(retryAfter);
        const retryAt =
          retryAfter && !Number.isFinite(seconds)
            ? Date.parse(retryAfter)
            : Date.now() + (seconds || 30) * 1000;
        semanticCooldown = Math.max(Date.now() + 30000, retryAt || 0);
      }
      throw new LookupError(response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
    controllers.delete(controller);
  }
}

export function requestJSON(url: string): Promise<any> {
  if (!url.startsWith("https://api.semanticscholar.org/"))
    return fetchJSON(url);
  const request = semanticQueue.then(async () => {
    if (stopped) throw new LookupError("Cancelled");
    if (Date.now() < semanticCooldown) throw new LookupError(429);
    const wait = nextSemanticRequest - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (stopped) throw new LookupError("Cancelled");
    nextSemanticRequest = Date.now() + 1100;
    return fetchJSON(url);
  });
  semanticQueue = request.catch(() => undefined);
  return request;
}
