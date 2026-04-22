import { LogOut, UserRound } from 'lucide-react';

export function HomeTopbar({
  user,
  cartCount,
  isAdmin,
  activeView,
  onChangeView,
  onLogout,
  onSendWhatsappManual,
  userMenuOpen,
  onToggleUserMenu,
  onCloseUserMenu,
  userMenuRef,
  whatsappShiftLabel,
  onToggleWhatsappShift
}) {
  return (
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
          onClick={() => onChangeView('catalog')}
        >
          Inicio
        </button>
        <button
          type="button"
          className={activeView === 'cart' ? 'home-desktop-nav-active' : ''}
          onClick={() => onChangeView('cart')}
        >
          Carrito ({cartCount})
        </button>
        <button
          type="button"
          className={activeView === 'orders' ? 'home-desktop-nav-active' : ''}
          onClick={() => onChangeView('orders')}
        >
          Mis pedidos
        </button>
        {isAdmin ? (
          <button
            type="button"
            className={activeView === 'update' ? 'home-desktop-nav-active' : ''}
            onClick={() => onChangeView('update')}
          >
            Actualizar
          </button>
        ) : null}
      </nav>

      <div className="home-user-menu" ref={userMenuRef}>
        <button
          type="button"
          className="home-user-trigger"
          onClick={onToggleUserMenu}
          aria-label="Abrir menu de usuario"
        >
          <UserRound size={18} />
        </button>
        {userMenuOpen ? (
          <div className="home-user-dropdown">
            <p>{user?.nombre || 'Usuario'}</p>
            {isAdmin ? (
              <button
                type="button"
                className="home-user-dropdown-manual"
                onClick={() => {
                  onCloseUserMenu();
                  onToggleWhatsappShift?.();
                }}
              >
                Turno: {whatsappShiftLabel || 'Mañana'}
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className="home-user-dropdown-manual"
                onClick={() => {
                  onCloseUserMenu();
                  onSendWhatsappManual?.();
                }}
              >
                Probar WhatsApp (manual)
              </button>
            ) : null}
            <button
              type="button"
              className="home-user-dropdown-logout"
              onClick={() => {
                onCloseUserMenu();
                onLogout();
              }}
            >
              <LogOut size={14} />
              Salir de la web
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
