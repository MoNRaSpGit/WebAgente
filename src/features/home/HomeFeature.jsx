import { useEffect, useMemo, useRef, useState } from 'react';
import { CatalogV2Feature } from '../../features/catalogV2/CatalogV2Feature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { CartFeature } from '../../features/orders/CartFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { createWebOrder, hideMyWebOrder } from '../../shared/api/webOrdersApi.js';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';
import { HomeMobileNav } from './components/HomeMobileNav.jsx';
import { HomeTopbar } from './components/HomeTopbar.jsx';
import { useCatalogDataV2 } from '../../features/catalogV2/hooks/useCatalogDataV2.js';
import { useInactiveProducts } from './hooks/useInactiveProducts.js';
import { useMyOrdersRealtime } from './hooks/useMyOrdersRealtime.js';
import { useAdminProductEditor } from './hooks/useAdminProductEditor.js';

const CHECKOUT_PREFS_KEY_PREFIX = 'webagente.checkoutPrefs.v1';

function buildCheckoutPrefsKey(userId) {
  const parsedId = Number(userId || 0);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return '';
  }
  return `${CHECKOUT_PREFS_KEY_PREFIX}.${parsedId}`;
}

function loadCheckoutPrefs(userId) {
  const key = buildCheckoutPrefsKey(userId);
  if (!key || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      payment_method: String(parsed?.payment_method || '').trim().toLowerCase(),
      delivery_mode: String(parsed?.delivery_mode || '').trim().toLowerCase()
    };
  } catch {
    return null;
  }
}

function saveCheckoutPrefs(userId, paymentMethod, deliveryMode) {
  const key = buildCheckoutPrefsKey(userId);
  if (!key || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        payment_method: String(paymentMethod || '').trim().toLowerCase(),
        delivery_mode: String(deliveryMode || '').trim().toLowerCase()
      })
    );
  } catch {
    // no-op: si localStorage no esta disponible, no rompemos el flujo.
  }
}

