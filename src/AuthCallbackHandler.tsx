import React, { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface AuthCallbackHandlerProps {
    /**
     * Optional: A React Node to display while authentication is being processed.
     * Defaults to a simple "<p>Processing authentication...</p>" if not provided and isLoading is true.
     */
    renderLoading?: () => React.ReactNode;
    /**
     * Callback function executed upon successful authentication processing by handleAuthCallback.
     * The consuming application should handle navigation or other UI updates here.
     */
    onSuccess?: () => void;
    /**
     * Callback function executed if handleAuthCallback encounters an error or fails.
     * @param errorMsg The error message string.
     * The consuming application should handle navigation to an error/login page or display an error message.
     */
    onError?: (errorMsg: string) => void;
}

/**
 * A renderless component designed to handle the OAuth callback.
 * It invokes `handleAuthCallback` from `useAuth` and then calls
 * `onSuccess` or `onError` based on the outcome.
 * The consuming application is responsible for navigation and UI based on these callbacks.
 */
export const AuthCallbackHandler: React.FC<AuthCallbackHandlerProps> = ({
    renderLoading,
    onSuccess,
    onError,
}) => {
    const { handleAuthCallback, isLoading, isAuthenticated, error } = useAuth();
    // useRef to ensure handleAuthCallback is called only once effectively,
    // even with StrictMode or if parent component re-renders quickly.
    const callbackProcessedRef = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        // Only process if there are relevant auth params AND we haven't processed this callback invocation yet.
        if (
            (params.has('token') || params.has('state') || params.has('error')) &&
            !callbackProcessedRef.current
        ) {
            console.log("[AuthCallbackHandler] URL params detected. Calling handleAuthCallback.");
            callbackProcessedRef.current = true; // Mark as processing/processed for this mount/URL
            handleAuthCallback(); // This will update isLoading, isAuthenticated, error in AuthContext
        } else if (!params.has('token') && !params.has('state') && !params.has('error') && !isLoading && !isAuthenticated && onError) {
            // This case handles if the callback page is somehow reached without any relevant auth parameters
            // and the auth state is not already loading or authenticated. It's a safety net.
            console.log("[AuthCallbackHandler] No auth params, not loading, not authenticated. Invoking onError.");
            onError("No authentication parameters found in URL.");
        }
    }, [handleAuthCallback, isLoading, isAuthenticated, onError]); // Add all dependencies that are read or called

    useEffect(() => {
        // This effect reacts to the outcome of handleAuthCallback (via isLoading, isAuthenticated, error)
        // It only acts once isLoading is false, indicating processing is complete.
        if (!isLoading && callbackProcessedRef.current) { // Ensure we only react after attempting to process
            if (isAuthenticated && onSuccess) {
                console.log("[AuthCallbackHandler] Authentication successful. Calling onSuccess.");
                onSuccess();
            } else if (error && onError) {
                console.log("[AuthCallbackHandler] Authentication error. Calling onError with:", error);
                onError(error);
            }
            // If !isAuthenticated and no error after processing, it implies handleAuthCallback finished
            // without authenticating (e.g. "No token received but state was valid").
            // The onError for "Invalid state" or "No token" would have been set by handleAuthCallback itself.
        }
    }, [isLoading, isAuthenticated, error, onSuccess, onError]);

    // Render loading state if provided and still loading
    if (isLoading) {
        return renderLoading ? <>{renderLoading()}</> : <p>Processing authentication...</p>;
    }

    // Once not loading, this component itself renders nothing further.
    // The onSuccess/onError callbacks are responsible for changing the view (e.g., navigating).
    // If error occurred and onError wasn't provided, the error state is still in useAuth() for other components to see.
    return null;
};