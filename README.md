# @mgcmnd/auth-client

A simple and lightweight React authentication provider for client-side authentication with the [Magic Monad](https://magicmonad.com) authentication server (`auth.mgcmnd.net`).

## Features

* 🎯 **Simple API** - Minimal configuration with sensible defaults
* 🔐 **OAuth Support** - Google and GitHub authentication out of the box
* 📧 **Email Authentication** - Magic link authentication via email
* 🛡️ **CSRF Protection** - Built-in state management for secure OAuth flows
* 🪶 **Lightweight** - No unnecessary dependencies or complex state management
* ⚡ **Fast** - Optimized to avoid redundant re-renders and API calls
* 🎨 **TypeScript** - Full TypeScript support with exported types

## Installation

```bash
npm install @mgcmnd/auth-client
```

**Peer Dependencies:**
- `react` (^17.0.0 || ^18.0.0 || ^19.0.0)
- `jwt-decode` (^4.0.0)

## Quick Start

### 1. Wrap your app with `AuthProvider`

```tsx
import React from 'react';
import { AuthProvider } from '@mgcmnd/auth-client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';

const authConfig = {
  authServerUrl: 'https://auth.mgcmnd.net', // Optional, this is the default
  redirectPath: '/auth/callback',           // Optional, this is the default
  onLoginSuccess: (user, token) => {
    console.log('User logged in:', user);
  },
  onLogoutSuccess: () => {
    console.log('User logged out');
  }
};

function Root() {
  return (
    <AuthProvider config={authConfig}>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  );
}
```

### 2. Create an authentication callback page

```tsx
// pages/AuthCallback.tsx
import React from 'react';
import { AuthCallbackHandler } from '@mgcmnd/auth-client';
import { useNavigate } from 'react-router-dom';

function AuthCallbackPage() {
  const navigate = useNavigate();

  return (
    <AuthCallbackHandler
      onSuccess={() => navigate('/dashboard', { replace: true })}
      onError={(error) => navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })}
      loading={<div>Authenticating...</div>}
    />
  );
}
```

### 3. Use authentication in your components

```tsx
import React from 'react';
import { useAuth } from '@mgcmnd/auth-client';

function LoginPage() {
  const { loginWithGoogle, loginWithGitHub, loginWithEmail, isLoading, error } = useAuth();
  const [email, setEmail] = React.useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      await loginWithEmail(email);
      alert('Check your email for a login link!');
    } catch (err) {
      // Error is automatically set in auth state
    }
  };

  return (
    <div>
      <h1>Login</h1>

      {error && <div className="error">{error}</div>}

      <button onClick={() => loginWithGoogle()} disabled={isLoading}>
        Login with Google
      </button>

      <button onClick={() => loginWithGitHub()} disabled={isLoading}>
        Login with GitHub
      </button>

      <form onSubmit={handleEmailLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
        <button type="submit" disabled={isLoading}>
          Send Login Link
        </button>
      </form>
    </div>
  );
}

function UserProfile() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.name || user?.email}!</h1>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={() => logout('/')}>Logout</button>
    </div>
  );
}
```

## API Reference

### `<AuthProvider>`

The main provider component that manages authentication state.

**Props:**
- `config` (optional): Configuration object
  - `authServerUrl?: string` - Auth server URL (default: `'https://auth.mgcmnd.net'`)
  - `redirectPath?: string` - OAuth callback path (default: `'/auth/callback'`)
  - `tokenStorageKey?: string` - LocalStorage key for JWT (default: `'mgcmnd_auth_token'`)
  - `onLoginSuccess?: (user: AuthUser, token: string) => void` - Called after successful login
  - `onLogoutSuccess?: () => void` - Called after logout

### `<AuthCallbackHandler>`

Handles OAuth callback on your redirect page.

**Props:**
- `onSuccess?: () => void` - Called after successful authentication
- `onError?: (error: string) => void` - Called on authentication error
- `loading?: React.ReactNode` - Loading component (default: `<p>Processing authentication...</p>`)

### `useAuth()`

Hook to access authentication state and methods.

**Returns:**
```typescript
{
  // State
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Methods
  loginWithGoogle: (redirectPath?: string) => void;
  loginWithGitHub: (redirectPath?: string) => void;
  loginWithEmail: (email: string, redirectPath?: string) => Promise<void>;
  logout: (redirectUrl?: string) => void;
  handleCallback: () => void;  // Used internally by AuthCallbackHandler
}
```

### Types

```typescript
interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: any;  // Additional JWT claims
}

interface AuthConfig {
  authServerUrl?: string;
  tokenStorageKey?: string;
  redirectPath?: string;
  onLoginSuccess?: (user: AuthUser, token: string) => void;
  onLogoutSuccess?: () => void;
}
```

## Protected Routes Example

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@mgcmnd/auth-client';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Usage
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

## Complete Example

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, AuthCallbackHandler } from '@mgcmnd/auth-client';

// Auth callback page
function AuthCallback() {
  const navigate = useNavigate();
  return (
    <AuthCallbackHandler
      onSuccess={() => navigate('/dashboard')}
      onError={(err) => navigate(`/login?error=${err}`)}
    />
  );
}

// Login page
function Login() {
  const { loginWithGoogle, error } = useAuth();

  return (
    <div>
      <h1>Login</h1>
      {error && <p>Error: {error}</p>}
      <button onClick={() => loginWithGoogle()}>
        Login with Google
      </button>
    </div>
  );
}

// Protected dashboard
function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => logout('/')}>Logout</button>
    </div>
  );
}

// Main app
function App() {
  return (
    <AuthProvider config={{
      onLoginSuccess: (user) => console.log('Logged in:', user)
    }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

## License

GPL-3.0