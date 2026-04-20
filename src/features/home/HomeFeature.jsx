import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, House, LogOut, ShoppingCart, UserRound } from 'lucide-react';
import { CatalogFeature } from '../../features/catalog/CatalogFeature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { CartFeature } from '../../features/orders/CartFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { fetchWebCategories, fetchWebInactiveProducts, fetchWebProducts } from '../../shared/api/productsApi.js';
import { createWebOrder, fetchMyWebOrders } from '../../shared/api/webOrdersApi.js';
import { fetchMyWebProfile } from '../../shared/api/webUsersApi.js';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';

const WEB_PRODUCTS_PAGE_LIMIT = 500;
const WEB_INACTIVE_PRODUCTS_PAGE_LIMIT = 200;
const CATEGORY_ALL = 'all';
const CATEGORY_OTHER = '__other__';

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function HomeFeature() {
  const { profile, user, token, logout } = useWebAuth();
  const [products, setProducts] = useState([]);
  const [productsOffset, setProductsOffset] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(true);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [visibleProductsCount, setVisibleProductsCount] = useState(9);
  const [myOrders, setMyOrders] = useState([]);
  const [myProfile, setMyProfile] = useState(profile || null);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [cartItems, setCartItems] = useState({});
  const [activeView, setActiveView] = useState('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL);
  const [lastFetchMs, setLastFetchMs] = useState(0);
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [inactiveOffset, setInactiveOffset] = useState(0);
  const [inactiveHasMore, setInactiveHasMore] = useState(true);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveLoadingMore, setInactiveLoadingMore] = useState(false);
  const [inactiveError, setInactiveError] = useState('');
  const [knownCategories, setKnownCategories] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const loadMoreSentinelRef = useRef(null);
  const loadNextPageRef = useRef(null);
  const userMenuRef = useRef(null);
  const hasBootstrappedRef = useRef(false);
  const skipFirstCategoryReloadRef = useRef(true);
  const productCacheByCategoryRef = useRef(new Map());

  const cartList = Object.values(cartItems);
  const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);
  const searchTokens = useMemo(
    () => normalizedSearch.split(' ').map((part) => part.trim()).filter(Boolean),
    [normalizedSearch]
  );
  const normalizedActiveCategory = useMemo(
    () => (activeCategory === CATEGORY_ALL || activeCategory === CATEGORY_OTHER
      ? ''
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim()),
    [activeCategory]
  );

  const knownCategoriesNormalized = useMemo(
    () => new Set(knownCategories.map((item) => String(item || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean)),
    [knownCategories]
  );
  const categories = useMemo(() => [CATEGORY_ALL, ...knownCategories, CATEGORY_OTHER], [knownCategories]);
  const filteredProducts = useMemo(() => {
    const activeCategoryNormalized = activeCategory === CATEGORY_ALL
      ? CATEGORY_ALL
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim();

    return products.filter((item) => {
      const itemCategoryNormalized = String(item.categoria || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (activeCategoryNormalized === CATEGORY_OTHER) {
        const isOther = !itemCategoryNormalized || !knownCategoriesNormalized.has(itemCategoryNormalized);
        if (!isOther) {
          return false;
        }
      } else if (activeCategoryNormalized !== CATEGORY_ALL && itemCategoryNormalized !== activeCategoryNormalized) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const name = normalizeSearchText(item.nombre);
      const category = normalizeSearchText(item.categoria);
      const haystack = `${name} ${category}`.trim();

      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [activeCategory, knownCategoriesNormalized, normalizedSearch, products, searchTokens]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );
  const skeletonCount = loading ? 9 : (productsLoadingMore ? 3 : 0);

  const cartTotal = cartList.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );
  const cartCount = cartList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const loadInactiveProductsPage = useCallback(async ({ reset = false, silent = false } = {}) => {
    if (!reset && (!inactiveHasMore || inactiveLoadingMore)) {
      return;
    }

    if (reset) {
      setInactiveLoading(true);
      setInactiveError('');
      setInactiveProducts([]);
      setInactiveOffset(0);
      setInactiveHasMore(true);
    } else {
      setInactiveLoadingMore(true);
      if (!silent) {
        setInactiveError('');
      }
    }

    const requestOffset = reset ? 0 : inactiveOffset;

    try {
      const result = await fetchWebInactiveProducts({
        limit: WEB_INACTIVE_PRODUCTS_PAGE_LIMIT,
        offset: requestOffset
      });

      setInactiveProducts((current) => (reset ? result.items : [...current, ...result.items]));
      setInactiveOffset(requestOffset + result.items.length);
      setInactiveHasMore(Boolean(result.page?.has_more));
    } catch (loadError) {
      if (!silent) {
        setInactiveError(loadError.message);
      }
    } finally {
      setInactiveLoading(false);
      setInactiveLoadingMore(false);
    }
  }, [inactiveHasMore, inactiveLoadingMore, inactiveOffset]);

  const loadNextProductsPage = useCallback(async ({
    silent = false,
    offsetOverride = null,
    reset = false,
    categoryOverride = normalizedActiveCategory
  } = {}) => {
    if (!reset && (!productsHasMore || productsLoadingMore)) {
      return;
    }

    setProductsLoadingMore(true);
    const requestOffset = Number.isFinite(offsetOverride) ? Math.max(0, Math.floor(offsetOverride)) : productsOffset;

    try {
      const startAt = performance.now();
      const result = await fetchWebProducts({
        limit: WEB_PRODUCTS_PAGE_LIMIT,
        offset: requestOffset,
        category: categoryOverride
      });
      setLastFetchMs(Math.round(performance.now() - startAt));

      let mergedItems = result.items;

      setProducts((current) => {
        if (reset || requestOffset === 0) {
          mergedItems = result.items;
          return result.items;
        }

        const nextItems = [...current, ...result.items];
        mergedItems = nextItems;
        return nextItems;
      });

      const nextOffset = requestOffset + result.items.length;
      const nextHasMore = Boolean(result.page?.has_more);
      const cacheKey = String(categoryOverride || '');
      productCacheByCategoryRef.current.set(cacheKey, {
        items: mergedItems,
        offset: nextOffset,
        hasMore: nextHasMore
      });

      setProductsOffset(nextOffset);
      setProductsHasMore(nextHasMore);
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      }
    } finally {
      setProductsLoadingMore(false);
    }
  }, [normalizedActiveCategory, productsHasMore, productsLoadingMore, productsOffset]);

  loadNextPageRef.current = loadNextProductsPage;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const productsResult = await fetchWebProducts({
          limit: WEB_PRODUCTS_PAGE_LIMIT,
          offset: 0,
          category: ''
        });

        if (mounted) {
          setProducts(productsResult.items);
          setProductsOffset(productsResult.items.length);
          setProductsHasMore(Boolean(productsResult.page?.has_more));
          productCacheByCategoryRef.current.set('', {
            items: productsResult.items,
            offset: productsResult.items.length,
            hasMore: Boolean(productsResult.page?.has_more)
          });
          setVisibleProductsCount(9);
          setError('');
          hasBootstrappedRef.current = true;
          setLoading(false);
        }

        Promise.all([
          fetchWebCategories({ status: 'activo' }),
          fetchMyWebOrders(token, 20),
          fetchMyWebProfile(token)
        ])
          .then(([categoriesData, orders, profileData]) => {
            if (!mounted) {
              return;
            }
            setKnownCategories([...categoriesData].sort((a, b) => a.localeCompare(b)));
            setMyOrders(orders);
            setMyProfile(profileData);
          })
          .catch(() => {});
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!hasBootstrappedRef.current || activeView !== 'catalog') {
      return;
    }

    if (skipFirstCategoryReloadRef.current) {
      skipFirstCategoryReloadRef.current = false;
      return;
    }

    let mounted = true;

    async function reloadProductsByCategory() {
      const cacheKey = String(normalizedActiveCategory || '');
      const cached = productCacheByCategoryRef.current.get(cacheKey);
      if (cached) {
        setError('');
        setLoading(false);
        setVisibleProductsCount(9);
        setProducts(cached.items);
        setProductsOffset(cached.offset);
        setProductsHasMore(Boolean(cached.hasMore));
        return;
      }

      setError('');
      setLoading(true);
      setVisibleProductsCount(9);
      setProducts([]);
      setProductsOffset(0);
      setProductsHasMore(true);

      try {
        const startAt = performance.now();
        const result = await fetchWebProducts({
          limit: WEB_PRODUCTS_PAGE_LIMIT,
          offset: 0,
          category: normalizedActiveCategory
        });
        setLastFetchMs(Math.round(performance.now() - startAt));
        if (!mounted) {
          return;
        }
        productCacheByCategoryRef.current.set(cacheKey, {
          items: result.items,
          offset: result.items.length,
          hasMore: Boolean(result.page?.has_more)
        });
        setProducts(result.items);
        setProductsOffset(result.items.length);
        setProductsHasMore(Boolean(result.page?.has_more));
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    reloadProductsByCategory();

    return () => {
      mounted = false;
    };
  }, [activeView, normalizedActiveCategory]);

  useEffect(() => {
    setVisibleProductsCount(9);
  }, [searchTerm, activeCategory]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(CATEGORY_ALL);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (activeView !== 'catalog') {
      return;
    }

    if (!productsHasMore) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (loadNextPageRef.current) {
        loadNextPageRef.current({ silent: true });
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeView, productsHasMore, productsOffset]);

  useEffect(() => {
    if (!loadMoreSentinelRef.current || activeView !== 'catalog') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) {
          return;
        }

        setVisibleProductsCount((current) => {
          const next = Math.min(products.length, current + 9);
          return next;
        });

        if (visibleProductsCount + 9 >= filteredProducts.length && productsHasMore && loadNextPageRef.current) {
          loadNextPageRef.current({ silent: true });
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loadMoreSentinelRef.current);

    return () => observer.disconnect();
  }, [activeView, filteredProducts.length, productsHasMore, visibleProductsCount]);

  useEffect(() => {
    async function loadInactive() {
      if (activeView !== 'update') {
        return;
      }
      await loadInactiveProductsPage({ reset: true });
    }

    loadInactive();

    return undefined;
  }, [activeView, loadInactiveProductsPage]);

  useEffect(() => {
    function handleWindowClick(event) {
      if (!userMenuRef.current || userMenuRef.current.contains(event.target)) {
        return;
      }
      setUserMenuOpen(false);
    }

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  function increaseProduct(product) {
    setCartItems((current) => {
      const key = String(product.id);
      const existing = current[key];
      const quantity = existing ? existing.quantity + 1 : 1;
      const hasLocalImage = Boolean(existing?.has_local_image || product.has_local_image);

      return {
        ...current,
        [key]: {
          product_id: Number(product.id),
          product_name: product.nombre,
          unit_price: Number(product.precio_venta || 0),
          quantity,
          has_local_image: hasLocalImage
        }
      };
    });
  }

  function decreaseProduct(productId) {
    setCartItems((current) => {
      const key = String(productId);
      const existing = current[key];

      if (!existing) {
        return current;
      }

      if (existing.quantity <= 1) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: {
          ...existing,
          quantity: existing.quantity - 1
        }
      };
    });
  }

  async function submitOrder() {
    if (cartList.length === 0) {
      return;
    }

    setSavingOrder(true);
    setError('');
    setOrderSuccess('');

    try {
      const payload = {
        notes: orderNote,
        items: cartList.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      };

      const result = await createWebOrder(token, payload);
      const createdOrder = result?.item || null;
      const awardedPoints = Number(result?.meta?.awarded_points || 0);
      const orderTotal = Number(result?.meta?.order_total || createdOrder?.total_estimado || 0);

      if (createdOrder) {
        setMyOrders((current) => [createdOrder, ...current].slice(0, 20));
      }

      setMyProfile((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          total_compras: Number(current.total_compras || 0) + 1,
          monto_total_compras: Number((Number(current.monto_total_compras || 0) + orderTotal).toFixed(2)),
          puntos_actuales: Number(current.puntos_actuales || 0) + awardedPoints,
          puntos_acumulados: Number(current.puntos_acumulados || 0) + awardedPoints,
          ultima_compra_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
      });

      setCartItems({});
      setOrderNote('');
      setOrderSuccess(`Pedido #${result.item?.id} enviado`);
      setActiveView('orders');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <main className="home-shell">
      <section className="home-card home-card--wide">
        <header className="home-topbar">
          <div className="home-topbar-brand">
            <span className="store-brand-logo">WP</span>
            <div>
              <strong>Web Piloto</strong>
              <span className="store-brand-user">{user?.nombre || user?.email}</span>
            </div>
          </div>

          <nav className="home-desktop-nav">
            <button
              type="button"
              className={activeView === 'catalog' ? 'home-desktop-nav-active' : ''}
              onClick={() => setActiveView('catalog')}
            >
              Inicio
            </button>
            <button
              type="button"
              className={activeView === 'cart' ? 'home-desktop-nav-active' : ''}
              onClick={() => setActiveView('cart')}
            >
              Carrito ({cartCount})
            </button>
            <button
              type="button"
              className={activeView === 'orders' ? 'home-desktop-nav-active' : ''}
              onClick={() => setActiveView('orders')}
            >
              Mis pedidos
            </button>
            {isAdmin ? (
              <button
                type="button"
                className={activeView === 'update' ? 'home-desktop-nav-active' : ''}
                onClick={() => setActiveView('update')}
              >
                Actualizar
              </button>
            ) : null}
          </nav>

          <div className="home-user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="home-user-trigger"
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-label="Abrir menu de usuario"
            >
              <UserRound size={18} />
            </button>
            {userMenuOpen ? (
              <div className="home-user-dropdown">
                <p>{user?.nombre || 'Usuario'}</p>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={14} />
                  Salir de la web
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {activeView === 'catalog' ? (
          <CatalogFeature
            products={visibleProducts}
            productsTotal={filteredProducts.length}
            loading={loading}
            loadingMore={productsLoadingMore}
            error={error}
            orderSuccess={orderSuccess}
            cartCount={cartCount}
            skeletonCount={skeletonCount}
            searchValue={searchTerm}
            categories={categories}
            activeCategory={activeCategory}
            points={Number(myProfile?.puntos_actuales || 0)}
            totalCompras={Number(myProfile?.total_compras || 0)}
            lastFetchMs={lastFetchMs}
            onSearchChange={setSearchTerm}
            onSelectCategory={setActiveCategory}
            onIncreaseProduct={increaseProduct}
            loadMoreSentinelRef={loadMoreSentinelRef}
          />
        ) : null}

        {activeView === 'cart' ? (
          <CartFeature
            items={cartList}
            total={cartTotal}
            orderNote={orderNote}
            savingOrder={savingOrder}
            onOrderNoteChange={setOrderNote}
            onIncreaseProduct={increaseProduct}
            onDecreaseProduct={decreaseProduct}
            onSubmitOrder={submitOrder}
          />
        ) : null}

        {activeView === 'orders' ? (
          <section className="orders-shell">
            <MyOrdersFeature orders={myOrders} loading={loading} />
          </section>
        ) : null}

        {activeView === 'update' ? (
          <InactiveProductsFeature
            loading={inactiveLoading}
            loadingMore={inactiveLoadingMore}
            hasMore={inactiveHasMore}
            error={inactiveError}
            items={inactiveProducts}
            total={inactiveProducts.length}
            onLoadMore={() => loadInactiveProductsPage()}
          />
        ) : null}

        <nav className="mobile-bottom-nav">
          <button
            type="button"
            className={activeView === 'catalog' ? 'mobile-bottom-nav-active' : ''}
            onClick={() => setActiveView('catalog')}
          >
            <House size={18} />
            <span>Inicio</span>
          </button>
          <button
            type="button"
            className={activeView === 'cart' ? 'mobile-bottom-nav-active' : ''}
            onClick={() => setActiveView('cart')}
          >
            <ShoppingCart size={18} />
            <span>
              Carrito
              {cartCount > 0 ? <small className="mobile-nav-badge">{cartCount}</small> : null}
            </span>
          </button>
          <button
            type="button"
            className={activeView === 'orders' ? 'mobile-bottom-nav-active' : ''}
            onClick={() => setActiveView('orders')}
          >
            <ClipboardList size={18} />
            <span>Mis pedidos</span>
          </button>
        </nav>
      </section>
    </main>
  );
}
