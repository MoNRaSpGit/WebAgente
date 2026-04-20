import { fetchApi, parseJson } from './apiClient.js';

let lastHealthProbeAt = 0;
let lastHealthProbeOk = false;

async function ensureApiReady() {
  const now = Date.now();
  if (lastHealthProbeOk && now - lastHealthProbeAt < 5000) {
    return;
  }

  let response;
  try {
    response = await fetchApi('/api/health');
  } catch {
    throw new Error('No se pudo conectar con BackAgente. Verifica que el backend este iniciado.');
  }

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error('BackAgente no responde correctamente. Reintenta en unos segundos.');
  }

  if (data?.database === false) {
    throw new Error('BackAgente iniciando base de datos. Reintenta en unos segundos.');
  }

  lastHealthProbeAt = now;
  lastHealthProbeOk = true;
}

function mapWebAuthError(response, data, fallbackMessage) {
  if (response.status === 401) {
    return 'Credenciales invalidas.';
  }

  if (response.status === 429) {
    return data.message || 'Demasiados intentos. Espera unos minutos e intenta nuevamente.';
  }

  if (response.status >= 500) {
    return 'Error temporal del servidor. Reintenta en unos segundos.';
  }

  return data.message || fallbackMessage;
}

export async function registerWebUser(payload) {
  await ensureApiReady();

  const response = await fetchApi('/api/web/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(mapWebAuthError(response, data, 'No se pudo registrar'));
  }

  return data;
}

export async function loginWebUser(payload) {
  await ensureApiReady();

  const response = await fetchApi('/api/web/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(mapWebAuthError(response, data, 'No se pudo iniciar sesion'));
  }

  return data;
}

export async function fetchWebProfile(token) {
  const response = await fetchApi('/api/web/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo validar la sesion');
  }

  return data;
}
