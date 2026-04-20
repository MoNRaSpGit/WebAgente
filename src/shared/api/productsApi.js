import { fetchApi, parseJson } from './apiClient.js';

const DEFAULT_API_BASE = String(import.meta.env.VITE_API_URL || 'http://localhost:3000').trim();

function normalizeProductImageUrl(item) {
  const explicitUrl = String(item?.image_local_url || '').trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const rawPath = String(item?.image_path || '').trim();
  if (!rawPath) {
    if (item?.has_local_image && Number(item?.id || 0) > 0) {
      return `${DEFAULT_API_BASE}/api/web/products/${Number(item.id)}/image`;
    }
    return '';
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  if (!rawPath.startsWith('/')) {
    return `${DEFAULT_API_BASE}/${rawPath}`;
  }

  return `${DEFAULT_API_BASE}${rawPath}`;
}

function normalizeProducts(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    image_local_url: normalizeProductImageUrl(item)
  }));
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
    items: normalizeProducts(data.items),
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
    items: normalizeProducts(data.items),
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
