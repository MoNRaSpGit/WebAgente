import { useState } from 'react';
import { Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

export function RepeatOrdersFeature({
  products,
  loading,
  onGoCatalog,
  onAddProduct,
  onAddAllProducts,
  selectedProductIds
}) {
  const recentProducts = Array.isArray(products) ? products : [];

  return (
    <section className="repeat-orders-panel">
      <header className="repeat-orders-header">
        <div className="repeat-orders-title-wrap">
          <h2>Historial</h2>
          <p>Tu lista rapida con los productos que mas repetis.</p>
          {recentProducts.length > 0 ? (
            <div className="repeat-orders-meta">
              <span>{recentProducts.length} productos recientes</span>
              <span>Listo para carrito</span>
            </div>
          ) : null}
        </div>
        <button type="button" className="repeat-orders-go-catalog" onClick={onGoCatalog}>
          <Plus size={14} />
          <span>Productos</span>
        </button>
      </header>

      {loading ? <p>Cargando pedidos...</p> : null}
      {!loading && recentProducts.length === 0 ? <p>Todavia no hay productos recientes para repetir.</p> : null}

      {!loading && recentProducts.length > 0 ? (
        <ul className="repeat-orders-list">
          {recentProducts.map((product, index) => {
            const inCart = selectedProductIds?.has(Number(product.product_id));
            return (
              <li key={product.product_id} className="repeat-orders-item">
                <div className="repeat-orders-item-row">
                  <RepeatProductThumb productId={product.product_id} productName={product.product_name} />
                  <div className="repeat-orders-item-top">
                    <span className="repeat-orders-rank">#{index + 1}</span>
                    <strong>{product.product_name}</strong>
                    {Number(product.purchase_count || 0) > 0 ? (
                      <span>{Number(product.purchase_count)} compras</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="repeat-orders-repeat"
                    onClick={() => onAddProduct?.(product)}
                    disabled={inCart}
                  >
                    {inCart ? 'En carrito' : 'Agregar'}
                  </button>
                </div>
                <p className="repeat-orders-subtitle">Sugerido por historial reciente</p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && recentProducts.length > 0 ? (
        <div className="repeat-orders-footer">
          <button
            type="button"
            className="repeat-orders-add-all"
            onClick={() => onAddAllProducts?.(recentProducts)}
          >
            <ShoppingCart size={15} />
            Agregar todo
          </button>
          <p className="repeat-orders-footer-note">
            <Sparkles size={13} />
            <span>Despues podes ajustar cantidades en carrito.</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RepeatProductThumb({ productId, productName }) {
  const [failed, setFailed] = useState(false);
  const src = buildWebProductImageSrc(productId);

  if (!src || failed) {
    return <div className="repeat-orders-thumb repeat-orders-thumb--placeholder">Sin imagen</div>;
  }

  return (
    <img
      className="repeat-orders-thumb"
      src={src}
      alt={productName}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
