import { useState } from 'react';
import { createWebOrder, hideMyWebOrder } from '../../../shared/api/webOrdersApi.js';

export function useCheckoutOrderFlow({
  token,
  user,
  manualWhatsappTo,
  setError,
  setMyOrders,
  setMyProfile,
  setCartItems,
  setActiveView
}) {
  const [savingOrder, setSavingOrder] = useState(false);

  function sendOrderToWhatsappManual(order, items, note, payment, delivery) {
    if (!manualWhatsappTo || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const customer = String(user?.nombre || user?.email || 'Cliente').trim();
    const itemsText = items
      .map((item) => `- ${Number(item.quantity || 0)} x ${String(item.product_name || 'Producto').trim()}`)
      .join('\n');
    const noteText = String(note || '').trim();
    const paymentText = String(payment || '').trim();
    const deliveryText = String(delivery || '').trim();
    const paymentLabelMap = {
      pos: 'POS',
      efectivo: 'Efectivo',
      cuenta: 'Cuenta',
      puntos: 'Puntos'
    };
    const deliveryLabelMap = {
      delivery: 'Delivery',
      pickup: 'Yo voy'
    };

    const lines = [
      'Nuevo pedido web',
      `Cliente: ${customer}`,
      `Pago: ${paymentLabelMap[paymentText] || paymentText || '-'}`,
      `Entrega: ${deliveryLabelMap[deliveryText] || deliveryText || '-'}`,
      '',
      'Detalle:',
      itemsText
    ];

    if (noteText) {
      lines.push('', `Nota: ${noteText}`);
    }

    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${manualWhatsappTo}?text=${text}`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      // El pedido ya fue guardado correctamente; si el navegador bloquea el popup
      // evitamos mostrarlo como error global para no confundir al usuario.
      console.warn('[web-order] WhatsApp popup bloqueado por el navegador');
    }
  }

  function handleSendWhatsappManual() {
    if (!manualWhatsappTo) {
      setError('Configura VITE_WHATSAPP_MANUAL_TO en WebAgente/.env');
      return;
    }

    const message = encodeURIComponent('hola desde la web');
    const url = `https://wa.me/${manualWhatsappTo}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function submitOrder({
    cartList,
    paymentMethod,
    deliveryMode,
    hasEnoughPoints,
    canUseDelivery
  }) {
    if (cartList.length === 0) {
      return;
    }
    if (!paymentMethod) {
      setError('Selecciona un tipo de pago');
      return;
    }
    if (!deliveryMode) {
      setError('Selecciona tipo de entrega');
      return;
    }
    if (paymentMethod === 'puntos' && !hasEnoughPoints) {
      setError('No tiene puntos suficiente');
      return;
    }
    if (deliveryMode === 'delivery' && !canUseDelivery) {
      setError('Delivery habilitado con compra igual o mayor a $200');
      return;
    }

    setSavingOrder(true);
    setError('');

    try {
      const payload = {
        notes: '',
        payment_method: paymentMethod,
        delivery_mode: deliveryMode,
        items: cartList.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      };

      const result = await createWebOrder(token, payload);
      const createdOrder = result?.item || null;
      const awardedPoints = Number(result?.meta?.awarded_points || 0);
      const orderTotal = Number(result?.meta?.order_total || createdOrder?.total_estimado || 0);

      if (createdOrder) {
        setMyOrders((current) => [createdOrder, ...current].slice(0, 20));
      }
      sendOrderToWhatsappManual(createdOrder, cartList, '', paymentMethod, deliveryMode);

      setMyProfile((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          total_compras: Number(current.total_compras || 0) + 1,
          monto_total_compras: Number((Number(current.monto_total_compras || 0) + orderTotal).toFixed(2)),
          puntos_actuales: Number(current.puntos_actuales || 0) + awardedPoints,
          puntos_acumulados: Number(current.puntos_acumulados || 0) + awardedPoints,
          ultima_compra_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
      });

      setCartItems({});
      setActiveView('orders');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleHideOrder(orderId) {
    const parsedOrderId = Number(orderId);
    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
      return;
    }

    try {
      await hideMyWebOrder(token, parsedOrderId);
      setMyOrders((current) => current.filter((item) => Number(item.id) !== parsedOrderId));
    } catch (hideError) {
      setError(hideError.message || 'No se pudo ocultar el pedido');
    }
  }

  return {
    savingOrder,
    submitOrder,
    handleHideOrder,
    handleSendWhatsappManual
  };
}

