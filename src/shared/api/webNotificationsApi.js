import { fetchApi, parseJson } from './apiClient.js';

export async function sendWebWhatsappTest(token, payload = {}) {
  const response = await fetchApi('/api/web/admin/notifications/whatsapp/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data.message || 'No se pudo enviar WhatsApp de prueba');
  }

  return data?.item || null;
}
