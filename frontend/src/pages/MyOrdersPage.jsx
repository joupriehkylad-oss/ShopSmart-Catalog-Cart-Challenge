import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';

function formatPrice(value) {
  return Number(value).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP'
  });
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.getOrders()
      .then((result) => {
        if (active) {
          setOrders(result.orders);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <p className="eyebrow">
        SHOPSMART CUSTOMER ACCOUNT
      </p>

      <h1>My Orders</h1>

      <p>
        View your simulated purchases and order history.
      </p>

      {error && (
        <StatusMessage type="error">
          {error}
        </StatusMessage>
      )}

      {loading && (
        <StatusMessage>
          Loading your orders...
        </StatusMessage>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <h2>No orders yet</h2>

          <p>
            Your completed checkout orders will appear here.
          </p>

          <Link className="button" to="/">
            Start shopping
          </Link>
        </div>
      )}

      {!loading && !error && orders.map((order) => (
        <article
          key={order.id}
          className="summary"
          style={{ marginBottom: '20px' }}
        >
          <h2>Order #{order.id}</h2>

          <p>
            <strong>Status:</strong> {order.status}
          </p>

          <p>
            <strong>Order date:</strong>{' '}
            {new Date(order.createdAt).toLocaleString('en-PH')}
          </p>

          <p>
            <strong>Customer:</strong> {order.customerName}
          </p>

          <p>
            <strong>Delivery address:</strong> {order.address}
          </p>

          <hr />

          <h3>Ordered products</h3>

          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px 0',
                borderBottom: '1px solid #ddd'
              }}
            >
              <strong>
                {item.product?.emoji}{' '}
                {item.product?.name || `Product #${item.productId}`}
              </strong>

              <p>Quantity: {item.quantity}</p>

              <p>
                Unit price: {formatPrice(item.unitPrice)}
              </p>

              <p>
                Subtotal:{' '}
                {formatPrice(item.unitPrice * item.quantity)}
              </p>

              <Link to={`/products/${item.productId}`}>
                View product
              </Link>
            </div>
          ))}

          <p className="summary-total">
            <span>Order total</span>

            <strong>
              {formatPrice(order.total)}
            </strong>
          </p>

          <small>
            Simulated purchase — no actual payment collected.
          </small>
        </article>
      ))}
    </section>
  );
}