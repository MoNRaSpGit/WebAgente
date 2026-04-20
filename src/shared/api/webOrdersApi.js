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
