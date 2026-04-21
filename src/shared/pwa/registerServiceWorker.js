export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      await navigator.serviceWorker.register(`${baseUrl}sw.js`);
    } catch {
      // Silent by design: app should continue even if SW fails.
    }
  });
}