export function HomeFeature() {
  const { profile, user, token, logout } = useWebAuth();
  const manualWhatsappTo = String(import.meta.env.VITE_WHATSAPP_MANUAL_TO || '').replace(/[^\d]/g, '');

  const [myOrders, setMyOrders] = useState([]);
  const [myProfile, setMyProfile] = useState(profile || null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [cartItems, setCartItems] = useState({});
  const [activeView, setActiveView] = useState('catalog');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [deliveryMode, setDeliveryMode] = useState('pickup');
  const userMenuRef = useRef(null);
  const deliveryEnabled = true;

  const {
    loading,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    categories,
    productsLoadingMore,
    filteredProducts,
    visibleProducts,
    loadMoreSentinelRef,
    applyLocalProductPatch
  } = useCatalogDataV2({
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
  const userPoints = Number(myProfile?.puntos_actuales || 0);
  const cartProductIds = useMemo(
    () => new Set(Object.keys(cartItems).map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0)),
    [cartItems]
  );
  const canUseDelivery = deliveryEnabled && cartTotal >= 200;
  const pointsRequired = Math.ceil(cartTotal);
  const hasEnoughPoints = userPoints >= pointsRequired;
  const canSubmitOrder = cartList.length > 0
    && Boolean(paymentMethod)
    && Boolean(deliveryMode)
    && (paymentMethod !== 'puntos' || hasEnoughPoints)
    && (deliveryMode !== 'delivery' || canUseDelivery);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const {
    editingProductId,
    editingForm,
    setEditingForm,
    loadingEditProduct,
    savingEditProduct,
    editableCategoriesWithCurrent,
    openEditor,
    closeEditor,
    onImageChange,
    submitEditor
  } = useAdminProductEditor({
    token,
    categories,
    applyLocalProductPatch,
    setError
  });
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
    const prefs = loadCheckoutPrefs(user?.id);
    if (!prefs) {
      return;
    }

    const allowedPayments = new Set(['pos', 'efectivo', 'cuenta', 'puntos']);
    const allowedDeliveryModes = new Set(['delivery', 'pickup']);

    if (allowedPayments.has(prefs.payment_method)) {
      setPaymentMethod(prefs.payment_method);
    }
    if (allowedDeliveryModes.has(prefs.delivery_mode)) {
      setDeliveryMode(prefs.delivery_mode);
    }
  }, [user?.id]);

  useEffect(() => {
    saveCheckoutPrefs(user?.id, paymentMethod, deliveryMode);
  }, [deliveryMode, paymentMethod, user?.id]);

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
    if (!paymentMethod) {
      setError('Selecciona un tipo de pago');
      return;
    }
    if (!deliveryMode) {
      setError('Selecciona tipo de entrega');
      return;
    }
    if (paymentMethod === 'puntos' && !hasEnoughPoints) {
      setError('No tiene puntos suficiente');
      return;
    }
    if (deliveryMode === 'delivery' && !canUseDelivery) {
      setError('Delivery habilitado con compra igual o mayor a $200');
      return;
    }

    setSavingOrder(true);
    setError('');

    try {
      const payload = {
        notes: '',
        payment_method: paymentMethod,
        delivery_mode: deliveryMode,
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
      sendOrderToWhatsappManual(createdOrder, cartList, '', paymentMethod, deliveryMode);

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

  function handleSendWhatsappManual() {
    if (!manualWhatsappTo) {
      setError('Configura VITE_WHATSAPP_MANUAL_TO en WebAgente/.env');
      return;
    }

    const message = encodeURIComponent('hola desde la web');
    const url = `https://wa.me/${manualWhatsappTo}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function sendOrderToWhatsappManual(order, items, note, payment, delivery) {
    if (!manualWhatsappTo || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const customer = String(user?.nombre || user?.email || 'Cliente').trim();
    const itemsText = items
      .map((item) => `- ${Number(item.quantity || 0)} x ${String(item.product_name || 'Producto').trim()}`)
      .join('\n');
    const noteText = String(note || '').trim();
    const paymentText = String(payment || '').trim();
    const deliveryText = String(delivery || '').trim();
    const paymentLabelMap = {
      pos: 'POS',
      efectivo: 'Efectivo',
      cuenta: 'Cuenta',
      puntos: 'Puntos'
    };
    const deliveryLabelMap = {
      delivery: 'Delivery',
      pickup: 'Yo voy'
    };

    const lines = [
      'Nuevo pedido web',
      `Cliente: ${customer}`,
      `Pago: ${paymentLabelMap[paymentText] || paymentText || '-'}`,
      `Entrega: ${deliveryLabelMap[deliveryText] || deliveryText || '-'}`,
      '',
      'Detalle:',
      itemsText
    ];

    if (noteText) {
      lines.push('', `Nota: ${noteText}`);
    }

    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${manualWhatsappTo}?text=${text}`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      // El pedido ya fue guardado correctamente; si el navegador bloquea el popup
      // evitamos mostrarlo como error global para no confundir al usuario.
      console.warn('[web-order] WhatsApp popup bloqueado por el navegador');
    }
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
          onSendWhatsappManual={handleSendWhatsappManual}
        />

        {activeView === 'catalog' ? (
          <CatalogV2Feature
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
            deliveryEnabled={deliveryEnabled}
            isAdmin={isAdmin}
            selectedProductIds={cartProductIds}
            onSearchChange={setSearchTerm}
            onSelectCategory={setActiveCategory}
            onIncreaseProduct={increaseProduct}
            onEditProductCategory={openEditor}
            loadMoreSentinelRef={loadMoreSentinelRef}
          />
        ) : null}

        {activeView === 'cart' ? (
          <CartFeature
            items={cartList}
            total={cartTotal}
            paymentMethod={paymentMethod}
            deliveryMode={deliveryMode}
            userPoints={userPoints}
            deliveryEnabled={canUseDelivery}
            canSubmit={canSubmitOrder}
            savingOrder={savingOrder}
            onSelectPaymentMethod={setPaymentMethod}
            onSelectDeliveryMode={setDeliveryMode}
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

      {editingProductId ? (
        <div className="modal-backdrop" onClick={closeEditor}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Editar categoria</h3>
            <div className="modal-form">
              <label>
                Nombre
                <input
                  value={editingForm.nombre}
                  onChange={(event) => setEditingForm((current) => ({
                    ...current,
                    nombre: event.target.value
                  }))}
                  disabled={savingEditProduct || loadingEditProduct}
                />
              </label>
              <label>
                Precio
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editingForm.precio_venta}
                  onChange={(event) => setEditingForm((current) => ({
                    ...current,
                    precio_venta: event.target.value
                  }))}
                  disabled={savingEditProduct || loadingEditProduct}
                />
              </label>
              <label>
                Categoria
                <select
                  value={editingForm.categoria}
                  onChange={(event) => setEditingForm((current) => ({
                    ...current,
                    categoria: event.target.value
                  }))}
                  disabled={savingEditProduct || loadingEditProduct}
                >
                  <option value="">Seleccionar categoria</option>
                  {editableCategoriesWithCurrent.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  disabled={savingEditProduct || loadingEditProduct}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={closeEditor} disabled={savingEditProduct || loadingEditProduct}>
                  Cancelar
                </button>
                <button type="button" onClick={submitEditor} disabled={savingEditProduct || loadingEditProduct}>
                  {savingEditProduct ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
