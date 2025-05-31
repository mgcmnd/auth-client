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

### 1. Wrap your Application with `AuthProvider`

Wrap your application's root (or relevant part of the component tree) with the `AuthProvider`. You **must** provide a configuration object.

```tsx
// src/App.tsx or your main application entry point
import React from 'react';
import { AuthProvider, AuthProviderConfig } from '@mgcmnd/auth-client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AuthCallbackPage from './pages/AuthCallbackPage'; // Page to host AuthCallbackHandler

const authConfig: AuthProviderConfig = {
  defaultAppRedirectPath: '/auth/callback',
  // Optional configurations:
  // authServerUrl: 'https://your-custom-auth-server.com', // Defaults to 'https://auth.mgcmnd.net'
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
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### 2. Handle the Authentication Callback with `AuthCallbackHandler`

Create a dedicated page component for the path specified in `defaultAppRedirectPath` (e.g., `/auth/callback`). On this page, use the `<AuthCallbackHandler />` component. It will automatically call `handleAuthCallback` from the context and trigger `onSuccess` or `onError` callbacks, which you use to navigate the user.

```tsx
// src/pages/AuthCallbackPage.tsx (Example)
import React from 'react';
import { AuthCallbackHandler } from '@mgcmnd/auth-client';
import { useNavigate } from 'react-router-dom';

function AuthCallbackPage() {
  const navigate = useNavigate();

  return (
    <AuthCallbackHandler
      renderLoading={() => <p>Please wait, authenticating...</p>}
      onSuccess={() => {
        console.log("AuthCallbackHandler: Success! Navigating to /dashboard");
        // Redirect to a protected route or user dashboard
        navigate('/dashboard', { replace: true }); 
      }}
      onError={(errorMessage) => {
        console.error("AuthCallbackHandler: Error! Navigating to /login. Error:", errorMessage);
        // Redirect to login page, possibly with error information
        navigate('/login?authError=' + encodeURIComponent(errorMessage), { replace: true });
      }}
    />
  );
}

export default AuthCallbackPage;
```

### 3. Accessing Auth State and Login/Logout Functions

Use the `useAuth` hook within any component that is a descendant of `AuthProvider` to access authentication state and trigger login or logout actions.

```tsx
// src/components/UserProfile.tsx (Example Component)
import React from 'react';
import { useAuth } from '@mgcmnd/auth-client';
import { Link } from 'react-router-dom';

function UserProfile() {
  const { isAuthenticated, user, logout, isLoading, error, loginWithGoogle } = useAuth();

  if (isLoading && !isAuthenticated) {
    return <p>Loading authentication state...</p>;
  }

  if (error) {
    return <p>Authentication Error: {error}</p>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div>
        <p>You are not logged in.</p>
        <button onClick={() => loginWithGoogle('/auth/callback')}>Login with Google</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome, {user.name || user.email}!</h1>
      {user.email && <p>Email: {user.email}</p>}
      {user.picture && <img src={user.picture} alt={user.name || 'User avatar'} style={{ borderRadius: '50%', width: '50px', height: '50px' }} />}
      <h3>User Details (from JWT):</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={() => logout('/')}>Logout</button>
    </div>
  );
}

export default UserProfile;
```

## API

### `<AuthProvider config={authProviderConfig}>`

The main provider component that wraps your application or a part of it.

**Props:**

*   `config` (`AuthProviderConfig`): **Required**. An object to configure the provider.
    *   `authServerUrl?` (string): **Optional**. The base URL of your Magic Monad authentication server. Defaults to `'https://auth.mgcmnd.net'`.
    *   `defaultAppRedirectPath?` (string): The path within your SPA where the auth server should redirect the user after a login attempt. Defaults to `'/auth/callback'`. The full URL (e.g., `http://localhost:3000/auth/callback`) must be registered as an allowed redirect URI on your OAuth applications (Google, GitHub) via your auth server.
    *   `tokenStorageKey?` (string): The key used for storing the JWT in `localStorage`. Defaults to `'mgcmnd_auth_token'`.
    *   `stateStorageKey?` (string): The key used for storing the OAuth state string in `sessionStorage` for CSRF protection. Defaults to `'mgcmnd_oauth_app_state'`.
    *   `onLoginSuccess?` ((user: AuthUser, token: string) => void): Optional callback function executed after a user successfully logs in and the token is processed. This is triggered by `saveTokenAndUser` which is called by `handleAuthCallback` (used internally by `AuthCallbackHandler`).
    *   `onLogoutSuccess?` (() => void): Optional callback function executed after a user logs out.

### `<AuthCallbackHandler {...props} />`

A component to handle the OAuth callback flow. It should be rendered on the route that your authentication server redirects back to.

**Props:**

*   `renderLoading?` (() => React.ReactNode): Optional. A function that returns a React Node to display while authentication is being processed. Defaults to `<p>Processing authentication...</p>`.
*   `onSuccess?` (() => void): Optional. Callback function executed after `handleAuthCallback` successfully authenticates the user. Use this to navigate the user to a protected area of your application.
*   `onError?` ((errorMsg: string) => void): Optional. Callback function executed if `handleAuthCallback` encounters an error. Use this to navigate the user to a login or error page. `errorMsg` contains the error details.

### `useAuth()`

A React hook to access the authentication state and methods from within components nested under `<AuthProvider>`. It returns an object with the following properties:

*   `isAuthenticated` (boolean): `true` if a user is currently authenticated, `false` otherwise.
*   `user` (AuthUser | null): An object containing the authenticated user's information (decoded from the JWT), or `null` if not authenticated.
*   `token` (string | null): The raw JWT string if authenticated, or `null`.
*   `isLoading` (boolean): `true` when the authentication state is being determined (e.g., on initial load, during callback processing via `AuthCallbackHandler`), `false` otherwise.
*   `error` (string | null): An error message string if an authentication-related error occurred, or `null`.
*   `loginWithGoogle(appRedirectUriPath: string, appState?: string)`: A function to initiate the login flow with Google.
    *   `appRedirectUriPath`: The path in your SPA (e.g., `'/auth/callback'`) where your auth server should redirect back to after Google authentication.
    *   `appState?`: Optional client-side state string for CSRF protection or to restore application state.
*   `loginWithGitHub(appRedirectUriPath: string, appState?: string)`: A function to initiate the login flow with GitHub. (Same parameters as `loginWithGoogle`).
*   `loginWithEmailRequest(email: string, appRedirectUriPath: string, appState?: string): Promise<void>`: A function to request a login link/token via email.
*   `handleAuthCallback(): Promise<void>`: **Internal Use by `AuthCallbackHandler`**. This function processes URL parameters (`token`, `state`, `error`) from the auth server. While exposed, direct use is generally not needed if using `<AuthCallbackHandler />`.
*   `logout(logoutRedirectUri?: string)`: A function to log the user out. Clears stored authentication data.
    *   `logoutRedirectUri?`: Optional URL or path to redirect the user to after logout.
*   `getAccessToken(): string | null`: A function that returns the current raw JWT string, or `null` if not authenticated.

## License

GPL-3.0