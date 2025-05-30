import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from "jwt-decode";

export interface AuthUser {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any; // For additional claims from JWT
}

interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    token: string | null;
}

interface AuthContextType extends AuthState {
    loginWithGoogle: (appRedirectUriPath: string, appState?: string) => void;
    loginWithGitHub: (appRedirectUriPath: string, appState?: string) => void;
    loginWithEmailRequest: (email: string, appRedirectUriPath: string, appState?: string) => Promise<void>;
    handleAuthCallback: () => Promise<void>;
    logout: (logoutRedirectUri?: string) => void;
    getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderConfig {
    authServerUrl?: string;
    defaultAppRedirectPath?: string;
    tokenStorageKey?: string;
    stateStorageKey?: string;
    onLoginSuccess?: (user: AuthUser, token: string) => void;
    onLogoutSuccess?: () => void;
}

interface JwtPayload extends AuthUser { // AuthUser might already have 'id', 'email', etc.
    sub: string; // Standard subject claim
    iss?: string;
    exp?: number;
    iat?: number;
    aud?: string | string[];
    // ... any other standard or custom claims you expect
}

const defaultConfigValues: Required<Omit<AuthProviderConfig, 'onLoginSuccess' | 'onLogoutSuccess'>> = {
    authServerUrl: 'https://auth.mgcmnd.net',
    defaultAppRedirectPath: '/auth/callback',
    tokenStorageKey: 'mgcmnd_auth_token',
    stateStorageKey: 'mgcmnd_oauth_app_state',
};

const generateSpaState = (): string => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getAppBaseUrl = (): string => {
    return `${window.location.protocol}//${window.location.host}`;
};

export const AuthProvider: React.FC<{ children: ReactNode, config?: AuthProviderConfig }> = ({ children, config: rawConfig = {} }) => {
    // Memoize the merged config object to ensure its stability if rawConfig is stable
    // If rawConfig changes, this will recompute, which is correct.
    const config = useMemo(() => ({
        ...defaultConfigValues,
        ...rawConfig,
    }), [rawConfig]);

    // Destructure config properties that are used in useCallback dependency arrays
    // This ensures that if the `config` object reference changes but these specific values haven't,
    // the callbacks depending on them won't be redefined unnecessarily.
    // However, if `rawConfig` itself is stable (e.g., from useMemo in parent),
    // then `config.property` is fine in deps. For robustness, destructuring is safer.
    const {
        tokenStorageKey,
        onLoginSuccess,
        onLogoutSuccess,
        stateStorageKey,
        authServerUrl,
        defaultAppRedirectPath
    } = config;


    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        user: null,
        isLoading: true, // Start as true until initial token check is done
        error: null,
        token: null,
    });

    const saveTokenAndUser = useCallback((jwtToken: string) => {
        try {
            localStorage.setItem(tokenStorageKey, jwtToken);

            // Tell jwtDecode the expected shape of the decoded payload
            const decodedClaims = jwtDecode<JwtPayload>(jwtToken);

            // Destructure to separate 'sub' (for id) and potentially an 'id' from the rest of the claims
            // if 'id' could also be a top-level claim. Or just rely on 'sub'.
            const { sub, ...otherClaims } = decodedClaims;

            const user: AuthUser = {
                ...otherClaims, // Spread other claims first
                id: sub,        // Explicitly set id from sub, this will overwrite any 'id' from otherClaims if present
                // If AuthUser expects email, name, picture, ensure they are mapped from otherClaims if names differ
                email: decodedClaims.email, // Or otherClaims.email
                name: decodedClaims.name,   // Or otherClaims.name
                picture: decodedClaims.picture, // Or otherClaims.picture
            };

            setAuthState({
                isAuthenticated: true,
                user,
                isLoading: false,
                error: null,
                token: jwtToken,
            });
            if (onLoginSuccess) {
                onLoginSuccess(user, jwtToken);
            }
        } catch (e: any) {
            console.error("Failed to decode token with jwt-decode:", e.message, e);
            setAuthState((prev) => ({ ...prev, isLoading: false, error: "Authentication processing failed: Invalid token." }));
        }
    }, [tokenStorageKey, onLoginSuccess]);

    const clearTokenAndUser = useCallback(() => {
        localStorage.removeItem(tokenStorageKey);
        setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null,
            token: null,
        });
        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
    }, [tokenStorageKey, onLogoutSuccess]); // Depends on stable destructured config values

    // Initial effect to check for existing token
    useEffect(() => {
        const storedToken = localStorage.getItem(tokenStorageKey);
        if (storedToken) {
            // TODO: Add robust token validation here (check expiry, signature if possible on client)
            // For now, just assume it's good if it exists and can be parsed.
            saveTokenAndUser(storedToken);
        } else {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [tokenStorageKey, saveTokenAndUser]); // saveTokenAndUser is memoized

    const buildAuthRedirectUrl = useCallback((provider: 'google' | 'github' | 'email', appRedirectUri: string, appStateString?: string, email?: string) => {
        const spaState = appStateString || generateSpaState();
        sessionStorage.setItem(stateStorageKey, spaState);

        const params = new URLSearchParams({
            redirect_uri: appRedirectUri,
            state: spaState,
        });
        if (email && provider === 'email') {
            params.set('email', email);
        }
        return `${authServerUrl}/${provider}/login?${params.toString()}`;
    }, [stateStorageKey, authServerUrl]); // Depends on stable destructured config values


    const loginWithGoogle = useCallback((appRedirectUriPath: string, appStateFromSpa?: string) => {
        const appBaseUrl = getAppBaseUrl();
        const finalAppRedirectUri = `${appBaseUrl}${appRedirectUriPath || defaultAppRedirectPath}`;
        window.location.href = buildAuthRedirectUrl('google', finalAppRedirectUri, appStateFromSpa);
    }, [defaultAppRedirectPath, buildAuthRedirectUrl]); // buildAuthRedirectUrl is memoized

    const loginWithGitHub = useCallback((appRedirectUriPath: string, appStateFromSpa?: string) => {
        const appBaseUrl = getAppBaseUrl();
        const finalAppRedirectUri = `${appBaseUrl}${appRedirectUriPath || defaultAppRedirectPath}`;
        window.location.href = buildAuthRedirectUrl('github', finalAppRedirectUri, appStateFromSpa);
    }, [defaultAppRedirectPath, buildAuthRedirectUrl]); // buildAuthRedirectUrl is memoized

    const loginWithEmailRequest = useCallback(async (email: string, appRedirectUriPath: string, appStateFromSpa?: string): Promise<void> => {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        const appBaseUrl = getAppBaseUrl();
        const finalAppRedirectUri = `${appBaseUrl}${appRedirectUriPath || defaultAppRedirectPath}`;

        try {
            const spaState = appStateFromSpa || generateSpaState();
            sessionStorage.setItem(stateStorageKey, spaState);

            const response = await fetch(`${authServerUrl}/email/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    redirect_uri: finalAppRedirectUri,
                    state: spaState,
                }),
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: "Failed to parse error response." }));
                throw new Error(errData.message || "Failed to request email token.");
            }
            setAuthState((prev) => ({ ...prev, isLoading: false }));
            // UI should inform user to check email
        } catch (e: any) {
            setAuthState((prev) => ({ ...prev, isLoading: false, error: e.message || "Email login request failed." }));
            throw e;
        }
    }, [defaultAppRedirectPath, stateStorageKey, authServerUrl]); // Depends on stable destructured config values

    const handleAuthCallback = useCallback(async (): Promise<void> => {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        const stateFromUrl = params.get('state');
        const errorFromUrl = params.get('error');

        const storedSpaStateBeforeRemove = sessionStorage.getItem(stateStorageKey);
        sessionStorage.removeItem(stateStorageKey);

        if (errorFromUrl) {
            setAuthState({ isAuthenticated: false, user: null, isLoading: false, error: errorFromUrl, token: null });
            return;
        }

        if (!stateFromUrl || stateFromUrl !== storedSpaStateBeforeRemove) {
            setAuthState({ isAuthenticated: false, user: null, isLoading: false, error: `Invalid state. URL: ${stateFromUrl}, Stored: ${storedSpaStateBeforeRemove}`, token: null });
            return;
        }

        if (tokenFromUrl) {
            saveTokenAndUser(tokenFromUrl); // This calls setAuthState with isLoading: false
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            setAuthState((prev) => ({ ...prev, isAuthenticated: false, user: null, isLoading: false, error: "No token received but state was valid." }));
        }
    }, [stateStorageKey, saveTokenAndUser]); // saveTokenAndUser is memoized

    const logout = useCallback((logoutRedirectUri?: string) => {
        clearTokenAndUser(); // Uses memoized clearTokenAndUser
        if (logoutRedirectUri) {
            window.location.href = logoutRedirectUri;
        } else {
            window.location.href = '/'; // Or window.location.reload(); or a configured default logout redirect
        }
    }, [clearTokenAndUser]); // clearTokenAndUser is memoized

    const getAccessToken = useCallback((): string | null => {
        return authState.token;
    }, [authState.token]); // Depends on authState.token which will change

    // Memoize the context value itself to prevent unnecessary re-renders of consumers
    // if AuthProvider re-renders but the context value's identity hasn't actually changed.
    const contextValue = useMemo(() => ({
        ...authState,
        loginWithGoogle,
        loginWithGitHub,
        loginWithEmailRequest,
        handleAuthCallback,
        logout,
        getAccessToken,
    }), [
        authState,
        loginWithGoogle,
        loginWithGitHub,
        loginWithEmailRequest,
        handleAuthCallback,
        logout,
        getAccessToken
    ]);


    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};