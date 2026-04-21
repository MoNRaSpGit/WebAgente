import { WebLoginCard } from '../features/auth/components/WebLoginCard.jsx';
import { HomeFeature } from '../features/home/HomeFeature.jsx';
import { WebAuthProvider, useWebAuth } from '../shared/auth/WebAuthProvider.jsx';

function AppLaunchScreen() {
  return (
    <main className="launch-shell">
      <section className="launch-card" aria-label="Cargando aplicacion">
        <div className="launch-logo-wrap">
          <span className="launch-logo-ring" />
          <span className="launch-logo">WP</span>
        </div>
        <h1>Web Piloto</h1>
        <p>Preparando tu espacio...</p>
        <div className="launch-loader" role="presentation">
          <span />
        </div>
      </section>
    </main>
  );
}

function AppContent() {
  const { loading, isAuthenticated } = useWebAuth();

  if (loading) {
    return <AppLaunchScreen />;
  }

  if (!isAuthenticated) {
    return (
      <main className="home-shell">
        <WebLoginCard />
      </main>
    );
  }

  return <HomeFeature />;
}

export default function App() {
  return (
    <WebAuthProvider>
      <AppContent />
    </WebAuthProvider>
  );
}
