import { fetchApi, parseJson } from './apiClient.js';

export async function fetchMyWebProfile(token) {
  const response = await fetchApi('/api/web/users/me/profile', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cargar el perfil web');
  }

  return data.profile || null;
}
