import { WebLoginCard } from '../features/auth/components/WebLoginCard.jsx';
import { HomeFeature } from '../features/home/HomeFeature.jsx';
import { WebAuthProvider, useWebAuth } from '../shared/auth/WebAuthProvider.jsx';

function AppContent() {
  const { loading, isAuthenticated } = useWebAuth();

  if (loading) {
    return (
      <main className="home-shell">
        <section className="home-card">
          <p>Validando sesion web...</p>
        </section>
      </main>
    );
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
