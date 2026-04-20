const REMEMBER_KEY = 'webagente:remembered-credentials';
const REMEMBER_PREF_KEY = 'webagente:remember-enabled';

export function setRememberPreference(enabled) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(REMEMBER_PREF_KEY, enabled ? '1' : '0');
}

export function getRememberPreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(REMEMBER_PREF_KEY) === '1';
}

export function loadRememberedCredentials() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!getRememberPreference()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);

    if (!data?.nombre || !data?.password) {
      return null;
    }

    return {
      nombre: String(data.nombre),
      password: String(data.password)
    };
  } catch {
    return null;
  }
}

export function saveRememberedCredentials({ nombre, password }) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    nombre: String(nombre || '').trim(),
    password: String(password || '')
  };

  window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(payload));
}

export function clearRememberedCredentials() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(REMEMBER_KEY);
}
