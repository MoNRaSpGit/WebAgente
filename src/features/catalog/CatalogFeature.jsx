import { useEffect, useState } from 'react';
import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

function ProductImage({ product, eager = false }) {
  const hasImage = Boolean(product?.has_local_image);
  const imageUrl = hasImage ? buildWebProductImageSrc(product?.id) : '';
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState('');

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setResolvedSrc('');
  }, [imageUrl, product?.id]);

  useEffect(() => {
    if (!hasImage || !imageUrl) {
      return undefined;
    }

    let cancelled = false;

    function buildAttemptUrl(baseUrl, attempt) {
      return attempt > 0 ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}r=${attempt}` : baseUrl;
    }

    function loadWithRetry(attempt) {
      const src = buildAttemptUrl(imageUrl, attempt);
      const probe = new Image();

      probe.onload = () => {
        if (cancelled) {
          return;
        }
        setResolvedSrc(src);
        setIsLoaded(true);
      };

      probe.onerror = () => {
        if (cancelled) {
          return;
        }
        if (attempt < 2) {
          loadWithRetry(attempt + 1);
          return;
        }
        setHasError(true);
      };

      probe.src = src;
    }

    loadWithRetry(0);

    return () => {
      cancelled = true;
    };
  }, [hasImage, imageUrl]);

  if (!hasImage || hasError || !imageUrl) {
    return (
      <div className="product-card-image product-card-image--placeholder">
        Sin imagen
      </div>
    );
  }

  return (
    <div className="product-card-image-wrap">
      {!isLoaded ? (
        <div className="product-card-image product-card-image--loading skeleton-line" aria-hidden="true" />
      ) : null}
      <img
        className="product-card-image"
        src={resolvedSrc || imageUrl}
        alt={product.nombre}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ opacity: isLoaded ? 1 : 0 }}
      />
    </div>
  );
}

export function CatalogFeature({
  products,
  productsTotal,
  loading,
  loadingMore,
  error,
  orderSuccess,
  cartCount,
  skeletonCount,
  searchValue,
  categories,
  activeCategory,
  points,
  totalCompras,
  lastFetchMs,
  onSearchChange,
  onSelectCategory,
  onIncreaseProduct,
  loadMoreSentinelRef
}) {
  function toCategoryLabel(category) {
    if (category === 'all') {
      return 'Todas';
    }
    if (category === '__other__') {
      return 'Otros';
    }
    return category;
  }

  return (
    <>
      <label className="store-search store-search--catalog">
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar producto o categoria..."
        />
      </label>

      <section className="store-metrics">
        <p>Puntos: {points}</p>
        <p>Compras: {totalCompras}</p>
        <p>Productos: {productsTotal}</p>
        <p>Carrito: {cartCount}</p>
        <p>Fetch: {Number(lastFetchMs || 0)} ms</p>
      </section>

      <section className="store-categories">
        <label className="store-category-select" htmlFor="store-category">
          Categoria
        </label>
        <select
          id="store-category"
          value={activeCategory}
          onChange={(event) => onSelectCategory(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {toCategoryLabel(category)}
            </option>
          ))}
        </select>
      </section>

      {error ? <p className="home-error">{error}</p> : null}
      {orderSuccess ? <p className="home-success">{orderSuccess}</p> : null}

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {products.map((product, index) => (
              <li key={product.id} className="product-card">
                <ProductImage product={product} eager={index < 12} />
                <strong className="product-card-name">{product.nombre}</strong>
                <span className="product-card-price">${Number(product.precio_venta || 0).toFixed(2)}</span>
                <button type="button" className="product-card-add" onClick={() => onIncreaseProduct(product)}>
                  Agregar
                </button>
              </li>
            ))}
          </ul>

          {skeletonCount > 0 ? (
            <ul className="products-grid">
              {Array.from({ length: skeletonCount }, (_, index) => (
                <li key={`skeleton-${index}`} className="product-card products-item-skeleton">
                  <div className="skeleton-line skeleton-image" />
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-button" />
                </li>
              ))}
            </ul>
          ) : null}

          <div ref={loadMoreSentinelRef} className="products-load-sentinel" />
          {loadingMore ? <p className="sr-only">Cargando mas productos</p> : null}
        </>
      ) : null}
    </>
  );
}
