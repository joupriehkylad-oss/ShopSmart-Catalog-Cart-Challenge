const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:3000/api'
    : '/api');

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Request failed with status ${response.status}.`;

    const error = new Error(message);

    error.status = response.status;
    error.code = data?.error?.code;

    throw error;
  }

  return data;
}

export const api = {
  // PRODUCTS

  getProducts: (query = '') =>
    request(
      `/products${query ? `?search=${encodeURIComponent(query)}` : ''}`
    ),

  getProduct: (id) =>
    request(`/products/${id}`),

  // AUTHENTICATION

  register: (account) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(account)
    }),

  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getCurrentUser: () =>
    request('/auth/me'),

  logout: () =>
    request('/auth/logout', {
      method: 'POST'
    }),

  // ORDERS

  createOrder: (order) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    }),

  getOrders: () =>
    request('/orders'),

  getOrder: (id) =>
    request(`/orders/${id}`),

  // AI ASSISTANT

  askAssistant: (question) =>
    request('/assistant/questions', {
      method: 'POST',
      body: JSON.stringify({ question })
    })
};