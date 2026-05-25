/* =========================================================================
   BKDziti Store Admin — frontend JavaScript
   Handles: login, product CRUD (with type + pricing model), order management.
   ========================================================================= */
(function () {
  'use strict';

  const TOKEN_KEY = 'bkdziti_admin_token';
  let adminToken  = sessionStorage.getItem(TOKEN_KEY) || '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function formatPrice(cents) { return '$' + (cents / 100).toFixed(2); }

  function billingLabel(pricingModel, billingInterval) {
    if (!pricingModel || pricingModel === 'one-time') return '';
    if (pricingModel === 'quote')   return ' (quote)';
    if (pricingModel === 'monthly') return '/mo';
    if (pricingModel === 'yearly')  return '/yr';
    if (pricingModel === 'custom')  return billingInterval ? ' / ' + billingInterval : '/period';
    return '';
  }

  function apiHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
  }

  async function apiFetch(path, opts) {
    opts = opts || {};
    const resp = await fetch(path, { headers: apiHeaders(), ...opts });
    const data = await resp.json().catch(() => ({ ok: false, error: 'Invalid response' }));
    if (resp.status === 401) {
      signOut();
      throw new Error('Session expired. Please sign in again.');
    }
    return data;
  }

  function showToast(msg, isError) {
    isError = isError || false;
    const existing = document.getElementById('adminToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.style.cssText = `
      position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(20px);
      background:${isError ? 'rgba(180,30,30,0.97)' : 'rgba(249,83,1,0.97)'};
      color:#fcf9f5;padding:0.85rem 1.75rem;border-radius:2rem;font-size:0.9rem;
      box-shadow:0 8px 30px rgba(0,0,0,0.5);z-index:9999;
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

  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  function statusBadge(status) {
    const icons = { pending: 'fa-clock', paid: 'fa-check-circle', processing: 'fa-cog', fulfilled: 'fa-box', cancelled: 'fa-times-circle' };
    return `<span class="order-status-badge ${status}"><i class="fas ${icons[status] || 'fa-question-circle'}"></i>${status}</span>`;
  }

  // ── Pricing model toggle ─────────────────────────────────────────────────

  function initPricingModelToggle() {
    const modelSel = document.getElementById('pPricingModel');
    const biWrap   = document.getElementById('pBillingIntervalWrap');
    if (!modelSel || !biWrap) return;
    function update() {
      biWrap.style.display = modelSel.value === 'custom' ? '' : 'none';
    }
    modelSel.addEventListener('change', update);
    update();
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  function signOut() {
    adminToken = '';
    sessionStorage.removeItem(TOKEN_KEY);
    document.getElementById('loginScreen').style.display = '';
    document.getElementById('adminDashboard').style.display = 'none';
  }

  function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = '';
    loadProducts();
    loadOrders();
  }

  function initLogin() {
    const form  = document.getElementById('loginForm');
    const err   = document.getElementById('loginError');
    const input = document.getElementById('adminKey');

    if (adminToken) {
      apiFetch('/api/store/admin/products')
        .then(d => { if (d.ok) showDashboard(); else signOut(); })
        .catch(signOut);
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in…';

      try {
        const data = await fetch('/api/store/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: input.value })
        }).then(r => r.json());

        if (!data.ok) throw new Error(data.error || 'Invalid credentials');
        adminToken = data.token;
        sessionStorage.setItem(TOKEN_KEY, adminToken);
        showDashboard();
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-unlock-alt"></i> Sign In';
        input.select();
      }
    });
  }

  // ── Panel navigation ─────────────────────────────────────────────────────

  function initPanelNav() {
    document.querySelectorAll('.admin-nav-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn[data-panel]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
      });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Sign out of the admin panel?')) signOut();
    });
  }

  // ── Products ─────────────────────────────────────────────────────────────

  let products = [];

  function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:rgba(252,249,245,0.3)">No products yet. Click "Add Product" to create your first one.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const pm    = p.pricingModel || 'one-time';
      const bi    = p.billingInterval || '';
      const label = billingLabel(pm, bi);
      const type  = p.type || 'product';
      return `
      <tr>
        <td>
          ${p.imageUrl
            ? /\.(webm|mp4)$/i.test(p.imageUrl)
              ? `<video class="admin-table-img" src="${escHtml(p.imageUrl)}" muted loop playsinline preload="metadata" autoplay style="object-fit:cover"></video>`
              : `<img class="admin-table-img" src="${escHtml(p.imageUrl)}" alt="" loading="lazy">`
            : `<div class="admin-table-img-ph"><i class="fas fa-image"></i></div>`}
        </td>
        <td style="max-width:220px">
          <div style="font-weight:600;color:var(--cream);line-height:1.3">${escHtml(p.name)}</div>
          ${p.description ? `<div style="font-size:0.78rem;color:rgba(252,249,245,0.4);margin-top:0.2rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escHtml(p.description)}</div>` : ''}
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.18rem 0.55rem;border-radius:1rem;font-size:0.62rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;${type === 'service' ? 'background:rgba(100,149,237,0.15);color:#8bb4f5;border:1px solid rgba(100,149,237,0.25)' : 'background:rgba(255,154,11,0.12);color:var(--amber);border:1px solid rgba(255,154,11,0.2)'}">
            ${type}
          </span>
        </td>
        <td style="font-family:'Dela Gothic One',sans-serif;color:var(--amber)">
          ${pm === 'quote' ? '<span style="font-size:0.85rem;font-family:\'Golos Text\',sans-serif;color:rgba(100,149,237,0.8)">Custom Quote</span>' : formatPrice(p.price) + `<span style="font-size:0.72rem;font-family:'Golos Text',sans-serif;color:rgba(252,249,245,0.4)">${escHtml(label)}</span>`}
        </td>
        <td>
          ${p.active
            ? `<span><span class="active-dot"></span>Active</span>`
            : `<span><span class="inactive-dot"></span>Hidden</span>`}
        </td>
        <td>
          <div class="admin-actions">
            <button class="admin-btn" data-edit="${p.id}" style="padding:0.4rem 0.85rem;font-size:0.8rem">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button class="admin-btn danger" data-delete="${p.id}" style="padding:0.4rem 0.85rem;font-size:0.8rem">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditProduct(btn.dataset.edit));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.delete));
    });
  }

  async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:rgba(252,249,245,0.4)"><i class="fas fa-circle-notch fa-spin"></i> Loading…</td></tr>`;
    try {
      const data = await apiFetch('/api/store/admin/products');
      if (!data.ok) throw new Error(data.error);
      products = data.products || [];
      renderProductsTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#f08080">${escHtml(err.message)}</td></tr>`;
    }
  }

  function resetProductForm() {
    document.getElementById('productId').value      = '';
    document.getElementById('pName').value          = '';
    document.getElementById('pDesc').value          = '';
    document.getElementById('pPrice').value         = '';
    document.getElementById('pType').value          = 'product';
    document.getElementById('pPricingModel').value  = 'one-time';
    document.getElementById('pBillingInterval').value = '';
    document.getElementById('pBillingIntervalWrap').style.display = 'none';
    document.getElementById('pImageUrl').value      = '';
    document.getElementById('pActive').checked      = true;
  }

  function openAddProduct() {
    document.getElementById('productModalTitle').textContent = 'Add Product / Service';
    resetProductForm();
    openModal('productModal');
    document.getElementById('pName').focus();
  }

  function openEditProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'Edit Product / Service';
    document.getElementById('productId').value      = p.id;
    document.getElementById('pName').value          = p.name;
    document.getElementById('pDesc').value          = p.description || '';
    document.getElementById('pPrice').value         = (p.price / 100).toFixed(2);
    document.getElementById('pType').value          = p.type || 'product';
    document.getElementById('pPricingModel').value  = p.pricingModel || 'one-time';
    document.getElementById('pBillingInterval').value = p.billingInterval || '';
    document.getElementById('pBillingIntervalWrap').style.display = (p.pricingModel === 'custom') ? '' : 'none';
    document.getElementById('pImageUrl').value      = p.imageUrl || '';
    document.getElementById('pActive').checked      = p.active;
    openModal('productModal');
  }

  function validateProductForm() {
    const name  = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const pm    = document.getElementById('pPricingModel').value;
    const bi    = document.getElementById('pBillingInterval').value.trim();

    if (!name) { showToast('Product name is required.', true); return false; }
    if (isNaN(price) || price < 0.5) { showToast('Price must be at least $0.50.', true); return false; }
    if (pm === 'custom' && !bi) { showToast('Please enter a billing interval for custom pricing.', true); return false; }
    return true;
  }

  function initProductModal() {
    const form       = document.getElementById('productForm');
    const closeBtn   = document.getElementById('productModalClose');
    const cancelBtn  = document.getElementById('productModalCancel');
    const addBtn     = document.getElementById('addProductBtn');

    addBtn.addEventListener('click', openAddProduct);
    closeBtn.addEventListener('click', () => closeModal('productModal'));
    cancelBtn.addEventListener('click', () => closeModal('productModal'));
    document.getElementById('productModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal('productModal');
    });

    // Pricing model → billing interval toggle
    const modelSel = document.getElementById('pPricingModel');
    const biWrap   = document.getElementById('pBillingIntervalWrap');
    if (modelSel && biWrap) {
      modelSel.addEventListener('change', () => {
        biWrap.style.display = modelSel.value === 'custom' ? '' : 'none';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateProductForm()) return;

      const saveBtn = document.getElementById('productSaveBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';

      const id      = document.getElementById('productId').value;
      const payload = {
        name:            document.getElementById('pName').value.trim(),
        description:     document.getElementById('pDesc').value.trim(),
        price:           parseFloat(document.getElementById('pPrice').value),
        type:            document.getElementById('pType').value,
        pricingModel:    document.getElementById('pPricingModel').value,
        billingInterval: document.getElementById('pBillingInterval').value.trim(),
        imageUrl:        document.getElementById('pImageUrl').value.trim(),
        active:          document.getElementById('pActive').checked
      };

      try {
        const url    = id ? `/api/store/admin/products/${id}` : '/api/store/admin/products';
        const method = id ? 'PUT' : 'POST';
        const data   = await apiFetch(url, { method, body: JSON.stringify(payload) });
        if (!data.ok) throw new Error(data.error || 'Save failed');

        closeModal('productModal');
        showToast(id ? 'Product updated!' : 'Product created!');
        await loadProducts();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Product';
      }
    });
  }

  let pendingDeleteId = null;

  function confirmDeleteProduct(id) {
    pendingDeleteId = id;
    openModal('deleteModal');
  }

  function initDeleteModal() {
    document.getElementById('deleteCancelBtn').addEventListener('click', () => {
      pendingDeleteId = null;
      closeModal('deleteModal');
    });
    document.getElementById('deleteModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) { pendingDeleteId = null; closeModal('deleteModal'); }
    });
    document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      const btn = document.getElementById('deleteConfirmBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Deleting…';
      try {
        const data = await apiFetch(`/api/store/admin/products/${pendingDeleteId}`, { method: 'DELETE' });
        if (!data.ok) throw new Error(data.error || 'Delete failed');
        closeModal('deleteModal');
        showToast('Product deleted.');
        await loadProducts();
      } catch (err) {
        showToast(err.message, true);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      } finally {
        pendingDeleteId = null;
      }
    });
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  let orders = [];

  async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:rgba(252,249,245,0.4)"><i class="fas fa-circle-notch fa-spin"></i> Loading…</td></tr>`;
    try {
      const data = await apiFetch('/api/store/admin/orders');
      if (!data.ok) throw new Error(data.error);
      orders = data.orders || [];
      renderOrdersTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#f08080">${escHtml(err.message)}</td></tr>`;
    }
  }

  function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:rgba(252,249,245,0.3)">No orders yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;color:rgba(252,249,245,0.5)">#${o.id.slice(-10).toUpperCase()}</td>
        <td>
          <div style="font-weight:500">${escHtml(o.customer.name)}</div>
          <div style="font-size:0.78rem;color:rgba(252,249,245,0.4)">${escHtml(o.customer.email)}</div>
        </td>
        <td style="font-size:0.85rem;color:rgba(252,249,245,0.5)">
          ${new Date(o.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
        </td>
        <td style="font-family:'Dela Gothic One',sans-serif;color:var(--amber)">${formatPrice(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-btn" data-view-order="${o.id}" style="padding:0.4rem 0.85rem;font-size:0.8rem">
              <i class="fas fa-eye"></i> View
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => openOrderDetail(btn.dataset.viewOrder));
    });
  }

  async function openOrderDetail(id) {
    const body = document.getElementById('orderModalBody');
    body.innerHTML = `<div class="store-loading" style="padding:2rem"><i class="fas fa-circle-notch"></i>Loading…</div>`;
    openModal('orderModal');

    try {
      const data = await apiFetch(`/api/store/admin/orders/${id}`);
      if (!data.ok) throw new Error(data.error);
      const o = data.order;

      body.innerHTML = `
        <div style="margin-bottom:1.25rem">
          <div style="font-size:0.78rem;color:rgba(252,249,245,0.4);margin-bottom:0.25rem">ORDER ID</div>
          <div style="font-family:monospace;font-size:0.85rem">${escHtml(o.id)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
          <div>
            <div style="font-size:0.78rem;color:rgba(252,249,245,0.4);margin-bottom:0.25rem">CUSTOMER</div>
            <div style="font-weight:500">${escHtml(o.customer.name)}</div>
            <div style="font-size:0.85rem;color:rgba(252,249,245,0.5)">${escHtml(o.customer.email)}</div>
          </div>
          <div>
            <div style="font-size:0.78rem;color:rgba(252,249,245,0.4);margin-bottom:0.25rem">DATE</div>
            <div>${new Date(o.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:1.25rem">
          <thead><tr>
            <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--orange);padding:6px 0;border-bottom:1px solid rgba(249,83,1,0.2);text-align:left">Item</th>
            <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--orange);padding:6px 0;border-bottom:1px solid rgba(249,83,1,0.2);text-align:center">Qty</th>
            <th style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--orange);padding:6px 0;border-bottom:1px solid rgba(249,83,1,0.2);text-align:right">Price</th>
          </tr></thead>
          <tbody>
            ${o.items.map(item => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(249,83,1,0.06);color:rgba(252,249,245,0.8);font-size:0.88rem">${escHtml(item.name)}${item.pricingModel && item.pricingModel !== 'one-time' ? ` <span style="font-size:0.7rem;color:rgba(100,149,237,0.7)">(${item.pricingModel})</span>` : ''}</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(249,83,1,0.06);text-align:center;font-size:0.88rem">×${item.quantity}</td>
                <td style="padding:8px 0;border-bottom:1px solid rgba(249,83,1,0.06);text-align:right;font-family:'Dela Gothic One',sans-serif;color:var(--amber)">${formatPrice(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:10px 0 0;font-family:'Dela Gothic One',sans-serif;color:var(--amber)">Total</td>
            <td style="padding:10px 0 0;text-align:right;font-family:'Dela Gothic One',sans-serif;font-size:1.2rem;color:var(--amber)">${formatPrice(o.total)}</td>
          </tr></tfoot>
        </table>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="font-size:0.85rem;color:rgba(252,249,245,0.5)">Status:</div>
          ${statusBadge(o.status)}
          <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center">
            <select class="status-select" id="statusSelect-${o.id}">
              ${['pending','paid','processing','fulfilled','cancelled'].map(s =>
                `<option value="${s}"${o.status === s ? ' selected' : ''}>${s}</option>`
              ).join('')}
            </select>
            <button class="admin-btn primary" id="updateStatusBtn-${o.id}" style="padding:0.4rem 0.85rem;font-size:0.82rem">
              Update
            </button>
          </div>
        </div>
        ${o.notes ? `<div style="margin-top:1rem;font-size:0.85rem;color:rgba(252,249,245,0.5)"><strong>Notes:</strong> ${escHtml(o.notes)}</div>` : ''}
      `;

      document.getElementById(`updateStatusBtn-${o.id}`).addEventListener('click', async () => {
        const sel  = document.getElementById(`statusSelect-${o.id}`);
        const btn  = document.getElementById(`updateStatusBtn-${o.id}`);
        const newStatus = sel.value;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/store/admin/orders/${o.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error(res.error);
          showToast('Status updated!');
          closeModal('orderModal');
          await loadOrders();
        } catch (err) {
          showToast(err.message, true);
          btn.disabled = false;
        }
      });
    } catch (err) {
      body.innerHTML = `<p style="color:#f08080">${escHtml(err.message)}</p>`;
    }
  }

  function initOrderModal() {
    const closeOrder = () => closeModal('orderModal');
    document.getElementById('orderModalClose').addEventListener('click', closeOrder);
    document.getElementById('orderModalClose2').addEventListener('click', closeOrder);
    document.getElementById('orderModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeOrder();
    });
    document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initPanelNav();
    initProductModal();
    initDeleteModal();
    initOrderModal();
    initPricingModelToggle();
  });

})();
