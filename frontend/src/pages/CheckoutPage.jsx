import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

function formatPrice(value) {
  return Number(value).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP'
  });
}

export default function CheckoutPage({ user }) {
  const { cart, total, clearCart } = useCart();

  const [form, setForm] = useState({
    customerName: user?.name || '',
    address: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (submitting || !user || cart.length === 0) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const created = await api.createOrder({
        customerName: form.customerName.trim(),
        email: user.email,
        address: form.address.trim(),

        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });

      setOrder(created);
      clearCart();

    } catch (caught) {
      setError(
        caught.message || 'Unable to place your order.'
      );

    } finally {
      setSubmitting(false);
    }
  }

  // Successful order receipt

  if (order) {
    return (
      <section className="success-card">

        <p className="eyebrow">
          ORDER RECEIVED
        </p>

        <h1>Thank you, {order.customerName}!</h1>

        <p>
          Your simulated order has been placed successfully.
        </p>

        <p>
          <strong>Order number:</strong> #{order.id}
        </p>

        <p>
          <strong>Status:</strong> {order.status}
        </p>

        <p>
          <strong>Total:</strong> {formatPrice(order.total)}
        </p>

        <p>
          Your order has been saved to your ShopSmart account.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <Link className="button" to="/orders">
            View My Orders
          </Link>

          <Link className="button" to="/">
            Continue shopping
          </Link>
        </div>

        <p>
          <small>No actual payment was collected.</small>
        </p>

      </section>
    );
  }

  // Empty cart

  if (cart.length === 0) {
    return (
      <section className="empty-state">

        <h1>Your cart is empty</h1>

        <Link className="button" to="/">
          Browse products
        </Link>

      </section>
    );
  }

  return (
    <section className="checkout-layout">

      <form onSubmit={submitOrder}>

        <p className="eyebrow">
          SIMULATED CHECKOUT
        </p>

        <h1>Delivery information</h1>

        <p>
          Signed in as {user?.name}
        </p>

        {error && (
          <StatusMessage type="error">
            {error}
          </StatusMessage>
        )}

        <label>
          Full name

          <input
            name="customerName"
            value={form.customerName}
            onChange={updateField}
            minLength={2}
            maxLength={80}
            disabled={submitting}
            required
          />
        </label>

        <label>
          Email address

          <input
            type="email"
            value={user?.email || ''}
            readOnly
          />
        </label>

        <small>
          Your order will be linked to this account.
        </small>

        <label>
          Delivery address

          <textarea
            name="address"
            value={form.address}
            onChange={updateField}
            minLength={10}
            maxLength={300}
            placeholder="Enter a fictional delivery address"
            disabled={submitting}
            required
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Submitting order...'
            : 'Place simulated order'}
        </button>

      </form>

      <aside className="summary">

        <h2>Checkout Review</h2>

        <p>
          Review your items before placing your order.
        </p>

        {cart.map((item) => (
          <div
            key={item.productId}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid #ddd'
            }}
          >
            <strong>{item.name}</strong>

            <p>
              Quantity: {item.quantity}
            </p>

            <p>
              {formatPrice(item.price)} × {item.quantity}
            </p>

            <p>
              Subtotal:{' '}

              <strong>
                {formatPrice(item.price * item.quantity)}
              </strong>
            </p>

          </div>
        ))}

        <p className="summary-total">

          <span>Total</span>

          <strong>
            {formatPrice(total)}
          </strong>

        </p>

        <Link to="/cart">
          Back to cart
        </Link>

        <p>
          <small>
            Classroom demonstration only.
            No actual payment will be collected.
          </small>
        </p>

      </aside>

    </section>
  );
}