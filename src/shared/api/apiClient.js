const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const IS_PROD = import.meta.env.PROD;

function isLocalhostHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getApiBaseCandidates() {
  const candidates = [DEFAULT_API_URL];
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  if (!IS_PROD && isLocalhostHost(hostname)) {
    candidates.push('http://localhost:3000');
  }

  return Array.from(new Set(candidates.map((item) => String(item || '').trim()).filter(Boolean)));
}

export async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchApi(path, options = {}) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  const baseUrls = getApiBaseCandidates();
  let firstNotFoundResponse = null;
  let lastNetworkError = null;

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}${normalizedPath}`;
    let response = null;

    try {
      response = await fetch(url, options);
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    if (response.status !== 404) {
      return response;
    }

    if (!firstNotFoundResponse) {
      firstNotFoundResponse = response;
    }
  }

  if (firstNotFoundResponse) {
    return firstNotFoundResponse;
  }

  if (lastNetworkError) {
    throw lastNetworkError;
  }

  throw new Error('No se pudo conectar con la API');
}
