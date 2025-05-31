import React, { createContext, useContext, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuthCoreState, type CoreStateConfig } from './useAuthCoreState';
import { useAuthActions, type ActionsConfig, type UseAuthActionsReturn } from './useAuthActions';

// Define the shape of your user object
export interface AuthUser {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any; // For additional claims from JWT
}

// Define the context state
export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    token: string | null;
}

// Define the context value (state + actions)
// It combines AuthState and the return type of useAuthActions, plus logout and getAccessToken
export interface AuthContextType extends AuthState, UseAuthActionsReturn {
    logout: (logoutRedirectUri?: string) => void;
    getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuration for the AuthProvider
export interface AuthProviderConfig extends CoreStateConfig, ActionsConfig {
    // All properties are now optional at this top level,
    // as defaults are handled in hooks or defaultConfigValues
}

// Default values for config properties not having defaults in individual hooks
// or for properties that might be shared if not for destructuring in hooks.
// However, individual hooks now handle their own defaults for tokenStorageKey etc.
const defaultConfigValues: Partial<AuthProviderConfig> = {
    defaultAppRedirectPath: '/auth/callback',
    tokenStorageKey: 'mgcmnd_auth_token',
    stateStorageKey: 'mgcmnd_oauth_app_state',
};


export const AuthProvider: React.FC<{ children: ReactNode; config: AuthProviderConfig }> = ({
    children,
    config: rawConfig,
}) => {
    // Memoize the merged config object to ensure its stability if rawConfig is stable
    const config = useMemo(() => ({
        ...defaultConfigValues,
        ...rawConfig,
    }), [rawConfig]);

    // Core state logic (manages authState, token persistence)
    const { authState, saveTokenAndUser, clearTokenAndUser, setAuthState } = useAuthCoreState(config);

    // Auth actions logic (manages login flows, callback handling)
    const actions = useAuthActions({
        config, // Pass the memoized config
        saveTokenAndUser, // Pass the memoized function from useAuthCoreState
        setAuthState,     // Pass setAuthState for actions to update loading/error states
    });

    // Logout action
    const logout = useCallback((logoutRedirectUri?: string) => {
        clearTokenAndUser(); // Uses memoized clearTokenAndUser
        const targetRedirect = logoutRedirectUri || window.location.origin + '/'; // Sensible default
        window.location.href = targetRedirect;
    }, [clearTokenAndUser]);

    // Access token getter
    const getAccessToken = useCallback((): string | null => {
        return authState.token;
    }, [authState.token]); // Depends on the token part of authState


    // Memoize the final context value
    const contextValue = useMemo(() => ({
        ...authState,
        ...actions, // Spread memoized actions (loginWith..., handleAuthCallback)
        logout,         // Add memoized logout
        getAccessToken, // Add memoized getAccessToken
    }), [authState, actions, logout, getAccessToken]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};