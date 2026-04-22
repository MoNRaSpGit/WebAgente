import { fetchApi, parseJson } from './apiClient.js';

export async function createWebOrder(token, payload) {
  const response = await fetchApi('/api/web/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo crear el pedido');
  }

  return data;
}

export async function fetchMyWebOrders(token, limit = 20) {
  const response = await fetchApi(`/api/web/orders/mine?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar tus pedidos');
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchMyRepeatProducts(token, limit = 10) {
  const response = await fetchApi(`/api/web/orders/repeat-products?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cargar el historial de productos');
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function hideMyWebOrder(token, orderId) {
  const response = await fetchApi(`/api/web/orders/${Number(orderId)}/hide`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo ocultar el pedido');
  }

  return data;
}

export function buildMyWebOrdersStreamUrl(token) {
  if (!token) {
    return '';
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const encodedToken = encodeURIComponent(token);
  return `${apiBaseUrl}/api/web/orders/stream?token=${encodedToken}`;
}
