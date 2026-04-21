import { useEffect, useRef, useState } from 'react';
import { ProductImage } from './components/ProductImage.jsx';

export function CatalogV2Feature({
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
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  function toCategoryLabel(value) {
    if (value === 'all') {
      return 'Todas';
    }
    if (value === '__other__') {
      return 'Otros';
    }
    return value;
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

      <section className="catalog-v2-category-wrap">
        <label className="catalog-v2-category-label" htmlFor="catalog-v2-category">
          Categoria
        </label>
        <select
          id="catalog-v2-category"
          className="catalog-v2-category-select"
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
      {toastMessage ? <p className="catalog-toast">{toastMessage}</p> : null}

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {products.map((product, index) => (
              <li key={product.id} className="product-card">
                <ProductImage
                  product={product}
                  priority={index < 12}
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
