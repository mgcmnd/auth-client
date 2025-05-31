import { useState, useCallback, useEffect, useRef } from 'react';
import type { AuthUser, AuthState } from './AuthContext';
import { jwtDecode } from "jwt-decode";

interface JwtPayload extends AuthUser { // AuthUser might already have 'id', 'email', etc.
    sub: string; // Standard subject claim
    iss?: string;
    exp?: number;
    iat?: number;
    aud?: string | string[];
    // ... any other standard or custom claims you expect
}

// Define the specific parts of AuthProviderConfig this hook needs
export interface CoreStateConfig {
    tokenStorageKey?: string;
    onLoginSuccess?: (user: AuthUser, token: string) => void;
    onLogoutSuccess?: () => void;
}

export interface UseAuthCoreStateReturn {
    authState: AuthState;
    saveTokenAndUser: (jwtToken: string) => void;
    clearTokenAndUser: () => void;
    setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
}

export function useAuthCoreState(config: CoreStateConfig): UseAuthCoreStateReturn {
    const {
        tokenStorageKey = 'mgcmnd_auth_token', // Default applied here
        onLoginSuccess,
        onLogoutSuccess
    } = config;

    // Track the last processed token to prevent duplicate onLoginSuccess calls
    const lastProcessedTokenRef = useRef<string | null>(null);
    // Keep a ref to the latest onLoginSuccess callback to avoid dependency issues
    const onLoginSuccessRef = useRef(onLoginSuccess);
    onLoginSuccessRef.current = onLoginSuccess;
    // Flag to prevent initial token loading when processing auth callback
    const isProcessingAuthCallbackRef = useRef(false);

    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        user: null,
        isLoading: true, // Start loading until initial token check
        error: null,
        token: null,
    });

    const saveTokenAndUser = useCallback((jwtToken: string, fromAuthCallback = false) => {
        try {
            // Prevent duplicate processing of the same token
            if (lastProcessedTokenRef.current === jwtToken) {
                return;
            }

            // Set flag when processing from auth callback
            if (fromAuthCallback) {
                isProcessingAuthCallbackRef.current = true;
            }

            localStorage.setItem(tokenStorageKey, jwtToken);
            // Basic JWT decode - for production, consider a robust library
            // and ensure you're handling potential errors from atob or JSON.parse gracefully.
            const claims = jwtDecode<JwtPayload>(jwtToken);

            // Destructure to separate 'sub' (for id) and potentially an 'id' from the rest of the claims
            // if 'id' could also be a top-level claim. Or just rely on 'sub'.
            const { sub, ...otherClaims } = claims;

            const user: AuthUser = {
                ...otherClaims,
                id: sub,
                email: otherClaims.email,
                name: otherClaims.name,
                picture: otherClaims.picture,
            };

            setAuthState({
                isAuthenticated: true,
                user,
                isLoading: false,
                error: null,
                token: jwtToken,
            });

            // Update the last processed token and call onLoginSuccess
            lastProcessedTokenRef.current = jwtToken;
            if (onLoginSuccessRef.current) {
                onLoginSuccessRef.current(user, jwtToken);
            }

            // Reset flag after processing
            if (fromAuthCallback) {
                isProcessingAuthCallbackRef.current = false;
            }
        } catch (e) {
            console.error("Failed to decode or store token", e);
            setAuthState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Authentication processing failed. Invalid token format.",
            }));
            // Reset flag on error
            if (fromAuthCallback) {
                isProcessingAuthCallbackRef.current = false;
            }
        }
    }, [tokenStorageKey]); // Removed onLoginSuccess from dependencies to make function more stable

    const clearTokenAndUser = useCallback(() => {
        localStorage.removeItem(tokenStorageKey);
        lastProcessedTokenRef.current = null; // Reset the last processed token
        isProcessingAuthCallbackRef.current = false; // Reset auth callback flag
        setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false, // No longer loading
            error: null,
            token: null,
        });
        if (onLogoutSuccess) {
            onLogoutSuccess();
        }
    }, [tokenStorageKey, onLogoutSuccess]);

    // Effect for initial token loading from localStorage
    useEffect(() => {
        // Don't load from localStorage if we're currently processing an auth callback
        if (isProcessingAuthCallbackRef.current) {
            return;
        }

        const storedToken = localStorage.getItem(tokenStorageKey);
        if (storedToken) {
            // TODO: Add robust token validation (e.g., check expiry if 'exp' is in JWT)
            // before considering it valid. For now, we just parse it.
            saveTokenAndUser(storedToken, false); // false = not from auth callback
        } else {
            setAuthState((prev) => ({ ...prev, isLoading: false })); // Not loading if no token found
        }
    }, [tokenStorageKey]); // saveTokenAndUser is now stable

    return { authState, saveTokenAndUser, clearTokenAndUser, setAuthState };
}