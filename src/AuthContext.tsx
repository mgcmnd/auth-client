import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export interface AuthUser {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    token: string | null;
}

export interface AuthConfig {
    authServerUrl?: string;
    tokenStorageKey?: string;
    redirectPath?: string;
    onLoginSuccess?: (user: AuthUser, token: string) => void;
    onLogoutSuccess?: () => void;
}

interface AuthContextType extends AuthState {
    loginWithGoogle: (redirectPath?: string) => void;
    loginWithGitHub: (redirectPath?: string) => void;
    loginWithEmail: (email: string, redirectPath?: string) => Promise<void>;
    logout: (redirectUrl?: string) => void;
    handleCallback: () => void;
}

const DEFAULT_CONFIG: Required<AuthConfig> = {
    authServerUrl: 'https://auth.mgcmnd.net',
    tokenStorageKey: 'mgcmnd_auth_token',
    redirectPath: '/auth/callback',
    onLoginSuccess: () => { },
    onLogoutSuccess: () => { },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; config?: AuthConfig }> = ({
    children,
    config = {},
}) => {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        token: null,
    });

    const generateState = () => {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    const getRedirectUri = (path?: string) => {
        const basePath = path || cfg.redirectPath;
        return `${window.location.origin}${basePath}`;
    };

    const decodeAndSetToken = (token: string, skipCallback = false) => {
        try {
            // Prevent processing the same token multiple times
            if (state.token === token && state.isAuthenticated) {
                return;
            }

            const decoded = jwtDecode<any>(token);
            const user: AuthUser = {
                id: decoded.sub || decoded.id,
                email: decoded.email,
                name: decoded.name,
                picture: decoded.picture,
                ...decoded,
            };

            localStorage.setItem(cfg.tokenStorageKey, token);
            setState({
                isAuthenticated: true,
                user,
                isLoading: false,
                error: null,
                token,
            });

            // Only call onLoginSuccess when explicitly logging in (not on mount)
            if (!skipCallback) {
                cfg.onLoginSuccess(user, token);
            }
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Invalid token format',
            }));
        }
    };

    // Load token on mount
    useEffect(() => {
        const token = localStorage.getItem(cfg.tokenStorageKey);
        if (token) {
            // Skip callback on initial load to prevent duplicate calls
            decodeAndSetToken(token, true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auth methods
    const loginWithProvider = (provider: 'google' | 'github', redirectPath?: string) => {
        const state = generateState();
        sessionStorage.setItem('oauth_state', state);

        const params = new URLSearchParams({
            redirect_uri: getRedirectUri(redirectPath),
            state,
        });

        window.location.href = `${cfg.authServerUrl}/${provider}/login?${params}`;
    };

    const loginWithGoogle = (redirectPath?: string) => loginWithProvider('google', redirectPath);
    const loginWithGitHub = (redirectPath?: string) => loginWithProvider('github', redirectPath);

    const loginWithEmail = async (email: string, redirectPath?: string) => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const state = generateState();
            sessionStorage.setItem('oauth_state', state);

            const response = await fetch(`${cfg.authServerUrl}/email/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    redirect_uri: getRedirectUri(redirectPath),
                    state,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to request email login');
            }

            setState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Email login failed',
            }));
            throw error;
        }
    };

    const logout = (redirectUrl?: string) => {
        localStorage.removeItem(cfg.tokenStorageKey);
        setState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null,
            token: null,
        });
        cfg.onLogoutSuccess();

        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    };

    const handleCallback = () => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const stateParam = params.get('state');
        const error = params.get('error');
        const storedState = sessionStorage.getItem('oauth_state');

        // Clean up
        sessionStorage.removeItem('oauth_state');
        window.history.replaceState({}, document.title, window.location.pathname);

        if (error) {
            setState(prev => ({ ...prev, error }));
            return;
        }

        if (stateParam !== storedState) {
            setState(prev => ({ ...prev, error: 'Invalid state parameter' }));
            return;
        }

        if (token) {
            decodeAndSetToken(token, false); // Explicitly call callback for new login
        } else {
            setState(prev => ({ ...prev, error: 'No token received' }));
        }
    };

    const value: AuthContextType = {
        ...state,
        loginWithGoogle,
        loginWithGitHub,
        loginWithEmail,
        logout,
        handleCallback,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};