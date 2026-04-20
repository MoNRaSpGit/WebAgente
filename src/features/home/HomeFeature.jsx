import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogFeature } from '../../features/catalog/CatalogFeature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { fetchWebInactiveProducts, fetchWebProducts } from '../../shared/api/productsApi.js';
import { createWebOrder, fetchMyWebOrders } from '../../shared/api/webOrdersApi.js';
import { fetchMyWebProfile } from '../../shared/api/webUsersApi.js';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';

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
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveError, setInactiveError] = useState('');
  const loadMoreSentinelRef = useRef(null);
  const loadNextPageRef = useRef(null);

  const cartList = Object.values(cartItems);
  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const categories = useMemo(() => {
    const uniqueByNormalized = new Map();
    for (const item of products) {
      const rawCategory = String(item.categoria || '').trim();
      if (!rawCategory) {
        continue;
      }
      const normalized = rawCategory.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalized) {
        continue;
      }
      if (!uniqueByNormalized.has(normalized)) {
        uniqueByNormalized.set(normalized, rawCategory);
      }
    }
    return ['all', ...Array.from(uniqueByNormalized.values()).sort((a, b) => a.localeCompare(b))];
  }, [products]);
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

  const loadNextProductsPage = useCallback(async ({ silent = false } = {}) => {
    if (!productsHasMore || productsLoadingMore) {
      return;
    }

    setProductsLoadingMore(true);

    try {
      const result = await fetchWebProducts({
        limit: 50,
        offset: productsOffset
      });

      setProducts((current) => {
        if (productsOffset === 0) {
          return result.items;
        }

        return [...current, ...result.items];
      });

      setProductsOffset((current) => current + result.items.length);
      setProductsHasMore(Boolean(result.page?.has_more));
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      }
    } finally {
      setProductsLoadingMore(false);
    }
  }, [productsHasMore, productsLoadingMore, productsOffset]);

  loadNextPageRef.current = loadNextProductsPage;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [productsResult, orders] = await Promise.all([
          fetchWebProducts({ limit: 50, offset: 0 }),
          fetchMyWebOrders(token, 20)
        ]);
        const profileData = await fetchMyWebProfile(token);

        if (mounted) {
          setProducts(productsResult.items);
          setProductsOffset(productsResult.items.length);
          setProductsHasMore(Boolean(productsResult.page?.has_more));
          setVisibleProductsCount(9);
          setMyOrders(orders);
          setMyProfile(profileData);
          setError('');
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
    }, 1400);

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
    let mounted = true;

    async function loadInactive() {
      if (activeView !== 'update') {
        return;
      }

      setInactiveLoading(true);
      setInactiveError('');

      try {
        const result = await fetchWebInactiveProducts({ limit: 200, offset: 0 });
        if (mounted) {
          setInactiveProducts(result.items);
        }
      } catch (loadError) {
        if (mounted) {
          setInactiveError(loadError.message);
        }
      } finally {
        if (mounted) {
          setInactiveLoading(false);
        }
      }
    }

    loadInactive();

    return () => {
      mounted = false;
    };
  }, [activeView]);

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
            error={inactiveError}
            items={inactiveProducts}
            total={inactiveProducts.length}
          />
        ) : null}

      </section>
    </main>
  );
}
