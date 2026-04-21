import { useEffect } from 'react';
import { applyMyWebOrderEvent } from '../../../features/orders/orderRealtime.js';
import { buildMyWebOrdersStreamUrl, fetchMyWebOrders } from '../../../shared/api/webOrdersApi.js';

export function useMyOrdersRealtime({ activeView, token, setMyOrders }) {
  useEffect(() => {
    if (activeView !== 'orders' || !token) {
      return undefined;
    }

    async function refreshOrders() {
      try {
        const orders = await fetchMyWebOrders(token, 20);
        setMyOrders(orders);
      } catch {
        // Silent refresh.
      }
    }

    const streamUrl = buildMyWebOrdersStreamUrl(token);
    const eventSource = streamUrl ? new EventSource(streamUrl) : null;

    if (eventSource) {
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (payload?.type === 'keepalive' || payload?.type === 'connected') {
            return;
          }
          if (payload?.order || payload?.order_id) {
            setMyOrders((current) => applyMyWebOrderEvent(current, payload));
            return;
          }
        } catch (_error) {
          // Fallback to refresh.
        }
        refreshOrders();
      };

      eventSource.onerror = () => {};
    }

    refreshOrders();

    return () => {
      eventSource?.close();
    };
  }, [activeView, setMyOrders, token]);
}
