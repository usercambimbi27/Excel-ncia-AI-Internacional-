// Test stub for the Vite PWA plugin's virtual module.
// Vitest does not run the PWA plugin, so `virtual:pwa-register` has no real
// implementation there; this keeps src/lib/pwa/register-sw.ts importable in tests.
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

export function registerSW(_options?: RegisterSWOptions): () => Promise<void> {
  return async () => {};
}

export default registerSW;
