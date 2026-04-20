import { useState } from 'react';

export function MyOrdersFeature({ orders, loading }) {
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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
        <ul className="orders-list">
          {orders.map((order) => (
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
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
