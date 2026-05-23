/* =========================================================================
   BKDziti Store — frontend JavaScript
   Handles: storefront, cart, checkout, confirmation, order lookup.
   ========================================================================= */
(function () {
  'use strict';

  // ── Cart helpers (localStorage) ──────────────────────────────────────────

  const CART_KEY = 'bkdziti_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
  }

  function addToCart(product, qty = 1) {
    const cart = getCart();
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + qty);
    } else {
      cart.push({ productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl || '', category: product.category, quantity: qty });
    }
    saveCart(cart);
  }

  function removeFromCart(productId) {
    saveCart(getCart().filter(i => i.productId !== productId));
  }

  function updateQuantity(productId, qty) {
    const cart = getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
      if (qty <= 0) return removeFromCart(productId);
      item.quantity = Math.min(99, qty);
      saveCart(cart);
    }
  }

  function cartTotal(cart) {
    return cart.reduce((s, i) => s + i.price * i.quantity, 0);
  }

  function formatPrice(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function cartCount(cart) {
    return cart.reduce((s, i) => s + i.quantity, 0);
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const n = cartCount(getCart());
    badge.textContent = n > 0 ? n : '';
    badge.setAttribute('data-count', String(n));
  }

  // ── Status badge helper ──────────────────────────────────────────────────

  function statusBadgeHtml(status) {
    const icons = { pending: 'fa-clock', paid: 'fa-check-circle', processing: 'fa-cog', fulfilled: 'fa-box', cancelled: 'fa-times-circle' };
    const icon = icons[status] || 'fa-question-circle';
    return `<span class="order-status-badge ${status}"><i class="fas ${icon}"></i>${status}</span>`;
  }

  // ── Page: Storefront ─────────────────────────────────────────────────────

  function initStorefront() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    let allProducts = [];
    let activeCategory = 'all';
    let searchQuery = '';

    function renderGrid() {
      let filtered = allProducts;
      if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
        );
      }

      if (!filtered.length) {
        grid.innerHTML = `<div class="product-grid-empty"><i class="fas fa-search" style="font-size:2rem;color:rgba(249,83,1,0.2);display:block;margin-bottom:1rem"></i>${searchQuery || activeCategory !== 'all' ? 'No products match your search.' : 'No products yet — check back soon!'}</div>`;
        return;
      }

      grid.innerHTML = filtered.map(p => `
        <div class="product-card" data-id="${p.id}">
          ${p.imageUrl
            ? `<img class="product-card-img" src="${p.imageUrl}" alt="${escHtml(p.name)}" loading="lazy">`
            : `<div class="product-card-img-placeholder"><i class="fas fa-image"></i></div>`}
          <div class="product-card-body">
            <div class="product-card-category">${escHtml(p.category)}</div>
            <div class="product-card-name">${escHtml(p.name)}</div>
            <div class="product-card-desc">${escHtml(p.description || '')}</div>
            <div class="product-card-footer">
              <div class="product-card-price">${formatPrice(p.price)}</div>
              <button class="add-to-cart-btn" data-id="${p.id}" aria-label="Add ${escHtml(p.name)} to cart">
                <i class="fas fa-cart-plus"></i> Add
              </button>
            </div>
          </div>
        </div>
      `).join('');

      grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = btn.dataset.id;
          const product = allProducts.find(p => p.id === id);
          if (!product) return;
          addToCart(product);
          btn.classList.add('added');
          btn.innerHTML = '<i class="fas fa-check"></i> Added!';
          setTimeout(() => {
            btn.classList.remove('added');
            btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add';
          }, 1400);
        });
      });
    }

    function buildCategoryFilters(products) {
      const filterWrap = document.getElementById('categoryFilters');
      if (!filterWrap) return;
      const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
      const all = [{ id: 'all', label: 'All' }, ...categories.map(c => ({ id: c, label: c }))];
      filterWrap.innerHTML = all.map(c =>
        `<button class="store-filter-btn${c.id === 'all' ? ' active' : ''}" data-cat="${c.id}">${escHtml(c.label)}</button>`
      ).join('');
      filterWrap.querySelectorAll('.store-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          filterWrap.querySelectorAll('.store-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeCategory = btn.dataset.cat;
          renderGrid();
        });
      });
    }

    const searchEl = document.getElementById('storeSearch');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        searchQuery = searchEl.value.trim();
        renderGrid();
      });
    }

    grid.innerHTML = `<div class="store-loading"><i class="fas fa-circle-notch"></i>Loading products…</div>`;
    fetch('/api/store/products')
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || 'Failed to load');
        allProducts = data.products || [];
        buildCategoryFilters(allProducts);
        renderGrid();
      })
      .catch(err => {
        grid.innerHTML = `<div class="store-error"><i class="fas fa-exclamation-circle"></i><h3>Could not load products</h3><p>${escHtml(err.message)}</p></div>`;
      });
  }

  // ── Page: Cart ───────────────────────────────────────────────────────────

  function initCartPage() {
    const container = document.getElementById('cartContainer');
    if (!container) return;

    function render() {
      const cart = getCart();
      if (!cart.length) {
        container.innerHTML = `
          <div class="cart-empty-state">
            <i class="fas fa-shopping-cart"></i>
            <p>Your cart is empty.</p>
            <a href="index.html" class="pill-btn">Browse Products <i class="fas fa-arrow-right"></i></a>
          </div>`;
        return;
      }

      const total = cartTotal(cart);
      container.innerHTML = `
        <div style="overflow-x:auto">
          <table class="cart-table">
            <thead><tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${cart.map(item => `
                <tr class="cart-row" data-id="${item.productId}">
                  <td>
                    <div class="cart-item-info">
                      ${item.imageUrl
                        ? `<img class="cart-item-img" src="${item.imageUrl}" alt="">`
                        : `<div class="cart-item-img-placeholder"><i class="fas fa-image"></i></div>`}
                      <div>
                        <div class="cart-item-name">${escHtml(item.name)}</div>
                        <div class="cart-item-category">${escHtml(item.category || '')}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="qty-control">
                      <button class="qty-btn" data-action="dec" data-id="${item.productId}" aria-label="Decrease">−</button>
                      <span class="qty-value">${item.quantity}</span>
                      <button class="qty-btn" data-action="inc" data-id="${item.productId}" aria-label="Increase">+</button>
                    </div>
                  </td>
                  <td><span class="cart-price">${formatPrice(item.price * item.quantity)}</span></td>
                  <td><button class="remove-btn" data-id="${item.productId}" aria-label="Remove"><i class="fas fa-times"></i></button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="cart-summary">
          <div class="cart-summary-row"><span>Subtotal</span><span>${formatPrice(total)}</span></div>
          <div class="cart-summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
          <div class="cart-actions">
            <a href="index.html" class="pill-btn" style="margin-top:0">Continue Shopping</a>
            <a href="checkout.html" class="pill-btn" style="margin-top:0;background:rgba(249,83,1,0.15);border-color:var(--orange)">
              Checkout <i class="fas fa-arrow-right"></i>
            </a>
          </div>
        </div>`;

      container.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = btn.dataset.id;
          const item = getCart().find(i => i.productId === id);
          if (!item) return;
          const newQty = btn.dataset.action === 'inc' ? item.quantity + 1 : item.quantity - 1;
          updateQuantity(id, newQty);
          render();
        });
      });
      container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => { removeFromCart(btn.dataset.id); render(); });
      });
    }

    render();
  }

  // ── Page: Checkout ───────────────────────────────────────────────────────

  function initCheckoutPage() {
    const form    = document.getElementById('checkoutForm');
    const summary = document.getElementById('checkoutSummary');
    if (!form || !summary) return;

    const cart = getCart();
    if (!cart.length) { window.location.href = 'cart.html'; return; }

    const total = cartTotal(cart);
    summary.innerHTML = cart.map(item => `
      <div class="checkout-order-item">
        <div>
          <div class="checkout-order-item-name">${escHtml(item.name)}</div>
          <div class="checkout-order-item-qty">×${item.quantity}</div>
        </div>
        <div style="font-family:'Dela Gothic One',sans-serif;color:var(--amber)">${formatPrice(item.price * item.quantity)}</div>
      </div>
    `).join('') + `<div class="checkout-order-total"><span>Total</span><span>${formatPrice(total)}</span></div>`;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payBtn = form.querySelector('.pay-btn');
      payBtn.disabled = true;
      payBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Redirecting to Stripe…';

      try {
        const resp = await fetch('/api/store/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName:  form.querySelector('[name=name]').value.trim(),
            customerEmail: form.querySelector('[name=email]').value.trim(),
            items: cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
          })
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Checkout failed');

        // Clear cart before redirect so confirmation page is clean
        saveCart([]);
        window.location.href = data.url;
      } catch (err) {
        payBtn.disabled = false;
        payBtn.innerHTML = '<i class="fas fa-lock"></i> Pay Securely with Stripe';
        showStoreToast(err.message || 'Checkout failed. Please try again.', true);
      }
    });
  }

  // ── Page: Confirmation ───────────────────────────────────────────────────

  function initConfirmationPage() {
    const container = document.getElementById('confirmationContainer');
    if (!container) return;

    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      container.innerHTML = `<div class="store-error"><i class="fas fa-exclamation-circle"></i><h3>No session found</h3><p>Please check your email for your order confirmation.</p><a href="index.html" class="pill-btn" style="margin-top:1.5rem">Back to Store</a></div>`;
      return;
    }

    container.innerHTML = `<div class="store-loading"><i class="fas fa-circle-notch"></i>Verifying your order…</div>`;

    fetch(`/api/store/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || 'Could not verify order');
        const order = data.order;
        const isPaid = data.paymentStatus === 'paid' || order.status === 'paid';
        container.innerHTML = `
          <div class="order-card">
            <div class="confirmation-icon"><i class="fas ${isPaid ? 'fa-check' : 'fa-clock'}"></i></div>
            <h2>${isPaid ? 'Order Confirmed!' : 'Order Received'}</h2>
            <div class="order-id-label">Order #${order.id.slice(-12).toUpperCase()}</div>
            <p style="color:rgba(252,249,245,0.65);margin-bottom:1.5rem">
              ${isPaid
                ? `Thanks, <strong>${escHtml(order.customer.name)}</strong>! Your payment was received and a confirmation email has been sent to <strong>${escHtml(order.customer.email)}</strong>.`
                : `Your order is being processed. A confirmation email will be sent to <strong>${escHtml(order.customer.email)}</strong> once payment is confirmed.`}
            </p>
            ${statusBadgeHtml(isPaid ? 'paid' : 'pending')}
            <table class="order-items-table" style="margin-top:1.5rem">
              <thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td>${escHtml(item.name)}</td>
                    <td>×${item.quantity}</td>
                    <td>${formatPrice(item.price * item.quantity)}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="order-total-row">
                  <td colspan="2">Total</td>
                  <td>${formatPrice(order.total)}</td>
                </tr>
              </tfoot>
            </table>
            <div style="margin-top:2rem;display:flex;gap:1rem;flex-wrap:wrap">
              <a href="index.html" class="pill-btn" style="margin-top:0">Back to Store</a>
              <a href="orders.html" class="pill-btn" style="margin-top:0">View My Orders</a>
            </div>
          </div>`;
      })
      .catch(err => {
        container.innerHTML = `
          <div class="store-error">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Could not load order</h3>
            <p>${escHtml(err.message)}</p>
            <p style="margin-top:0.75rem">Check your email for a confirmation, or <a href="../contact.html" style="color:var(--amber)">contact us</a>.</p>
          </div>`;
      });
  }

  // ── Page: Order Lookup ───────────────────────────────────────────────────

  function initOrdersPage() {
    const form   = document.getElementById('orderLookupForm');
    const result = document.getElementById('ordersResult');
    if (!form || !result) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type=email]').value.trim();
      if (!email) return;

      result.innerHTML = `<div class="store-loading"><i class="fas fa-circle-notch"></i>Looking up orders…</div>`;

      try {
        const data = await fetch(`/api/store/customer-orders?email=${encodeURIComponent(email)}`).then(r => r.json());
        if (!data.ok) throw new Error(data.error || 'Failed to load orders');

        const orders = data.orders || [];
        if (!orders.length) {
          result.innerHTML = `<p style="text-align:center;color:rgba(252,249,245,0.4)">No orders found for that email address.</p>`;
          return;
        }

        result.innerHTML = `<div class="orders-list">
          ${orders.map(order => `
            <a class="order-list-item" href="confirmation.html?order_id=${order.id}&email=${encodeURIComponent(email)}">
              <div>
                <div class="order-list-id">#${order.id.slice(-12).toUpperCase()}</div>
                <div class="order-list-date">${new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div>${statusBadgeHtml(order.status)}</div>
              <div class="order-list-total">${formatPrice(order.total)}</div>
            </a>
          `).join('')}
        </div>`;
      } catch (err) {
        result.innerHTML = `<div class="store-error"><i class="fas fa-exclamation-circle"></i><h3>Error</h3><p>${escHtml(err.message)}</p></div>`;
      }
    });
  }

  // ── Toast notification ───────────────────────────────────────────────────

  function showStoreToast(msg, isError = false) {
    const existing = document.getElementById('storeToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'storeToast';
    toast.style.cssText = `
      position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(20px);
      background:${isError ? 'rgba(220,50,50,0.95)' : 'rgba(249,83,1,0.95)'};
      color:#fcf9f5;padding:0.85rem 1.5rem;border-radius:2rem;font-size:0.9rem;
      box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:9999;
      opacity:0;transition:all 0.3s;max-width:90vw;text-align:center;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  }

  // ── XSS-safe HTML escape ─────────────────────────────────────────────────

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    initStorefront();
    initCartPage();
    initCheckoutPage();
    initConfirmationPage();
    initOrdersPage();
  });

})();
