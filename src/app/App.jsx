import { useEffect, useRef, useState } from 'react';
import { WebLoginCard } from '../features/auth/components/WebLoginCard.jsx';
import { HomeFeature } from '../features/home/HomeFeature.jsx';
import { WebAuthProvider, useWebAuth } from '../shared/auth/WebAuthProvider.jsx';

const SPLASH_MIN_VISIBLE_MS = 4000;
const SPLASH_BRAND_DELAY_MS = 1200;

function AppLaunchScreen({ overlay = false, showBrand = false }) {
  const className = overlay ? 'launch-shell launch-shell--overlay' : 'launch-shell';

  if (!showBrand) {
    return <main className={className} aria-hidden="true" />;
  }

  return (
    <main className={className}>
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
  const [showLaunch, setShowLaunch] = useState(true);
  const [showBrand, setShowBrand] = useState(false);
  const splashStartedAt = useRef(Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowBrand(true);
    }, SPLASH_BRAND_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const elapsed = Date.now() - splashStartedAt.current;
    const remaining = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed);
    const timeout = window.setTimeout(() => {
      setShowLaunch(false);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [loading]);

  const content = isAuthenticated ? (
    <HomeFeature />
  ) : (
    <main className="home-shell">
      <WebLoginCard />
    </main>
  );

  return (
    <>
      {content}
      {showLaunch ? <AppLaunchScreen overlay showBrand={showBrand} /> : null}
    </>
  );
}

export default function App() {
  return (
    <WebAuthProvider>
      <AppContent />
    </WebAuthProvider>
  );
}
