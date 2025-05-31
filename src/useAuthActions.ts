import { useCallback } from 'react';
import type { AuthState } from './AuthContext';

// Helper to generate a random state (could be moved to a shared utils.ts)
const generateSpaState = (): string => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Helper to get SPA's base URL (could be moved to a shared utils.ts)
const getAppBaseUrl = (): string => {
    return `${window.location.protocol}//${window.location.host}`;
};


// Define the specific parts of AuthProviderConfig this hook needs
export interface ActionsConfig {
    authServerUrl?: string; // Optional - defaults to "https://auth.mgcmnd.net"
    stateStorageKey?: string;
    defaultAppRedirectPath?: string;
}

export interface UseAuthActionsProps {
    config: ActionsConfig;
    saveTokenAndUser: (jwtToken: string, fromAuthCallback?: boolean) => void;
    setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
}

export interface UseAuthActionsReturn {
    loginWithGoogle: (appRedirectUriPath: string, appState?: string) => void;
    loginWithGitHub: (appRedirectUriPath: string, appState?: string) => void;
    loginWithEmailRequest: (email: string, appRedirectUriPath: string, appState?: string) => Promise<void>;
    handleAuthCallback: () => Promise<void>;
}

export function useAuthActions({
    config,
    saveTokenAndUser,
    setAuthState,
}: UseAuthActionsProps): UseAuthActionsReturn {
    const {
        authServerUrl = "https://auth.mgcmnd.net",
        stateStorageKey = 'mgcmnd_oauth_app_state', // Default applied here
        defaultAppRedirectPath = '/auth/callback', // Default applied here
    } = config;

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
    }, [stateStorageKey, authServerUrl]);

    const loginWithGoogle = useCallback((appRedirectUriPath: string, appStateFromSpa?: string) => {
        const appBaseUrl = getAppBaseUrl();
        const finalAppRedirectUri = `${appBaseUrl}${appRedirectUriPath || defaultAppRedirectPath}`;
        window.location.href = buildAuthRedirectUrl('google', finalAppRedirectUri, appStateFromSpa);
    }, [defaultAppRedirectPath, buildAuthRedirectUrl]);

    const loginWithGitHub = useCallback((appRedirectUriPath: string, appStateFromSpa?: string) => {
        const appBaseUrl = getAppBaseUrl();
        const finalAppRedirectUri = `${appBaseUrl}${appRedirectUriPath || defaultAppRedirectPath}`;
        window.location.href = buildAuthRedirectUrl('github', finalAppRedirectUri, appStateFromSpa);
    }, [defaultAppRedirectPath, buildAuthRedirectUrl]);

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
                const errData = await response.json().catch(() => ({ message: "Failed to parse error from email request." }));
                throw new Error(errData.message || "Failed to request email token.");
            }
            setAuthState((prev) => ({ ...prev, isLoading: false }));
            // UI should inform user to check email
        } catch (e: any) {
            setAuthState((prev) => ({ ...prev, isLoading: false, error: e.message || "Email login request failed." }));
            throw e; // Re-throw for component to handle if needed
        }
    }, [defaultAppRedirectPath, stateStorageKey, authServerUrl, setAuthState]);

    const handleAuthCallback = useCallback(async (): Promise<void> => {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        const stateFromUrl = params.get('state');
        const errorFromUrl = params.get('error');

        // --- Start logs (can be removed for production) ---
        console.log("--- handleAuthCallback Execution ---");
        console.log("Timestamp:", new Date().toISOString());
        console.log("Current window.location.href:", window.location.href);
        console.log("Parsed stateFromUrl:", stateFromUrl);
        const storedSpaStateBeforeRemove = sessionStorage.getItem(stateStorageKey);
        console.log("Value from sessionStorage (BEFORE remove) using key '" + stateStorageKey + "':", storedSpaStateBeforeRemove);
        sessionStorage.removeItem(stateStorageKey); // Important: Remove state after reading
        console.log("Removed state from sessionStorage using key '" + stateStorageKey + "'.");
        // --- End logs ---

        if (errorFromUrl) {
            setAuthState({ isAuthenticated: false, user: null, isLoading: false, error: errorFromUrl, token: null });
            return;
        }

        if (!stateFromUrl || stateFromUrl !== storedSpaStateBeforeRemove) {
            setAuthState({ isAuthenticated: false, user: null, isLoading: false, error: `Invalid state. URL: ${stateFromUrl}, Stored: ${storedSpaStateBeforeRemove}`, token: null });
            return;
        }

        if (tokenFromUrl) {
            saveTokenAndUser(tokenFromUrl, true); // true = from auth callback
            // Clean query params from URL after processing
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // No token, but state was valid (or invalid and already handled)
            // This path means auth flow completed without a token.
            setAuthState((prev) => ({ ...prev, isAuthenticated: false, user: null, isLoading: false, error: "Authentication completed without a token, but state was valid." }));
        }
    }, [stateStorageKey, saveTokenAndUser, setAuthState]); // Dependencies are stable

    return {
        loginWithGoogle,
        loginWithGitHub,
        loginWithEmailRequest,
        handleAuthCallback,
    };
}