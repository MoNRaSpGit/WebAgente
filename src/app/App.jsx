import { useEffect, useRef, useState } from 'react';
import { WebLoginCard } from '../features/auth/components/WebLoginCard.jsx';
import { HomeFeature } from '../features/home/HomeFeature.jsx';
import { WebAuthProvider, useWebAuth } from '../shared/auth/WebAuthProvider.jsx';

const SPLASH_MIN_VISIBLE_MS = 4000;
const SPLASH_BRAND_DELAY_MS = 1200;

function AppLaunchScreen({ overlay = false, showBrand = false }) {
  const className = overlay ? 'launch-shell launch-shell--overlay' : 'launch-shell';
  const iconSrc = `${import.meta.env.BASE_URL}icons/icon-192.png`;

  if (!showBrand) {
    return <main className={className} aria-hidden="true" />;
  }

  return (
    <main className={className}>
      <section className="launch-brand" aria-label="Cargando aplicacion">
        <img className="launch-brand-icon" src={iconSrc} alt="Web Piloto" />
        <h1>Web Piloto</h1>
        <p>Preparando tu espacio...</p>
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
