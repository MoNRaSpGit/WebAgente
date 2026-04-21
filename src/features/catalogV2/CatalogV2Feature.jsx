import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  deliveryEnabled,
  isAdmin,
  selectedProductIds,
  onSearchChange,
  onSelectCategory,
  onIncreaseProduct,
  onEditProductCategory,
  loadMoreSentinelRef
}) {
  const [toastMessage, setToastMessage] = useState('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [beveragesExpanded, setBeveragesExpanded] = useState(false);
  const toastTimeoutRef = useRef(null);
  const categoryMenuRef = useRef(null);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!categoryMenuRef.current || categoryMenuRef.current.contains(event.target)) {
        return;
      }
      setCategoryMenuOpen(false);
    }

    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
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

  function normalizeCategoryKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  const groupedCategories = useMemo(() => {
    const baseCategories = categories.filter((category) => category !== 'all' && category !== '__other__');
    const remaining = [];
    const beveragesChildren = [];
    let beveragesRoot = null;

    for (const category of baseCategories) {
      const key = normalizeCategoryKey(category);

      if (key === 'bebidas') {
        beveragesRoot = category;
        continue;
      }

      if (key.startsWith('bebidas')) {
        beveragesChildren.push(category);
        continue;
      }

      remaining.push(category);
    }

    return {
      remaining,
      beveragesRoot,
      beveragesChildren,
      hasBeverageGroup: Boolean(beveragesRoot || beveragesChildren.length > 0)
    };
  }, [categories]);

  useEffect(() => {
    const isActiveOnBeverages = activeCategory === groupedCategories.beveragesRoot
      || groupedCategories.beveragesChildren.includes(activeCategory);

    if (isActiveOnBeverages) {
      setBeveragesExpanded(true);
    }
  }, [activeCategory, groupedCategories.beveragesChildren, groupedCategories.beveragesRoot]);

  function selectCategory(category) {
    onSelectCategory(category);
    setCategoryMenuOpen(false);
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
        <p className={`store-metrics-delivery ${deliveryEnabled ? 'store-metrics-delivery--on' : 'store-metrics-delivery--off'}`}>
          Delivery: {deliveryEnabled ? 'activo' : 'inactivo'}
        </p>
        <p>Productos: {productsTotal}</p>
        <p>Carrito: {cartCount}</p>
      </section>

      <section className="catalog-v2-category-wrap">
        <label className="catalog-v2-category-label" htmlFor="catalog-v2-category-trigger">
          Categoria
        </label>
        <div className="store-category-menu" ref={categoryMenuRef}>
          <button
            id="catalog-v2-category-trigger"
            type="button"
            className="store-category-trigger"
            onClick={() => setCategoryMenuOpen((current) => !current)}
          >
            <span>{toCategoryLabel(activeCategory)}</span>
            <ChevronDown size={15} className={`store-category-arrow ${categoryMenuOpen ? 'open' : ''}`} />
          </button>

          {categoryMenuOpen ? (
            <div className="store-category-panel">
              <button
                type="button"
                className={`store-category-option ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => selectCategory('all')}
              >
                Todas
              </button>

              {groupedCategories.hasBeverageGroup ? (
                <>
                  <button
                    type="button"
                    className={`store-category-option store-category-option--group ${
                      activeCategory === groupedCategories.beveragesRoot ? 'active' : ''
                    }`}
                    onClick={() => {
                      if (groupedCategories.beveragesRoot) {
                        onSelectCategory(groupedCategories.beveragesRoot);
                      }
                      setBeveragesExpanded((current) => !current);
                    }}
                  >
                    <span>Bebidas</span>
                    {beveragesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {beveragesExpanded ? (
                    <div className="store-category-subgroup">
                      {groupedCategories.beveragesRoot ? (
                        <button
                          type="button"
                          className={`store-category-option store-category-option--sub ${
                            activeCategory === groupedCategories.beveragesRoot ? 'active' : ''
                          }`}
                          onClick={() => selectCategory(groupedCategories.beveragesRoot)}
                        >
                          Bebidas (todas)
                        </button>
                      ) : null}
                      {groupedCategories.beveragesChildren.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`store-category-option store-category-option--sub ${
                            activeCategory === category ? 'active' : ''
                          }`}
                          onClick={() => selectCategory(category)}
                        >
                          {toCategoryLabel(category)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              {groupedCategories.remaining.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`store-category-option ${activeCategory === category ? 'active' : ''}`}
                  onClick={() => selectCategory(category)}
                >
                  {toCategoryLabel(category)}
                </button>
              ))}

              {categories.includes('__other__') ? (
                <button
                  type="button"
                  className={`store-category-option ${activeCategory === '__other__' ? 'active' : ''}`}
                  onClick={() => selectCategory('__other__')}
                >
                  Otros
                </button>
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
                {isAdmin ? (
                  <button
                    type="button"
                    className="product-card-edit"
                    onClick={() => onEditProductCategory?.(product)}
                  >
                    Editar
                  </button>
                ) : null}
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
