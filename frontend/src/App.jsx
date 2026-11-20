import React, { useEffect, useState } from 'react';

import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation
} from 'react-router-dom';

import { useCart } from './context/CartContext.jsx';
import { api } from './services/api.js';

import ProductsPage from './pages/ProductsPage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import MyOrdersPage from './pages/MyOrdersPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

import StatusMessage from './components/StatusMessage.jsx';

export default function App() {
  const { itemCount } = useCart();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const authDestination =
    location.state?.from === '/checkout'
      ? '/checkout'
      : '/';

  // Restore customer session

  useEffect(() => {
    let active = true;

    api.getCurrentUser()
      .then((result) => {
        if (active) {
          setUser(result.user);
        }
      })
      .catch((error) => {
        if (active) {
          setUser(null);

          if (error.status !== 401) {
            setAuthError(
              'Unable to verify your session.'
            );
          }
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function handleAuthSuccess(account) {
    setUser(account);
    setAuthError('');
  }

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError('');

    try {
      await api.logout();
      setUser(null);

    } catch (error) {
      setAuthError(
        error.message || 'Unable to sign out.'
      );

    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">

      <header className="site-header">

        <NavLink className="brand" to="/">
          ShopSmart
        </NavLink>

        <nav aria-label="Primary navigation">

          <NavLink to="/" end>
            Products
          </NavLink>

          <NavLink to="/assistant">
            AI Assistant
          </NavLink>

          <NavLink to="/cart">
            Cart ({itemCount})
          </NavLink>

          {!authLoading && (
            user ? (
              <>

                <NavLink to="/orders">
                  My Orders
                </NavLink>

                <span className="customer-greeting">
                  Hi, {user.name}
                </span>

                <button
                  type="button"
                  className="logout-button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut
                    ? 'Signing out...'
                    : 'Logout'}
                </button>

              </>
            ) : (
              <>

                <NavLink to="/login">
                  Login
                </NavLink>

                <NavLink to="/register">
                  Register
                </NavLink>

              </>
            )
          )}

        </nav>

      </header>

      <main>

        {authError && (
          <StatusMessage type="error">
            {authError}
          </StatusMessage>
        )}

        <Routes>

          {/* Public pages */}

          <Route
            path="/"
            element={<ProductsPage />}
          />

          <Route
            path="/products/:productId"
            element={<ProductDetailsPage />}
          />

          <Route
            path="/cart"
            element={<CartPage />}
          />

          <Route
            path="/assistant"
            element={<AssistantPage />}
          />

          {/* Login */}

          <Route
            path="/login"
            element={
              authLoading ? (
                <p>Checking session...</p>
              ) : user ? (
                <Navigate
                  to={authDestination}
                  replace
                />
              ) : (
                <AccountPage
                  key="login"
                  mode="login"
                  onSuccess={handleAuthSuccess}
                />
              )
            }
          />

          {/* Registration */}

          <Route
            path="/register"
            element={
              authLoading ? (
                <p>Checking session...</p>
              ) : user ? (
                <Navigate
                  to={authDestination}
                  replace
                />
              ) : (
                <AccountPage
                  key="register"
                  mode="register"
                  onSuccess={handleAuthSuccess}
                />
              )
            }
          />

          {/* Protected checkout */}

          <Route
            path="/checkout"
            element={
              authLoading ? (
                <p>Checking session...</p>
              ) : user ? (
                <CheckoutPage
                  key={user.id}
                  user={user}
                />
              ) : (
                <Navigate
                  to="/login"
                  state={{ from: '/checkout' }}
                  replace
                />
              )
            }
          />

          {/* Protected My Orders */}

          <Route
            path="/orders"
            element={
              authLoading ? (
                <p>Checking session...</p>
              ) : user ? (
                <MyOrdersPage key={user.id} />
              ) : (
                <Navigate
                  to="/login"
                  replace
                />
              )
            }
          />

          <Route
            path="*"
            element={<NotFoundPage />}
          />

        </Routes>

      </main>

      <footer className="site-footer">
        ShopSmart classroom starter •
        Simulated purchases only
      </footer>

    </div>
  );
}