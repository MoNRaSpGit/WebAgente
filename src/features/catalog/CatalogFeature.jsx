import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWebProductImageSrc } from '../../shared/api/productsApi.js';

function ProductImage({ product, onImageLoadError, onImageLoaded }) {
  const hasImage = Boolean(product?.has_local_image);
  const imageUrl = hasImage ? buildWebProductImageSrc(product?.id) : '';
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl, product?.id]);

  useEffect(() => {
    if (hasError) {
      onImageLoadError?.(Number(product?.id || 0));
    }
  }, [hasError, onImageLoadError, product?.id]);

  return (
    <div className="product-card-image-wrap">
      {hasImage && !hasError && imageUrl ? (
        <img
          className="product-card-image"
          src={imageUrl}
          alt={product.nombre}
          loading="lazy"
          fetchpriority="auto"
          decoding="async"
          onLoad={() => onImageLoaded?.(Number(product?.id || 0))}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="product-card-image product-card-image--placeholder">
          Sin imagen
        </div>
      )}
    </div>
  );
}

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
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isBebidasExpanded, setIsBebidasExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const categoryMenuRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    setFailedImageIds(new Set());
    setLoadedImageIds(new Set());
  }, [activeCategory, searchValue]);

  useEffect(() => {
    function handleWindowClick(event) {
      if (!categoryMenuRef.current || categoryMenuRef.current.contains(event.target)) {
        return;
      }
      setIsCategoryMenuOpen(false);
      setIsBebidasExpanded(false);
    }

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

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

  const bebidasSubcategories = useMemo(
    () => categories.filter((category) => {
      const normalized = String(category || '').trim().toLowerCase();
      return normalized === 'bebidas_con_alcohol'
        || normalized === 'bebidas_sin_alcohol'
        || normalized.startsWith('bebidas - ');
    }),
    [categories]
  );

  const primaryCategories = useMemo(
    () => categories.filter((category) => !bebidasSubcategories.includes(category)),
    [bebidasSubcategories, categories]
  );

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === 'all') {
      return 'Todas';
    }
    if (activeCategory === '__other__') {
      return 'Otros';
    }
    return activeCategory || 'Categoria';
  }, [activeCategory]);

  function toCategoryLabel(category) {
    if (category === 'all') {
      return 'Todas';
    }
    if (category === '__other__') {
      return 'Otros';
    }
    return category;
  }

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

      <section className="store-categories">
        <label className="store-category-select">
          Categoria
        </label>
        <div className="store-category-menu" ref={categoryMenuRef}>
          <button
            type="button"
            className="store-category-trigger"
            onClick={() => setIsCategoryMenuOpen((current) => !current)}
            aria-expanded={isCategoryMenuOpen}
          >
            <span>{toCategoryLabel(activeCategoryLabel)}</span>
            <span className={`store-category-arrow ${isCategoryMenuOpen ? 'open' : ''}`}>▾</span>
          </button>

          {isCategoryMenuOpen ? (
            <div className="store-category-panel">
              {primaryCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`store-category-option ${activeCategory === category ? 'active' : ''}`}
                  onClick={() => {
                    onSelectCategory(category);
                    setIsCategoryMenuOpen(false);
                    setIsBebidasExpanded(false);
                  }}
                >
                  {toCategoryLabel(category)}
                </button>
              ))}

              {bebidasSubcategories.length > 0 ? (
                <div className="store-category-group">
                  <button
                    type="button"
                    className={`store-category-option store-category-option--group ${isBebidasExpanded ? 'expanded' : ''}`}
                    onClick={() => setIsBebidasExpanded((current) => !current)}
                  >
                    <span>Bebidas</span>
                    <span className={`store-category-arrow ${isBebidasExpanded ? 'open' : ''}`}>▸</span>
                  </button>

                  {isBebidasExpanded ? (
                    <div className="store-category-subgroup">
                      {bebidasSubcategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`store-category-option store-category-option--sub ${activeCategory === category ? 'active' : ''}`}
                          onClick={() => {
                            onSelectCategory(category);
                            setIsCategoryMenuOpen(false);
                            setIsBebidasExpanded(false);
                          }}
                        >
                          {toCategoryLabel(category)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="home-error">{error}</p> : null}
      {toastMessage ? <p className="catalog-toast">{toastMessage}</p> : null}
      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {sortedProducts.map((product) => (
              <li key={product.id} className="product-card">
                <ProductImage
                  product={product}
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
