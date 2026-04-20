import { fetchApi, parseJson } from './apiClient.js';

export async function fetchWebProducts({ limit = 50, offset = 0 } = {}) {
  const response = await fetchApi(`/api/web/products?limit=${limit}&offset=${offset}`);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los productos');
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page || {
      offset,
      limit,
      count: Array.isArray(data.items) ? data.items.length : 0,
      has_more: false
    }
  };
}

export async function fetchWebInactiveProducts({ limit = 50, offset = 0 } = {}) {
  let response = await fetchApi(`/api/web/products?status=inactivo&limit=${limit}&offset=${offset}`);
  let data = await parseJson(response);

  if (response.status === 401 || response.status === 404) {
    response = await fetchApi(`/api/web/products/inactive?limit=${limit}&offset=${offset}`);
    data = await parseJson(response);
  }

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los productos inactivos');
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page || {
      offset,
      limit,
      count: Array.isArray(data.items) ? data.items.length : 0,
      has_more: false
    }
  };
}
