export function MyOrdersFeature({ orders, loading }) {
  return (
    <section className="orders-panel">
      <h2>Mis pedidos recientes</h2>
      {loading ? <p>Cargando pedidos...</p> : null}
      {!loading && orders.length === 0 ? <p>Todavia no hiciste pedidos.</p> : null}
      {!loading && orders.length > 0 ? (
        <ul className="orders-list">
          {orders.map((order) => (
            <li key={order.id}>
              <strong>Pedido #{order.id}</strong> - Estado: {order.estado} - Total: ${Number(order.total_estimado || 0).toFixed(2)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}