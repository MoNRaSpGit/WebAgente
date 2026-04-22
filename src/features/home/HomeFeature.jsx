import { useEffect, useMemo, useRef, useState } from 'react';
import { CatalogV2Feature } from '../../features/catalogV2/CatalogV2Feature.jsx';
import { InactiveProductsFeature } from '../../features/catalog/InactiveProductsFeature.jsx';
import { CartFeature } from '../../features/orders/CartFeature.jsx';
import { MyOrdersFeature } from '../../features/orders/MyOrdersFeature.jsx';
import { RepeatOrdersFeature } from '../../features/orders/RepeatOrdersFeature.jsx';
import { useWebAuth } from '../../shared/auth/WebAuthProvider.jsx';
import { HomeMobileNav } from './components/HomeMobileNav.jsx';
import { HomeTopbar } from './components/HomeTopbar.jsx';
import { useCatalogDataV2 } from '../../features/catalogV2/hooks/useCatalogDataV2.js';
import { useInactiveProducts } from './hooks/useInactiveProducts.js';
import { useMyOrdersRealtime } from './hooks/useMyOrdersRealtime.js';
import { useAdminProductEditor } from './hooks/useAdminProductEditor.js';
import { useCheckoutOrderFlow } from './hooks/useCheckoutOrderFlow.js';
import { fetchMyRepeatProducts } from '../../shared/api/webOrdersApi.js';

const CHECKOUT_PREFS_KEY_PREFIX = 'webagente.checkoutPrefs.v1';
const WHATSAPP_SHIFT_KEY = 'webagente.whatsapp.shift.v1';
const WHATSAPP_MORNING_RAW = '099831303';
const WHATSAPP_NIGHT_RAW = '092945696';

function normalizeUyWhatsappNumber(rawValue) {
  const digits = String(rawValue || '').replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('598')) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return `598${digits.slice(1)}`;
  }
  if (digits.length === 8 && digits.startsWith('9')) {
    return `598${digits}`;
  }

  return digits;
}

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
  const [activeWhatsappShift, setActiveWhatsappShift] = useState('night');
  const [repeatProducts, setRepeatProducts] = useState([]);
  const [repeatLoading, setRepeatLoading] = useState(false);

  const [myOrders, setMyOrders] = useState([]);
  const [myProfile, setMyProfile] = useState(profile || null);
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
    prefetchedImageMap,
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
  const whatsappTarget = useMemo(
    () => normalizeUyWhatsappNumber(activeWhatsappShift === 'night' ? WHATSAPP_NIGHT_RAW : WHATSAPP_MORNING_RAW),
    [activeWhatsappShift]
  );
  const whatsappShiftLabel = activeWhatsappShift === 'night' ? 'Noche' : 'Mañana';
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
    savingOrder,
    submitOrder,
    handleHideOrder,
    handleSendWhatsappManual
  } = useCheckoutOrderFlow({
    token,
    user,
    manualWhatsappTo: whatsappTarget,
    setError,
    setMyOrders,
    setMyProfile,
    setCartItems,
    setActiveView
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
    if (typeof window === 'undefined') {
      return;
    }
    const saved = String(window.localStorage.getItem(WHATSAPP_SHIFT_KEY) || '').trim().toLowerCase();
    if (saved === 'night' || saved === 'morning') {
      setActiveWhatsappShift(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(WHATSAPP_SHIFT_KEY, activeWhatsappShift);
  }, [activeWhatsappShift]);

  useEffect(() => {
    if (!isAdmin && activeView === 'update') {
      setActiveView('catalog');
    }
  }, [activeView, isAdmin]);

  useEffect(() => {
    if (activeView !== 'repeat' || !token) {
      return;
    }

    let cancelled = false;
    setRepeatLoading(true);

    fetchMyRepeatProducts(token, 10)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setRepeatProducts(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setError(error.message || 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (!cancelled) {
          setRepeatLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, setError, token]);

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

  function addRecentProductToCart(product) {
    const productId = Number(product?.product_id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    increaseProduct({
      id: productId,
      nombre: String(product?.product_name || '').trim(),
      precio_venta: Number(product?.unit_price || 0),
      has_local_image: false
    });
  }

  function addAllRecentProductsToCart(products = []) {
    for (const product of products) {
      addRecentProductToCart(product);
    }
    setActiveView('cart');
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
          whatsappShiftLabel={whatsappShiftLabel}
          onToggleWhatsappShift={() => setActiveWhatsappShift((current) => (current === 'morning' ? 'night' : 'morning'))}
        />

        {activeView === 'catalog' ? (
          <CatalogV2Feature
            products={visibleProducts}
            productsTotal={filteredProducts.length}
            prefetchedImageMap={prefetchedImageMap}
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
            onSubmitOrder={() => submitOrder({
              cartList,
              paymentMethod,
              deliveryMode,
              hasEnoughPoints,
              canUseDelivery
            })}
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

        {activeView === 'repeat' ? (
          <section className="orders-shell">
            <RepeatOrdersFeature
              products={repeatProducts}
              loading={repeatLoading}
              onGoCatalog={() => setActiveView('catalog')}
              onAddAllProducts={addAllRecentProductsToCart}
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
            <h3>Editar producto</h3>
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
                Estado
                <select
                  value={editingForm.estado}
                  onChange={(event) => setEditingForm((current) => ({
                    ...current,
                    estado: event.target.value
                  }))}
                  disabled={savingEditProduct || loadingEditProduct}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
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
