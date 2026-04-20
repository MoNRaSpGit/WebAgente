import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

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
  function CartItemImage({ item }) {
    const src = buildWebProductImageSrc(item?.product_id);
    const hasImage = Boolean(item?.has_local_image && src);

    if (!hasImage) {
      return <div className="cart-item-thumb cart-item-thumb--placeholder">Sin imagen</div>;
    }

    return <img className="cart-item-thumb" src={src} alt={item.product_name} loading="lazy" decoding="async" />;
  }

  return (
    <section className="cart-panel">
      <header className="cart-panel-header">
        <h2>Carrito</h2>
        <span>{items.length} productos</span>
      </header>

      {items.length === 0 ? <p>No agregaste productos todavia.</p> : null}

      {items.length > 0 ? (
        <ul className="cart-list">
          {items.map((item) => (
            <li key={item.product_id} className="cart-item">
              <CartItemImage item={item} />
              <div className="cart-item-info">
                <strong>{item.product_name}</strong>
                <span>Cantidad: {item.quantity}</span>
                <span>Subtotal: ${(item.quantity * item.unit_price).toFixed(2)}</span>
              </div>
              <div className="cart-actions">
                <button
                  className="cart-qty-button"
                  type="button"
                  onClick={() => onIncreaseProduct({
                    id: item.product_id,
                    nombre: item.product_name,
                    precio_venta: item.unit_price,
                    has_local_image: item.has_local_image
                  })}
                >
                  +
                </button>
                <button className="cart-qty-button" type="button" onClick={() => onDecreaseProduct(item.product_id)}>-</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="cart-total">
        <span>Total estimado</span>
        <strong>${Number(total || 0).toFixed(2)}</strong>
      </p>

      <label className="order-note">
        Nota (opcional)
        <input
          value={orderNote}
          onChange={(event) => onOrderNoteChange(event.target.value)}
          placeholder="Ej: pasar despues de las 18:00"
        />
      </label>

      <button className="cart-submit-button" type="button" disabled={savingOrder || items.length === 0} onClick={onSubmitOrder}>
        {savingOrder ? 'Enviando...' : 'Enviar pedido'}
      </button>
    </section>
  );
}
