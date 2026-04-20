export function CartFeature({
  items,
  total,
  orderNote,
  savingOrder,
  onOrderNoteChange,
  onIncreaseProduct,
  onDecreaseProduct,
  onSubmitOrder
}) {
  return (
    <section className="cart-panel">
      <h2>Carrito</h2>

      {items.length === 0 ? <p>No agregaste productos todavia.</p> : null}

      {items.length > 0 ? (
        <ul className="cart-list">
          {items.map((item) => (
            <li key={item.product_id} className="cart-item">
              <strong>{item.product_name}</strong>
              <span>Cantidad: {item.quantity}</span>
              <span>Subtotal: ${(item.quantity * item.unit_price).toFixed(2)}</span>
              <div className="cart-actions">
                <button
                  type="button"
                  onClick={() => onIncreaseProduct({
                    id: item.product_id,
                    nombre: item.product_name,
                    precio_venta: item.unit_price
                  })}
                >
                  +
                </button>
                <button type="button" onClick={() => onDecreaseProduct(item.product_id)}>-</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p>Total estimado: ${Number(total || 0).toFixed(2)}</p>

      <label className="order-note">
        Nota (opcional)
        <input
          value={orderNote}
          onChange={(event) => onOrderNoteChange(event.target.value)}
          placeholder="Ej: pasar despues de las 18:00"
        />
      </label>

      <button type="button" disabled={savingOrder || items.length === 0} onClick={onSubmitOrder}>
        {savingOrder ? 'Enviando...' : 'Enviar pedido'}
      </button>
    </section>
  );
}
