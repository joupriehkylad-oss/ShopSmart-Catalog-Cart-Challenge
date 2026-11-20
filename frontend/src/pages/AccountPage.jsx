import React, { useState } from 'react';
import {
  Link,
  useNavigate,
  useLocation
} from 'react-router-dom';

import { api } from '../services/api.js';
import StatusMessage from '../components/StatusMessage.jsx';

export default function AccountPage({ mode, onSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isRegister = mode === 'register';

  const destination =
    location.state?.from === '/checkout'
      ? '/checkout'
      : '/';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (
      isRegister &&
      form.password !== form.confirmPassword
    ) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      let result;

      if (isRegister) {
        result = await api.register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        });
      } else {
        result = await api.login({
          email: form.email.trim(),
          password: form.password
        });
      }

      onSuccess(result.user);

      navigate(destination, {
        replace: true
      });

    } catch (caught) {
      setError(
        caught.message || 'Unable to complete the request.'
      );

    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="account-page"
      style={{
        maxWidth: '480px',
        margin: '30px auto'
      }}
    >
      <p className="eyebrow">
        SHOPSMART CUSTOMER ACCOUNT
      </p>

      <h1>
        {isRegister
          ? 'Create an account'
          : 'Welcome back'}
      </h1>

      <p>
        {isRegister
          ? 'Create your account to securely place and track your orders.'
          : 'Sign in to continue shopping with ShopSmart.'}
      </p>

      {error && (
        <StatusMessage type="error">
          {error}
        </StatusMessage>
      )}

      <form onSubmit={handleSubmit}>

        {/* FULL NAME */}

        {isRegister && (
          <label>
            Full name

            <input
              name="name"
              type="text"
              value={form.name}
              onChange={updateField}
              placeholder="Enter your full name"
              minLength={2}
              maxLength={100}
              autoComplete="name"
              disabled={submitting}
              required
            />
          </label>
        )}

        {/* EMAIL */}

        <label>
          Email address

          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            placeholder="Enter your email address"
            maxLength={254}
            autoComplete="email"
            disabled={submitting}
            required
          />
        </label>

        {/* PASSWORD */}

        <label>
          Password

          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            placeholder="Enter your password"
            minLength={12}
            maxLength={128}
            autoComplete={
              isRegister
                ? 'new-password'
                : 'current-password'
            }
            disabled={submitting}
            required
          />
        </label>

        {/* CONFIRM PASSWORD */}

        {isRegister && (
          <>
            <small>
              Your password must contain at least
              12 characters.
            </small>

            <label>
              Confirm password

              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={updateField}
                placeholder="Confirm your password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                disabled={submitting}
                required
              />
            </label>
          </>
        )}

        {/* SUBMIT BUTTON */}

        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Processing...'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </button>

        {/* SWITCH LOGIN AND REGISTER */}

        <p>
          {isRegister
            ? 'Already have an account? '
            : 'Do not have an account? '}

          <Link
            to={
              isRegister
                ? '/login'
                : '/register'
            }
            state={location.state}
          >
            {isRegister
              ? 'Sign in'
              : 'Register here'}
          </Link>
        </p>

      </form>

      <p>
        <small>
          Classroom demonstration only.
          Please use fictional customer information.
        </small>
      </p>

    </section>
  );
}