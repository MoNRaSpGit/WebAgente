const STORAGE_KEY = 'webagente:session';

export function loadWebSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);

    if (!data?.token || !data?.user) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function saveWebSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearWebSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
