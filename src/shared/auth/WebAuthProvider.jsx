import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchWebProfile, loginWebUser, registerWebUser } from '../api/webAuthApi.js';
import { clearWebSession, loadWebSession, saveWebSession } from './webSession.js';
import { clearRememberedCredentials, getRememberPreference } from './webRememberedCredentials.js';

const WebAuthContext = createContext(null);

export function WebAuthProvider({ children }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const session = loadWebSession();

      if (!session?.token) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchWebProfile(session.token);

        if (!mounted) {
          return;
        }

        setToken(session.token);
        setUser(data.user);
        setProfile(data.profile || null);
        saveWebSession({ token: session.token, user: data.user, profile: data.profile || null });
      } catch {
        clearWebSession();
        if (mounted) {
          setToken('');
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    profile,
    loading,
    isAuthenticated: Boolean(token && user),
    async login(credentials) {
      const data = await loginWebUser(credentials);
      const session = { token: data.token, user: data.user, profile: data.profile || null };
      setToken(session.token);
      setUser(session.user);
      setProfile(session.profile);
      saveWebSession(session);
      return session;
    },
    async register(payload) {
      const data = await registerWebUser(payload);
      const session = { token: data.token, user: data.user, profile: data.profile || null };
      setToken(session.token);
      setUser(session.user);
      setProfile(session.profile);
      saveWebSession(session);
      return session;
    },
    logout() {
      setToken('');
      setUser(null);
      setProfile(null);
      clearWebSession();

      if (!getRememberPreference()) {
        clearRememberedCredentials();
      }
    }
  }), [loading, profile, token, user]);

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth() {
  const context = useContext(WebAuthContext);

  if (!context) {
    throw new Error('useWebAuth debe usarse dentro de WebAuthProvider');
  }

  return context;
}
