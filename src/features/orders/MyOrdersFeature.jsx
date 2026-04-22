import { useEffect, useMemo, useState } from 'react';
import { canHideOrder, normalizeOrderStatus } from './orderRealtime.js';

export function MyOrdersFeature({ orders, loading, onHideOrder }) {
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [repeatPreviewOrderId, setRepeatPreviewOrderId] = useState(null);
  const hasHiddenOrders = orders.length > 2;
  const visibleOrders = useMemo(
    () => (showAllOrders ? orders : orders.slice(0, 2)),
    [orders, showAllOrders]
  );

  useEffect(() => {
    if (!hasHiddenOrders) {
      setShowAllOrders(false);
    }
  }, [hasHiddenOrders]);

  useEffect(() => {
    if (!repeatPreviewOrderId) {
      return;
    }
    const exists = orders.some((item) => Number(item?.id) === Number(repeatPreviewOrderId));
    if (!exists) {
      setRepeatPreviewOrderId(null);
    }
  }, [orders, repeatPreviewOrderId]);

  function toOrderStatusLabel(status) {
    const normalized = normalizeOrderStatus(status);
    if (normalized === 'pendiente') {
      return 'Pendiente';
    }
    if (normalized === 'en_proceso') {
      return 'En proceso';
    }
    if (normalized === 'listo') {
      return 'Listo';
    }
    if (normalized === 'entregado') {
      return 'Entregado';
    }
    if (normalized === 'cobrado_en_scanner') {
      return 'Cobrado';
    }
    if (normalized === 'cancelado') {
      return 'Cancelado';
    }
    return normalized;
  }

  function formatOrderDate(dateText) {
    const raw = String(dateText || '').trim();
    if (!raw) {
      return 'Sin fecha';
    }

    const utcCandidate = raw.includes('T')
      ? raw
      : raw.replace(' ', 'T');

    const parsedDate = new Date(`${utcCandidate}Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat('es-UY', {
      timeZone: 'America/Montevideo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(parsedDate);
  }

  return (
    <section className="orders-panel">
      <header className="orders-panel-header">
        <h2>Mis pedidos</h2>
        <span>{orders.length} registros</span>
      </header>

      {loading ? <p>Cargando pedidos...</p> : null}
      {!loading && orders.length === 0 ? <p>Todavia no hiciste pedidos.</p> : null}
      {!loading && orders.length > 0 ? (
        <>
          <ul className="orders-list">
            {visibleOrders.map((order) => {
              const normalizedStatus = normalizeOrderStatus(order.estado);
              const hideEnabled = canHideOrder(normalizedStatus);

              return (
                <li key={order.id} className="orders-item">
                  <div className="orders-item-top">
                    <button
                      type="button"
                      className="orders-item-main"
                      onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
                    >
                      <strong>Pedido</strong>
                      <span>{formatOrderDate(order.created_at)}</span>
                    </button>
                    <button
                      type="button"
                      className="orders-detail-toggle"
                      onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
                    >
                      Detalle
                    </button>
                    <button
                      type="button"
                      className={`orders-repeat-toggle ${repeatPreviewOrderId === order.id ? 'orders-repeat-toggle--active' : ''}`}
                      onClick={() => setRepeatPreviewOrderId((current) => (current === order.id ? null : order.id))}
                    >
                      Repetir pedido
                    </button>
                    <span className={`orders-status orders-status--${normalizedStatus}`}>
                      {toOrderStatusLabel(order.estado)}
                    </span>
                    <button
                      type="button"
                      className="orders-hide-button"
                      disabled={!hideEnabled}
                      onClick={() => onHideOrder?.(order.id)}
                      aria-label="Ocultar pedido"
                      title={hideEnabled ? 'Eliminar pedido' : 'Solo pedidos entregados'}
                    >
                      x
                    </button>
                  </div>
                  <p className="orders-item-total">Total: ${Number(order.total_estimado || 0).toFixed(2)}</p>

                  {expandedOrderId === order.id ? (
                    <ul className="orders-item-details">
                      {(Array.isArray(order.items) ? order.items : []).map((item) => (
                        <li key={`${order.id}-${item.id}`}>
                          <span>{Number(item.quantity || 0)} x</span>
                          <strong>{item.product_name}</strong>
                        </li>
                      ))}
                      {(Array.isArray(order.items) ? order.items.length : 0) === 0 ? (
                        <li className="orders-item-details-empty">Sin detalle disponible</li>
                      ) : null}
                    </ul>
                  ) : null}

                  {repeatPreviewOrderId === order.id ? (
                    <section className="orders-repeat-preview">
                      <p className="orders-repeat-preview-title">Repetir este pedido</p>
                      <ul className="orders-repeat-preview-list">
                        {(Array.isArray(order.items) ? order.items : []).map((item) => (
                          <li key={`repeat-${order.id}-${item.id}`}>
                            <span>{Number(item.quantity || 0)} x</span>
                            <strong>{item.product_name}</strong>
                          </li>
                        ))}
                        {(Array.isArray(order.items) ? order.items.length : 0) === 0 ? (
                          <li className="orders-repeat-preview-empty">Sin productos para repetir</li>
                        ) : null}
                      </ul>
                      <div className="orders-repeat-actions">
                        <button type="button" className="orders-repeat-actions-primary">
                          Agregar todo al carrito
                        </button>
                        <button type="button" className="orders-repeat-actions-secondary">
                          Editar antes de agregar
                        </button>
                      </div>
                    </section>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {hasHiddenOrders ? (
            <div className="orders-accordion-actions">
              <button
                type="button"
                className="orders-accordion-toggle"
                onClick={() => setShowAllOrders((current) => !current)}
              >
                {showAllOrders ? 'Ver menos' : `Ver mas (${orders.length - 2})`}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
