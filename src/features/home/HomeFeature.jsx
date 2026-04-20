import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogFeature } from '../../features/catalog/CatalogFeature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { fetchWebCategories, fetchWebInactiveProducts, fetchWebProducts } from '../../shared/api/productsApi.js';
import { createWebOrder, fetchMyWebOrders } from '../../shared/api/webOrdersApi.js';
import { fetchMyWebProfile } from '../../shared/api/webUsersApi.js';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';

const WEB_PRODUCTS_PAGE_LIMIT = 500;
const WEB_INACTIVE_PRODUCTS_PAGE_LIMIT = 200;

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
  const [activeCategory, setActiveCategory] = useState('all');
  const [lastFetchMs, setLastFetchMs] = useState(0);
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [inactiveOffset, setInactiveOffset] = useState(0);
  const [inactiveHasMore, setInactiveHasMore] = useState(true);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveLoadingMore, setInactiveLoadingMore] = useState(false);
  const [inactiveError, setInactiveError] = useState('');
  const [knownCategories, setKnownCategories] = useState([]);
  const loadMoreSentinelRef = useRef(null);
  const loadNextPageRef = useRef(null);
  const hasBootstrappedRef = useRef(false);
  const skipFirstCategoryReloadRef = useRef(true);
  const productCacheByCategoryRef = useRef(new Map());

  const cartList = Object.values(cartItems);
  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const normalizedActiveCategory = useMemo(
    () => (activeCategory === 'all'
      ? ''
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim()),
    [activeCategory]
  );

  const categories = useMemo(() => ['all', ...knownCategories], [knownCategories]);
  const filteredProducts = useMemo(() => {
    const activeCategoryNormalized = activeCategory === 'all'
      ? 'all'
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim();

    return products.filter((item) => {
      const itemCategoryNormalized = String(item.categoria || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (activeCategoryNormalized !== 'all' && itemCategoryNormalized !== activeCategoryNormalized) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const name = String(item.nombre || '').toLowerCase();
      const category = String(item.categoria || '').toLowerCase();
      return name.includes(normalizedSearch) || category.includes(normalizedSearch);
    });
  }, [activeCategory, normalizedSearch, products]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );
  const skeletonCount = loading ? 9 : (productsLoadingMore ? 3 : 0);

  const cartTotal = cartList.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );

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
        const [productsResult, orders, profileData, categoriesData] = await Promise.all([
          fetchWebProducts({ limit: WEB_PRODUCTS_PAGE_LIMIT, offset: 0, category: '' }),
          fetchMyWebOrders(token, 20),
          fetchMyWebProfile(token),
          fetchWebCategories({ status: 'activo' })
        ]);

        if (mounted) {
          setProducts(productsResult.items);
          setProductsOffset(productsResult.items.length);
          setProductsHasMore(Boolean(productsResult.page?.has_more));
          productCacheByCategoryRef.current.set('', {
            items: productsResult.items,
            offset: productsResult.items.length,
            hasMore: Boolean(productsResult.page?.has_more)
          });
          setKnownCategories([...categoriesData].sort((a, b) => a.localeCompare(b)));
          setVisibleProductsCount(9);
          setMyOrders(orders);
          setMyProfile(profileData);
          setError('');
          hasBootstrappedRef.current = true;
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
        }
      } finally {
        if (mounted) {
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
      setActiveCategory('all');
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

  function increaseProduct(product) {
    setCartItems((current) => {
      const key = String(product.id);
      const existing = current[key];
      const quantity = existing ? existing.quantity + 1 : 1;

      return {
        ...current,
        [key]: {
          product_id: Number(product.id),
          product_name: product.nombre,
          unit_price: Number(product.precio_venta || 0),
          quantity
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
      const [refreshedOrders, refreshedProfile] = await Promise.all([
        fetchMyWebOrders(token, 20),
        fetchMyWebProfile(token)
      ]);

      setMyOrders(refreshedOrders);
      setMyProfile(refreshedProfile);
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
        <nav className="classic-nav">
          <button
            type="button"
            className={activeView === 'catalog' ? 'classic-nav-active' : ''}
            onClick={() => setActiveView('catalog')}
          >
            Productos
          </button>
          <button
            type="button"
            className={activeView === 'update' ? 'classic-nav-active' : ''}
            onClick={() => setActiveView('update')}
          >
            Actualizar
          </button>
        </nav>

        {activeView === 'catalog' ? (
          <CatalogFeature
            userName={user?.nombre || user?.email}
            products={visibleProducts}
            productsTotal={filteredProducts.length}
            loading={loading}
            loadingMore={productsLoadingMore}
            error={error}
            orderSuccess={orderSuccess}
            cartList={cartList}
            cartCount={cartList.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
            cartTotal={cartTotal}
            orderNote={orderNote}
            skeletonCount={skeletonCount}
            savingOrder={savingOrder}
            searchValue={searchTerm}
            categories={categories}
            activeCategory={activeCategory}
            points={Number(myProfile?.puntos_actuales || 0)}
            totalCompras={Number(myProfile?.total_compras || 0)}
            lastFetchMs={lastFetchMs}
            onSearchChange={setSearchTerm}
            onSelectCategory={setActiveCategory}
            onOrderNoteChange={setOrderNote}
            onIncreaseProduct={increaseProduct}
            onDecreaseProduct={decreaseProduct}
            onSubmitOrder={submitOrder}
            onOpenOrders={() => setActiveView('orders')}
            onLogout={logout}
            loadMoreSentinelRef={loadMoreSentinelRef}
          />
        ) : null}

        {activeView === 'orders' ? (
          <section className="orders-shell">
            <div className="orders-shell-header">
              <button type="button" onClick={() => setActiveView('catalog')}>Volver al catalogo</button>
              <button type="button" onClick={logout}>Cerrar sesion</button>
            </div>
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

      </section>
    </main>
  );
}
