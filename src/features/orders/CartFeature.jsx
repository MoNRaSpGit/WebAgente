import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';
import { Banknote, BookUser, Check, Gift, Landmark, Truck, UserRoundCheck } from 'lucide-react';

export function CartFeature({
  items,
  total,
  paymentMethod,
  deliveryMode,
  userPoints,
  deliveryEnabled,
  canSubmit,
  savingOrder,
  onSelectPaymentMethod,
  onSelectDeliveryMode,
  onIncreaseProduct,
  onDecreaseProduct,
  onSubmitOrder
}) {
  const [paymentHint, setPaymentHint] = useState('');
  const paymentHintTimeoutRef = useRef(null);
  const pointsRequired = useMemo(() => Math.ceil(Number(total || 0)), [total]);
  const hasEnoughPoints = Number(userPoints || 0) >= pointsRequired;

  useEffect(() => () => {
    if (paymentHintTimeoutRef.current) {
      window.clearTimeout(paymentHintTimeoutRef.current);
    }
  }, []);

  const paymentOptions = [
    { key: 'pos', label: 'POS', Icon: Landmark },
    { key: 'efectivo', label: 'Efectivo', Icon: Banknote },
    { key: 'cuenta', label: 'Cuenta', Icon: BookUser },
    { key: 'puntos', label: 'Puntos', Icon: Gift }
  ];
  const deliveryOptions = [
    { key: 'delivery', label: 'Delivery', Icon: Truck },
    { key: 'pickup', label: 'Yo voy', Icon: UserRoundCheck }
  ];

  function handleSelectPaymentMethod(key) {
    if (key === 'puntos' && !hasEnoughPoints) {
      setPaymentHint('No tiene puntos suficiente');
      if (paymentHintTimeoutRef.current) {
        window.clearTimeout(paymentHintTimeoutRef.current);
      }
      paymentHintTimeoutRef.current = window.setTimeout(() => {
        setPaymentHint('');
        paymentHintTimeoutRef.current = null;
      }, 2600);
      return;
    }

    if (paymentHintTimeoutRef.current) {
      window.clearTimeout(paymentHintTimeoutRef.current);
      paymentHintTimeoutRef.current = null;
    }
    setPaymentHint('');
    onSelectPaymentMethod?.(key);
  }

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

      <section className="checkout-options-block">
        <h3 className="checkout-options-title">Tipo de pago</h3>
        {paymentHint ? <p className="checkout-options-hint">{paymentHint}</p> : null}
        <div className="checkout-options-grid">
          {paymentOptions.map(({ key, label, Icon }) => {
            const selected = paymentMethod === key;
            const pointsBlocked = key === 'puntos' && !hasEnoughPoints;
            return (
              <button
                key={key}
                type="button"
                className={`checkout-option ${selected ? 'checkout-option--selected' : ''} ${pointsBlocked ? 'checkout-option--blocked' : ''}`}
                onClick={() => handleSelectPaymentMethod(key)}
                aria-disabled={pointsBlocked}
              >
                <span className="checkout-option-icon">
                  <Icon size={15} />
                </span>
                <span>{label}</span>
                <span className={`checkout-option-check ${selected ? 'checkout-option-check--visible' : ''}`}>
                  <Check size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="checkout-options-block">
        <h3 className="checkout-options-title">Entrega</h3>
        {deliveryMode === 'delivery' && !deliveryEnabled ? (
          <p className="checkout-options-hint">Delivery habilitado con compra igual o mayor a $200.</p>
        ) : null}
        <div className="checkout-options-grid checkout-options-grid--two">
          {deliveryOptions.map(({ key, label, Icon }) => {
            const selected = deliveryMode === key;
            const disabled = key === 'delivery' && !deliveryEnabled;
            return (
              <button
                key={key}
                type="button"
                className={`checkout-option ${selected ? 'checkout-option--selected' : ''}`}
                onClick={() => onSelectDeliveryMode?.(key)}
                disabled={disabled}
              >
                <span className="checkout-option-icon">
                  <Icon size={15} />
                </span>
                <span>{label}</span>
                <span className={`checkout-option-check ${selected ? 'checkout-option-check--visible' : ''}`}>
                  <Check size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <button className="cart-submit-button" type="button" disabled={savingOrder || !canSubmit} onClick={onSubmitOrder}>
        {savingOrder ? 'Enviando...' : 'Enviar pedido'}
      </button>
    </section>
  );
}
