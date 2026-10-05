/**
 * useCareerWaveApi.ts
 *
 * Bridges the Auth0 React SDK with the ApiService: injects the Auth0 token
 * getter so every backend call is authenticated.
 *
 * VITE_AUTH_DISABLED=true is for local development / automated tests only
 * (pair it with AUTH_DISABLED=true on the backend). Auth0 is always used
 * otherwise.
 */

import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenGetter } from '../services/api';

const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE as string;
export const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === 'true';

function useAuth0Session() {
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setTokenGetter(async () => {
      if (!isAuthenticated) return null;
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUDIENCE, scope: 'openid profile email read:resumes write:resumes' },
        });
        return token ?? null;
      } catch (e) {
        console.warn('[useCareerWaveApi] getAccessTokenSilently failed:', e);
        return null;
      }
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  return {
    isLoading,
    isAuthenticated,
    user,
    login: () => loginWithRedirect(),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
  };
}

function useDevSession() {
  return {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'dev-user', name: '', email: 'dev@localhost' } as { sub: string; name?: string; email?: string },
    login: async () => {},
    logout: () => { window.location.reload(); },
  };
}

// The flag is a build-time constant, so the same hook is used on every render.
export const useCareerWaveApi = AUTH_DISABLED ? useDevSession : useAuth0Session;
