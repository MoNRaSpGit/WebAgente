export function normalizeOrderStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) {
    return 'pendiente';
  }
  if (normalized === 'nuevo' || normalized === 'visto') {
    return 'pendiente';
  }
  if (normalized === 'preparando') {
    return 'en_proceso';
  }
  if (normalized === 'listo_para_cobrar') {
    return 'listo';
  }
  return normalized;
}

export function canHideOrder(status) {
  return normalizeOrderStatus(status) === 'entregado';
}

export function applyMyWebOrderEvent(currentOrders, payload) {
  const list = Array.isArray(currentOrders) ? currentOrders : [];
  const order = payload?.order || null;
  const eventType = String(payload?.type || '');
  const eventOrderId = Number(payload?.order_id || order?.id || 0);

  if (!eventOrderId) {
    return list;
  }

  if (!order) {
    if (eventType === 'order_hidden_by_user') {
      return list.filter((item) => Number(item.id) !== eventOrderId);
    }
    return list;
  }

  const normalizedOrder = {
    ...order,
    id: Number(order.id),
    estado: normalizeOrderStatus(order.estado)
  };
  const isVisible = Number(normalizedOrder.cliente_visible ?? 1) === 1;
  const index = list.findIndex((item) => Number(item.id) === normalizedOrder.id);

  if (!isVisible) {
    if (index < 0) {
      return list;
    }
    const next = [...list];
    next.splice(index, 1);
    return next;
  }

  if (index < 0) {
    return [normalizedOrder, ...list];
  }

  const next = [...list];
  next[index] = {
    ...next[index],
    ...normalizedOrder
  };
  return next;
}
