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
import { fetchWebAdminProductById, updateWebAdminProduct } from '../../shared/api/productsApi.js';

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

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
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
  const [editingCategoryProductId, setEditingCategoryProductId] = useState(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState({
    nombre: '',
    precio_venta: '',
    categoria: '',
    imagen_base64: ''
  });
  const [editingCategoryOriginalValue, setEditingCategoryOriginalValue] = useState({
    nombre: '',
    precio_venta: '',
    categoria: ''
  });
  const [loadingEditProduct, setLoadingEditProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
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
  const editableCategories = useMemo(
    () => categories.filter((category) => category !== 'all' && category !== '__other__'),
    [categories]
  );
  const editableCategoriesWithCurrent = useMemo(() => {
    const next = new Set(editableCategories);
    const currentValue = String(editingCategoryOriginalValue?.categoria || '').trim();
    if (currentValue) {
      next.add(currentValue);
    }
    return Array.from(next);
  }, [editableCategories, editingCategoryOriginalValue]);
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

  function openEditProductCategory(product) {
    const productId = Number(product?.id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    const currentCategory = String(product?.categoria || '').trim();
    const currentName = String(product?.nombre || '').trim();
    const currentPrice = Number(product?.precio_venta || 0);
    setEditingCategoryProductId(productId);
    setEditingCategoryForm({
      nombre: currentName,
      precio_venta: String(Number(currentPrice).toFixed(2)),
      categoria: currentCategory,
      imagen_base64: ''
    });
    setEditingCategoryOriginalValue({
      nombre: currentName,
      precio_venta: Number(currentPrice).toFixed(2),
      categoria: currentCategory
    });
    setLoadingEditProduct(true);
    fetchWebAdminProductById(token, productId)
      .then((fresh) => {
        if (!fresh) {
          return;
        }
        const freshName = String(fresh?.nombre || '').trim();
        const freshPrice = Number(fresh?.precio_venta || 0);
        const freshCategory = String(fresh?.categoria || currentCategory).trim();
        setEditingCategoryForm((current) => ({
          ...current,
          nombre: freshName,
          precio_venta: String(Number(freshPrice).toFixed(2)),
          categoria: freshCategory
        }));
        setEditingCategoryOriginalValue({
          nombre: freshName,
          precio_venta: Number(freshPrice).toFixed(2),
          categoria: freshCategory
        });
      })
      .catch(() => {
        // Si no se puede refrescar el producto, seguimos con datos del catalogo.
      })
      .finally(() => {
        setLoadingEditProduct(false);
      });
  }

  function closeEditProductCategory(force = false) {
    if (savingCategory && !force) {
      return;
    }
    setEditingCategoryProductId(null);
    setEditingCategoryForm({
      nombre: '',
      precio_venta: '',
      categoria: '',
      imagen_base64: ''
    });
    setEditingCategoryOriginalValue({
      nombre: '',
      precio_venta: '',
      categoria: ''
    });
    setLoadingEditProduct(false);
  }

  async function handleEditProductImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const imageData = await toDataUrl(file);
      setEditingCategoryForm((current) => ({
        ...current,
        imagen_base64: imageData
      }));
    } catch (imageError) {
      setError(imageError.message || 'No se pudo leer la imagen');
    }
  }

  async function submitEditProductCategory() {
    const productId = Number(editingCategoryProductId || 0);
    const nextName = String(editingCategoryForm?.nombre || '').trim();
    const nextPriceText = String(editingCategoryForm?.precio_venta || '').trim();
    const nextCategory = String(editingCategoryForm?.categoria || '').trim();
    const nextImageBase64 = String(editingCategoryForm?.imagen_base64 || '').trim();
    const originalName = String(editingCategoryOriginalValue?.nombre || '').trim();
    const originalPrice = String(editingCategoryOriginalValue?.precio_venta || '').trim();
    const originalCategory = String(editingCategoryOriginalValue?.categoria || '').trim();
    const parsedPrice = Number(nextPriceText);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    if (!nextName) {
      setError('Nombre requerido');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Precio valido requerido');
      return;
    }
    if (!nextCategory) {
      setError('Categoria requerida');
      return;
    }

    const patch = {};
    if (nextName.toLowerCase() !== originalName.toLowerCase()) {
      patch.nombre = nextName;
    }
    if (Number(parsedPrice).toFixed(2) !== Number(originalPrice || 0).toFixed(2)) {
      patch.precio_venta = parsedPrice;
    }
    if (nextCategory.toLowerCase() !== originalCategory.toLowerCase()) {
      patch.categoria = nextCategory;
    }
    if (nextImageBase64) {
      patch.imagen_base64 = nextImageBase64;
    }

    if (Object.keys(patch).length === 0) {
      closeEditProductCategory();
      return;
    }

    try {
      setSavingCategory(true);
      await updateWebAdminProduct(token, productId, patch);
      applyLocalProductPatch(productId, {
        ...(patch.nombre ? { nombre: patch.nombre } : {}),
        ...(typeof patch.precio_venta === 'number' ? { precio_venta: patch.precio_venta } : {}),
        ...(patch.categoria ? { categoria: patch.categoria } : {}),
        ...(patch.imagen_base64 ? { has_local_image: true } : {})
      });
      closeEditProductCategory(true);
    } catch (updateError) {
      setError(updateError.message || 'No se pudo actualizar el producto');
    } finally {
      setSavingCategory(false);
    }
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
            onEditProductCategory={openEditProductCategory}
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

      {editingCategoryProductId ? (
        <div className="modal-backdrop" onClick={closeEditProductCategory}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Editar categoria</h3>
            <div className="modal-form">
              <label>
                Nombre
                <input
                  value={editingCategoryForm.nombre}
                  onChange={(event) => setEditingCategoryForm((current) => ({
                    ...current,
                    nombre: event.target.value
                  }))}
                  disabled={savingCategory || loadingEditProduct}
                />
              </label>
              <label>
                Precio
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editingCategoryForm.precio_venta}
                  onChange={(event) => setEditingCategoryForm((current) => ({
                    ...current,
                    precio_venta: event.target.value
                  }))}
                  disabled={savingCategory || loadingEditProduct}
                />
              </label>
              <label>
                Categoria
                <select
                  value={editingCategoryForm.categoria}
                  onChange={(event) => setEditingCategoryForm((current) => ({
                    ...current,
                    categoria: event.target.value
                  }))}
                  disabled={savingCategory || loadingEditProduct}
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
                  onChange={handleEditProductImageChange}
                  disabled={savingCategory || loadingEditProduct}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={closeEditProductCategory} disabled={savingCategory || loadingEditProduct}>
                  Cancelar
                </button>
                <button type="button" onClick={submitEditProductCategory} disabled={savingCategory || loadingEditProduct}>
                  {savingCategory ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
