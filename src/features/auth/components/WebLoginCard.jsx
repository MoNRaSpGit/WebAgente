import { useEffect, useState } from 'react';
import { useWebAuth } from '../../../shared/auth/WebAuthProvider.jsx';
import { evaluatePassword } from '../authPasswordPolicy.js';
import {
  clearRememberedCredentials,
  getRememberPreference,
  loadRememberedCredentials,
  saveRememberedCredentials,
  setRememberPreference
} from '../../../shared/auth/webRememberedCredentials.js';

const DEFAULT_WEB_USER_NAME =
  import.meta.env.VITE_WEB_DEFAULT_ADMIN_NAME ||
  import.meta.env.VITE_WEB_DEFAULT_USER_NAME ||
  'admin';
const DEFAULT_WEB_USER_PASSWORD =
  import.meta.env.VITE_WEB_DEFAULT_ADMIN_PASSWORD ||
  import.meta.env.VITE_WEB_DEFAULT_USER_PASSWORD ||
  'Admin321!';

export function WebLoginCard() {
  const { login, register } = useWebAuth();
  const [mode, setMode] = useState('login');
  const [nombre, setNombre] = useState(DEFAULT_WEB_USER_NAME);
  const [password, setPassword] = useState(DEFAULT_WEB_USER_PASSWORD);
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';
  const passwordState = evaluatePassword(password, nombre);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');

    if (nextMode === 'register') {
      setNombre('');
      setPassword('');
      setRememberCredentials(false);
      return;
    }

    const remembered = loadRememberedCredentials();
    if (remembered) {
      setNombre(remembered.nombre);
      setPassword(remembered.password);
      setRememberCredentials(true);
      return;
    }

    setNombre(DEFAULT_WEB_USER_NAME);
    setPassword(DEFAULT_WEB_USER_PASSWORD);
    setRememberCredentials(false);
  }

  useEffect(() => {
    setRememberCredentials(getRememberPreference());

    const remembered = loadRememberedCredentials();

    if (!remembered) {
      setNombre(DEFAULT_WEB_USER_NAME);
      setPassword(DEFAULT_WEB_USER_PASSWORD);
      return;
    }

    setNombre(remembered.nombre);
    setPassword(remembered.password);
    setRememberCredentials(true);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        if (!passwordState.isValid) {
          throw new Error('La password no cumple los requisitos');
        }
        await register({ nombre, password });
      } else {
        await login({ nombre, password });
      }

      if (rememberCredentials) {
        setRememberPreference(true);
        saveRememberedCredentials({ nombre, password });
      } else {
        setRememberPreference(false);
        clearRememberedCredentials();
      }
    } catch (submitError) {
      setError(submitError.message || 'No se pudo completar la operacion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>{isRegister ? 'Registro Web' : 'Login Web'}</h1>

      <div className="auth-switch">
        <button type="button" onClick={() => switchMode('login')} disabled={loading || !isRegister}>Iniciar sesion</button>
        <button type="button" onClick={() => switchMode('register')} disabled={loading || isRegister}>Crear cuenta</button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej: Juancito"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {isRegister ? (
          <ul className="auth-password-rules">
            <li className={passwordState.checks.minLength ? 'ok' : ''}>Minimo 8 caracteres</li>
            <li className={passwordState.checks.upper ? 'ok' : ''}>Al menos 1 mayuscula</li>
            <li className={passwordState.checks.lower ? 'ok' : ''}>Al menos 1 minuscula</li>
            <li className={passwordState.checks.number ? 'ok' : ''}>Al menos 1 numero</li>
            <li className={passwordState.checks.symbol ? 'ok' : ''}>Al menos 1 simbolo</li>
            <li className={passwordState.checks.notCommon ? 'ok' : ''}>No usar passwords comunes</li>
            <li className={passwordState.checks.notContainingName ? 'ok' : ''}>No incluir tu nombre</li>
          </ul>
        ) : null}

        {!isRegister ? (
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberCredentials}
              onChange={(event) => setRememberCredentials(event.target.checked)}
            />
            Recordar usuario y contraseña
          </label>
        ) : null}

        <button type="submit" disabled={loading || (isRegister && !passwordState.isValid)}>
          {loading ? 'Procesando...' : (isRegister ? 'Registrarme' : 'Entrar')}
        </button>
      </form>

      {error ? <p className="auth-error">{error}</p> : null}
    </section>
  );
}
