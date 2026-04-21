export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const registration = await navigator.serviceWorker.register(`${baseUrl}sw.js`);
      registration.update().catch(() => undefined);
    } catch {
      // Silent by design: app should continue even if SW fails.
    }
  });
}
