import { useEffect, useMemo, useRef, useState } from 'react';
import { CategoryMenu } from './components/CategoryMenu.jsx';
import { ProductImage } from './components/ProductImage.jsx';

export function CatalogFeature({
  products,
  productsTotal,
  loading,
  loadingMore,
  error,
  cartCount,
  searchValue,
  categories,
  activeCategory,
  points,
  totalCompras,
  lastFetchMs,
  selectedProductIds,
  onSearchChange,
  onSelectCategory,
  onIncreaseProduct,
  loadMoreSentinelRef
}) {
  const [failedImageIds, setFailedImageIds] = useState(() => new Set());
  const [loadedImageIds, setLoadedImageIds] = useState(() => new Set());
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    setFailedImageIds(new Set());
    setLoadedImageIds(new Set());
  }, [activeCategory, searchValue]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  function handleImageLoadError(productId) {
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    setFailedImageIds((current) => {
      if (current.has(productId)) {
        return current;
      }
      const next = new Set(current);
      next.add(productId);
      return next;
    });
  }

  function handleImageLoaded(productId) {
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    setLoadedImageIds((current) => {
      if (current.has(productId)) {
        return current;
      }
      const next = new Set(current);
      next.add(productId);
      return next;
    });
  }

  const sortedProducts = useMemo(() => {
    const indexById = new Map(products.map((item, index) => [Number(item?.id || 0), index]));
    const getRank = (item) => {
      const id = Number(item?.id || 0);
      const hasImage = Boolean(item?.has_local_image);
      const failed = failedImageIds.has(id);
      const loaded = loadedImageIds.has(id);

      if (hasImage && loaded && !failed) {
        return 0;
      }
      if (hasImage && !loaded && !failed) {
        return 2;
      }
      if (hasImage && failed) {
        return 3;
      }
      return 4;
    };

    return [...products].sort((a, b) => {
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (indexById.get(Number(a?.id || 0)) ?? 0) - (indexById.get(Number(b?.id || 0)) ?? 0);
    });
  }, [failedImageIds, loadedImageIds, products]);

  function showToast(message) {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 1400);
  }

  function handleAddProduct(product) {
    const productId = Number(product?.id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    if (selectedProductIds?.has(productId)) {
      return;
    }
    onIncreaseProduct(product);
    showToast('Producto agregado');
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

      <CategoryMenu
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={onSelectCategory}
      />

      {error ? <p className="home-error">{error}</p> : null}
      {toastMessage ? <p className="catalog-toast">{toastMessage}</p> : null}

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {sortedProducts.map((product, index) => (
              <li key={product.id} className="product-card">
                <ProductImage
                  product={product}
                  priority={index < 12}
                  onImageLoadError={handleImageLoadError}
                  onImageLoaded={handleImageLoaded}
                />
                <strong className="product-card-name">{product.nombre}</strong>
                <span className="product-card-price">${Number(product.precio_venta || 0).toFixed(2)}</span>
                <button
                  type="button"
                  className={`product-card-add ${selectedProductIds?.has(Number(product.id)) ? 'product-card-add--selected' : ''}`}
                  onClick={() => handleAddProduct(product)}
                  disabled={selectedProductIds?.has(Number(product.id))}
                >
                  {selectedProductIds?.has(Number(product.id)) ? 'En carrito' : 'Agregar'}
                </button>
              </li>
            ))}
          </ul>

          <div ref={loadMoreSentinelRef} className="products-load-sentinel" />
          {loadingMore ? <p className="sr-only">Cargando mas productos</p> : null}
        </>
      ) : null}
    </>
  );
}
