import { useEffect, useMemo, useRef, useState } from 'react';
import { CatalogFeature } from '../../features/catalog/CatalogFeature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { CartFeature } from '../../features/orders/CartFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { createWebOrder, hideMyWebOrder } from '../../shared/api/webOrdersApi.js';
import { sendWebWhatsappTest } from '../../shared/api/webNotificationsApi.js';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';
import { HomeMobileNav } from './components/HomeMobileNav.jsx';
import { HomeTopbar } from './components/HomeTopbar.jsx';
import { useCatalogData } from './hooks/useCatalogData.js';
import { useInactiveProducts } from './hooks/useInactiveProducts.js';
import { useMyOrdersRealtime } from './hooks/useMyOrdersRealtime.js';

export function HomeFeature() {
  const { profile, user, token, logout } = useWebAuth();
  const manualWhatsappTo = String(import.meta.env.VITE_WHATSAPP_MANUAL_TO || '').replace(/[^\d]/g, '');

  const [myOrders, setMyOrders] = useState([]);
  const [myProfile, setMyProfile] = useState(profile || null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [cartItems, setCartItems] = useState({});
  const [activeView, setActiveView] = useState('catalog');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sendingWhatsappTest, setSendingWhatsappTest] = useState(false);
  const userMenuRef = useRef(null);

  const {
    loading,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    categories,
    lastFetchMs,
    productsLoadingMore,
    filteredProducts,
    visibleProducts,
    loadMoreSentinelRef
  } = useCatalogData({
    token,
    activeView,
    onBootstrapOrders: setMyOrders,
    onBootstrapProfile: setMyProfile
  });

  const cartList = Object.values(cartItems);
  const cartTotal = cartList.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );
  const cartCount = cartList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartProductIds = useMemo(
    () => new Set(Object.keys(cartItems).map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0)),
    [cartItems]
  );
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const {
    inactiveProducts,
    inactiveTotal,
    inactiveHasMore,
    inactiveLoading,
    inactiveLoadingMore,
    inactiveError,
    loadInactiveProductsPage
  } = useInactiveProducts(activeView, isAdmin);

  useMyOrdersRealtime({ activeView, token, setMyOrders });

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

  useEffect(() => {
    if (!isAdmin && activeView === 'update') {
      setActiveView('catalog');
    }
  }, [activeView, isAdmin]);

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
      setActiveView('orders');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleHideOrder(orderId) {
    const parsedOrderId = Number(orderId);
    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
      return;
    }

    try {
      await hideMyWebOrder(token, parsedOrderId);
      setMyOrders((current) => current.filter((item) => Number(item.id) !== parsedOrderId));
    } catch (hideError) {
      setError(hideError.message || 'No se pudo ocultar el pedido');
    }
  }

  async function handleSendWhatsappTest() {
    if (!isAdmin || !token || sendingWhatsappTest) {
      return;
    }

    setSendingWhatsappTest(true);
    try {
      const result = await sendWebWhatsappTest(token, { message: 'hola desde la web' });
      const to = String(result?.to || '');
      window.alert(to ? `WhatsApp de prueba enviado a ${to}` : 'WhatsApp de prueba enviado');
    } catch (sendError) {
      setError(sendError.message || 'No se pudo enviar WhatsApp de prueba');
    } finally {
      setSendingWhatsappTest(false);
    }
  }

  function handleSendWhatsappManual() {
    if (!manualWhatsappTo) {
      setError('Configura VITE_WHATSAPP_MANUAL_TO en WebAgente/.env');
      return;
    }

    const message = encodeURIComponent('hola desde la web');
    const url = `https://wa.me/${manualWhatsappTo}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="home-shell">
      <section className="home-card home-card--wide">
        <HomeTopbar
          user={user}
          cartCount={cartCount}
          isAdmin={isAdmin}
          activeView={activeView}
          onChangeView={setActiveView}
          onLogout={logout}
          userMenuOpen={userMenuOpen}
          onToggleUserMenu={() => setUserMenuOpen((current) => !current)}
          onCloseUserMenu={() => setUserMenuOpen(false)}
          userMenuRef={userMenuRef}
          onSendWhatsappTest={handleSendWhatsappTest}
          onSendWhatsappManual={handleSendWhatsappManual}
          sendingWhatsappTest={sendingWhatsappTest}
        />

        {activeView === 'catalog' ? (
          <CatalogFeature
            products={visibleProducts}
            productsTotal={filteredProducts.length}
            loading={loading}
            loadingMore={productsLoadingMore}
            error={error}
            cartCount={cartCount}
            searchValue={searchTerm}
            categories={categories}
            activeCategory={activeCategory}
            points={Number(myProfile?.puntos_actuales || 0)}
            totalCompras={Number(myProfile?.total_compras || 0)}
            lastFetchMs={lastFetchMs}
            selectedProductIds={cartProductIds}
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
            <MyOrdersFeature
              orders={myOrders}
              loading={loading}
              onHideOrder={handleHideOrder}
            />
          </section>
        ) : null}

        {activeView === 'update' ? (
          <InactiveProductsFeature
            token={token}
            loading={inactiveLoading}
            loadingMore={inactiveLoadingMore}
            hasMore={inactiveHasMore}
            error={inactiveError}
            items={inactiveProducts}
            total={inactiveTotal}
            onLoadMore={(options) => loadInactiveProductsPage(options)}
          />
        ) : null}

        <HomeMobileNav
          activeView={activeView}
          cartCount={cartCount}
          onChangeView={setActiveView}
        />
      </section>
    </main>
  );
}
