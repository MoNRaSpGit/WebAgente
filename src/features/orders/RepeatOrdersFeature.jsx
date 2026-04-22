import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

export function RepeatOrdersFeature({
  products,
  loading,
  onGoCatalog,
  onAddAllProducts
}) {
  const recentProducts = Array.isArray(products) ? products : [];
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    const validIds = new Set(
      recentProducts
        .map((product) => Number(product?.product_id || 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    setSelectedIds((current) => {
      if (!current.size) {
        return current;
      }
      const next = new Set();
      for (const id of current) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [recentProducts]);

  const selectedProducts = useMemo(
    () => recentProducts.filter((product) => selectedIds.has(Number(product?.product_id || 0))),
    [recentProducts, selectedIds]
  );

  function toggleSelected(productId) {
    const safeId = Number(productId || 0);
    if (!Number.isFinite(safeId) || safeId <= 0) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(safeId)) {
        next.delete(safeId);
      } else {
        next.add(safeId);
      }
      return next;
    });
  }

  function handleAddSelected() {
    if (selectedProducts.length === 0) {
      return;
    }
    onAddAllProducts?.(selectedProducts);
  }

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
            const isSelected = selectedIds.has(Number(product.product_id));
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
                    className={`repeat-orders-repeat ${isSelected ? 'repeat-orders-repeat--selected' : ''}`}
                    onClick={() => toggleSelected(product.product_id)}
                  >
                    {isSelected ? <Check size={14} /> : null}
                    <span>{isSelected ? 'Seleccionado' : 'Agregar'}</span>
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
            onClick={handleAddSelected}
            disabled={selectedProducts.length === 0}
          >
            <ShoppingCart size={15} />
            Agregar
          </button>
          <p className="repeat-orders-footer-note">
            <Sparkles size={13} />
            <span>Seleccionados: {selectedProducts.length}</span>
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
