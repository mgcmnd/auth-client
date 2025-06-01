import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface AuthCallbackHandlerProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    loading?: React.ReactNode;
}

export const AuthCallbackHandler: React.FC<AuthCallbackHandlerProps> = ({
    onSuccess,
    onError,
    loading = <p>Processing authentication...</p>,
}) => {
    const { handleCallback, isAuthenticated, error, isLoading } = useAuth();

    useEffect(() => {
        handleCallback();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            if (isAuthenticated && onSuccess) {
                onSuccess();
            } else if (error && onError) {
                onError(error);
            }
        }
    }, [isLoading, isAuthenticated, error, onSuccess, onError]);

    if (isLoading) {
        return <>{loading}</>;
    }

    return null;
};