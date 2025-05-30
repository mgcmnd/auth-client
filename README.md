# @mgcmnd/auth-client

A React context provider and hooks for client-side authentication with the [Magic Monad](https://magicmonad.com) authentication server (`auth.mgcmnd.net`).

## Features

*   Provides authentication state (`isAuthenticated`, `user`, `isLoading`, `error`, `token`).
*   Offers functions for initiating login (`loginWithGoogle`, `loginWithGitHub`, etc.), handling OAuth callbacks (`handleAuthCallback`), and logging out (`logout`).
*   Manages client-side OAuth state for CSRF protection.
*   Decodes JWTs received from the auth server to populate user information.

## Installation

```bash
npm install @mgcmnd/auth-client
```

You will also need `react` (version 17.0.0 or ^18.0.0) as a peer dependency.

## Usage

Wrap your application's root (or relevant part of the component tree) with the `AuthProvider`. You **must** provide a configuration object.

```tsx
// src/App.tsx or your main application entry point
import React from 'react';
import { AuthProvider, AuthProviderConfig } from '@mgcmnd/auth-client';
import { BrowserRouter as Router, Routes, Route /* ... other router components */ } from 'react-router-dom';
// Import your actual application components

// 1. Define your AuthProvider configuration
const authConfig: AuthProviderConfig = {
  defaultAppRedirectPath: '/auth/callback',   // Path in your SPA where the auth server redirects back
  // Optional configurations:
  // tokenStorageKey: 'my_custom_token_key',
  // stateStorageKey: 'my_custom_state_key',
  onLoginSuccess: (user, token) => {
    console.log('Login successful in SPA!', user);
  },
  onLogoutSuccess: () => {
    console.log('Logout successful in SPA!');
  }
};

function App() {
  return (
    <AuthProvider config={authConfig}>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Other routes for your application */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### Accessing Auth State and Functions

Use the `useAuth` hook within components that are descendants of `AuthProvider`.

```tsx
// src/components/UserProfile.tsx (Example Component)
import React from 'react';
import { useAuth } from '@mgcmnd/auth-client';
import { Link } from 'react-router-dom'; // Assuming you use React Router for navigation

function UserProfile() {
  const { isAuthenticated, user, logout, isLoading, error } = useAuth();

  if (isLoading) {
    return <p>Loading authentication state...</p>;
  }

  if (error) {
    return <p>Authentication Error: {error}</p>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div>
        <p>You are not logged in.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome, {user.name || user.email}!</h1>
      {user.email && <p>Email: {user.email}</p>}
      {user.picture && <img src={user.picture} alt={user.name || 'User avatar'} />}
      <h3>User Details (from JWT):</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={() => logout('/')}>Logout</button>
    </div>
  );
}

export default UserProfile;
```

### Handling the OAuth Callback

You need to create a component that will be rendered at the `defaultAppRedirectPath` (e.g., `/auth/callback`) specified in your `AuthProviderConfig`. This component will call `handleAuthCallback`.

```tsx
// src/pages/AuthCallback.tsx (Example Page Component)
import React, { useEffect, useRef } from 'react';
import { useAuth } from '@mgcmnd/auth-client';
import { useNavigate } from 'react-router-dom';

function AuthCallback() {
  const { handleAuthCallback, isLoading, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();
  const effectCalled = useRef(false); // To prevent calling handleAuthCallback multiple times on strict mode double-invokes

  useEffect(() => {
    // Check if URL contains params that indicate a callback needs processing.
    // This prevents re-processing if the component re-renders after URL is cleaned.
    const params = new URLSearchParams(window.location.search);
    if ((params.has('token') || params.has('state') || params.has('error')) && !effectCalled.current) {
      console.log("[AuthCallbackPage] Params found. Calling handleAuthCallback.");
      handleAuthCallback();
      effectCalled.current = true; // Mark that we've initiated the callback handling
    } else if (!params.has('token') && !params.has('state') && !params.has('error') && !isLoading && !isAuthenticated) {
      // If no params and not loading/authed, probably an incorrect navigation to this page.
      console.log("[AuthCallbackPage] No auth params, not loading, not authenticated. Navigating to login.");
      navigate('/login'); // Or to home page
    }
  }, [handleAuthCallback, isLoading, isAuthenticated, navigate]); // Dependencies

  useEffect(() => {
    // This effect handles navigation after handleAuthCallback has completed (signaled by isLoading: false)
    if (!isLoading) {
      if (isAuthenticated) {
        console.log("[AuthCallbackPage] Authenticated. Navigating to /profile.");
        navigate('/profile'); // Or to the intended page after login
      } else if (error) {
        console.error("[AuthCallbackPage] Auth callback error:", error);
        // Optionally display the error message on this page or redirect
        navigate('/login?error=' + encodeURIComponent(error)); // Example: redirect to login with error
      }
    }
  }, [isLoading, isAuthenticated, error, navigate]);

  if (isLoading) {
    return <p>Processing authentication...</p>;
  }

  // If an error occurred, the effect above should handle navigation.
  // This is a fallback display or for when navigating away.
  if (error) {
    return (
      <div>
        <p>An error occurred during authentication: {error}</p>
        <button onClick={() => navigate('/login')}>Try Logging In Again</button>
      </div>
    );
  }
  
  return <p>Verifying authentication...</p>; // Should not stay on this for long
}

export default AuthCallback;
```
And ensure this component is used in your App's router setup:

```tsx
// src/App.tsx (example router part)
<Routes>
  <Route path="/auth/callback" element={<AuthCallback />} />
</Routes>
```

## API

### `<AuthProvider config={authProviderConfig}>`

The main provider component that wraps your application or a part of it.

**Props:**

*   `config` (`AuthProviderConfig`): **Required**. An object to configure the provider.
*   `authServerUrl` (string): **Required**. The base URL of your Magic Monad authentication server (e.g., `https://auth.mgcmnd.net`).
*   `defaultAppRedirectPath?` (string): The path within your SPA where the auth server should redirect the user after a login attempt. Defaults to `'/auth/callback'`. The full URL (e.g., `http://localhost:3000/auth/callback`) must be registered as an allowed redirect URI on your OAuth applications (Google, GitHub) via your auth server.
*   `tokenStorageKey?` (string): The key used for storing the JWT in `localStorage`. Defaults to `'mgcmnd_auth_token'`.
*   `stateStorageKey?` (string): The key used for storing the OAuth state string in `sessionStorage` for CSRF protection. Defaults to `'mgcmnd_oauth_app_state'`.
*   `onLoginSuccess?` ((user: AuthUser, token: string) => void): Optional callback function executed after a user successfully logs in and the token is processed.
*   `onLogoutSuccess?` (() => void): Optional callback function executed after a user logs out.

### `useAuth()`

A React hook to access the authentication state and methods from within components nested under `<AuthProvider>`. It returns an object with the following properties:

*   `isAuthenticated` (boolean): `true` if a user is currently authenticated, `false` otherwise.
*   `user` (AuthUser | null): An object containing the authenticated user's information (decoded from the JWT), or `null` if not authenticated.
*   `token` (string | null): The raw JWT string if authenticated, or `null`.
*   `isLoading` (boolean): `true` when the authentication state is being determined (e.g., on initial load, during callback processing), `false` otherwise.
*   `error` (string | null): An error message string if an authentication-related error occurred, or `null`.
*   `loginWithGoogle(appRedirectUriPath: string, appState?: string)`: A function to initiate the login flow with Google.
    *   `appRedirectUriPath`: The path in your SPA (e.g., `'/auth/callback'`) where your auth server should redirect back to after Google authentication.
    *   `appState?`: Optional client-side state string for CSRF protection or to restore application state.
*   `loginWithGitHub(appRedirectUriPath: string, appState?: string)`: A function to initiate the login flow with GitHub. (Same parameters as `loginWithGoogle`).
*   `loginWithEmailRequest(email: string, appRedirectUriPath: string, appState?: string): Promise<void>`: A function to request a login link/token via email.
*   `handleAuthCallback(): Promise<void>`: A function to be called in your SPA's redirect target component (specified by `appRedirectUriPath` during login). It processes URL parameters (`token`, `state`, `error`) from the auth server.
*   `logout(logoutRedirectUri?: string)`: A function to log the user out. Clears stored authentication data.
    *   `logoutRedirectUri?`: Optional URL or path to redirect the user to after logout.
*   `getAccessToken(): string | null`: A function that returns the current raw JWT string, or `null` if not authenticated.

## License

GPL-3.0