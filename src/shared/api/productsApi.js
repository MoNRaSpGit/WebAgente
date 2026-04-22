import { fetchApi, parseJson } from './apiClient.js';

const DEFAULT_API_BASE = String(import.meta.env.VITE_API_URL || 'http://localhost:3000').trim();

export function buildWebProductImageSrc(productId) {
  const safeId = Number(productId);
  if (!Number.isFinite(safeId) || safeId <= 0) {
    return '';
  }
  return `${DEFAULT_API_BASE}/api/web/products/${safeId}/image`;
}

export async function fetchWebProducts({ limit = 500, offset = 0, category = '' } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const normalizedCategory = String(category || '').trim();
  if (normalizedCategory) {
    params.set('category', normalizedCategory);
  }

  const response = await fetchApi(`/api/web/products?${params.toString()}`);
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

export async function fetchWebInactiveProducts({ limit = 500, offset = 0 } = {}) {
  let response = await fetchApi(`/api/web/products/inactive?limit=${limit}&offset=${offset}`);
  let data = await parseJson(response);

  if (response.status === 401 || response.status === 404) {
    response = await fetchApi(`/api/web/products?status=inactivo&limit=${limit}&offset=${offset}`);
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

export async function fetchWebCategories({ status = 'activo' } = {}) {
  const response = await fetchApi(`/api/web/categories?status=${encodeURIComponent(status)}`);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar las categorias');
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchWebProductImagesBatch(ids = []) {
  const cleanIds = Array.isArray(ids)
    ? [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].slice(0, 40)
    : [];

  if (!cleanIds.length) {
    return [];
  }

  const response = await fetchApi('/api/web/products/images/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: cleanIds })
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar imagenes en batch');
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchWebAdminProductById(token, productId) {
  const response = await fetchApi(`/api/web/admin/products/${Number(productId)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo cargar el producto');
    error.status = response.status;
    throw error;
  }

  return data?.item || null;
}

export async function updateWebAdminProduct(token, productId, payload) {
  const response = await fetchApi(`/api/web/admin/products/${Number(productId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  const data = await parseJson(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo actualizar el producto');
    error.status = response.status;
    throw error;
  }

  return data?.item || null;
}
