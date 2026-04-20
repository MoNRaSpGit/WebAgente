export function CatalogFeature({
  userName,
  products,
  productsTotal,
  loading,
  loadingMore,
  error,
  orderSuccess,
  cartList,
  cartCount,
  cartTotal,
  orderNote,
  skeletonCount,
  savingOrder,
  searchValue,
  categories,
  activeCategory,
  points,
  totalCompras,
  onSearchChange,
  onSelectCategory,
  onOrderNoteChange,
  onIncreaseProduct,
  onDecreaseProduct,
  onSubmitOrder,
  onOpenOrders,
  onLogout,
  loadMoreSentinelRef
}) {
  return (
    <>
      <header className="store-nav">
        <div className="store-brand">
          <span className="store-brand-logo">WP</span>
          <div>
            <strong>Web Piloto</strong>
            <span className="store-brand-user">{userName}</span>
          </div>
        </div>

        <label className="store-search">
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar producto o categoria..."
          />
        </label>

        <div className="store-nav-actions">
          <button type="button" onClick={onOpenOrders}>Mis pedidos</button>
          <button type="button" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <section className="store-metrics">
        <p>Puntos: {points}</p>
        <p>Compras: {totalCompras}</p>
        <p>Productos: {productsTotal}</p>
        <p>Carrito: {cartCount}</p>
      </section>

      <section className="store-categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? 'category-active' : ''}
            onClick={() => onSelectCategory(category)}
          >
            {category === 'all' ? 'Todas' : category}
          </button>
        ))}
      </section>

      {loading ? <p>Cargando productos...</p> : null}
      {error ? <p className="home-error">{error}</p> : null}
      {orderSuccess ? <p className="home-success">{orderSuccess}</p> : null}

      <section className="cart-panel">
        <h2>Tu pedido</h2>
        {cartList.length === 0 ? <p>No agregaste productos todavia.</p> : null}
        {cartList.length > 0 ? (
          <ul className="cart-list">
            {cartList.map((item) => (
              <li key={item.product_id} className="cart-item">
                <strong>{item.product_name}</strong>
                <span>Cantidad: {item.quantity}</span>
                <span>Subtotal: ${(item.quantity * item.unit_price).toFixed(2)}</span>
                <div className="cart-actions">
                  <button
                    type="button"
                    onClick={() => onIncreaseProduct({
                      id: item.product_id,
                      nombre: item.product_name,
                      precio_venta: item.unit_price
                    })}
                  >
                    +
                  </button>
                  <button type="button" onClick={() => onDecreaseProduct(item.product_id)}>-</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <p>Total estimado: ${cartTotal.toFixed(2)}</p>
        <label className="order-note">
          Nota (opcional)
          <input
            value={orderNote}
            onChange={(event) => onOrderNoteChange(event.target.value)}
            placeholder="Ej: pasar despues de las 18:00"
          />
        </label>
        <button type="button" disabled={savingOrder || cartList.length === 0} onClick={onSubmitOrder}>
          {savingOrder ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </section>

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {products.map((product) => (
              <li key={product.id} className="product-card">
                <div className="product-card-image-wrap">
                  {product.image_local_url ? (
                    <img className="product-card-image" src={product.image_local_url} alt={product.nombre} loading="lazy" />
                  ) : (
                    <div className="product-card-image product-card-image--placeholder">Sin imagen</div>
                  )}
                </div>
                <strong className="product-card-name">{product.nombre}</strong>
                <span className="product-card-price">${Number(product.precio_venta || 0).toFixed(2)}</span>
                <button type="button" className="product-card-add" onClick={() => onIncreaseProduct(product)}>
                  Agregar
                </button>
              </li>
            ))}
          </ul>

          {skeletonCount > 0 ? (
            <ul className="products-grid">
              {Array.from({ length: skeletonCount }, (_, index) => (
                <li key={`skeleton-${index}`} className="product-card products-item-skeleton">
                  <div className="skeleton-line skeleton-image" />
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-button" />
                </li>
              ))}
            </ul>
          ) : null}

          <div ref={loadMoreSentinelRef} className="products-load-sentinel" />
          {loadingMore ? <p>Cargando mas productos...</p> : null}
        </>
      ) : null}
    </>
  );
}
