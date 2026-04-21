import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

export function InactiveProductsFeature({
  loading,
  loadingMore,
  hasMore,
  error,
  items,
  total,
  onLoadMore
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="inactive-shell">
      <div className="inactive-header">
        <h2>Actualizar</h2>
        <p>Productos no activos: {safeItems.length || total}</p>
      </div>

      {loading ? <p>Cargando productos no activos...</p> : null}
      {error ? <p className="home-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {safeItems.map((product) => (
              <li key={product.id} className="product-card">
                <div className="product-card-image-wrap">
                  {product.has_local_image ? (
                    <img
                      className="product-card-image"
                      src={buildWebProductImageSrc(product.id)}
                      alt={product.nombre}
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-card-image product-card-image--placeholder">Sin imagen</div>
                  )}
                </div>
                <strong className="product-card-name">{product.nombre}</strong>
                <span className="product-card-price">${Number(product.precio_venta || 0).toFixed(2)}</span>
                <span className="inactive-tag">Estado: {String(product.estado || 'inactivo').trim().toLowerCase()}</span>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <div className="inactive-actions">
              <button type="button" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Cargando...' : 'Cargar mas'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
