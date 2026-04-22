import { ClipboardList, House, RefreshCw, ShoppingCart } from 'lucide-react';

export function HomeMobileNav({ activeView, cartCount, onChangeView }) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        type="button"
        className={activeView === 'catalog' ? 'mobile-bottom-nav-active' : ''}
        onClick={() => onChangeView('catalog')}
      >
        <House size={18} />
        <span>Inicio</span>
      </button>
      <button
        type="button"
        className={activeView === 'cart' ? 'mobile-bottom-nav-active' : ''}
        onClick={() => onChangeView('cart')}
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
        onClick={() => onChangeView('orders')}
      >
        <ClipboardList size={18} />
        <span>Mis pedidos</span>
      </button>
      <button
        type="button"
        className={activeView === 'repeat' ? 'mobile-bottom-nav-active' : ''}
        onClick={() => onChangeView('repeat')}
      >
        <RefreshCw size={18} />
        <span>Historial</span>
      </button>
    </nav>
  );
}
