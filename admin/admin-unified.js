// BKDziti Unified Admin Panel
(function() {
  'use strict';

  const LOGIN_SCREEN = document.getElementById('loginScreen');
  const ADMIN_DASHBOARD = document.getElementById('adminDashboard');
  const LOGIN_FORM = document.getElementById('loginForm');
  const LOGIN_ERROR = document.getElementById('loginError');
  const LOGOUT_BTN = document.getElementById('logoutBtn');
  const ADMIN_KEY_INPUT = document.getElementById('adminKey');

  // Section navigation
  const STORE_SECTION = document.getElementById('storeSection');
  const PROSPECTS_SECTION = document.getElementById('prospectsSection');
  const SIDEBAR_BUTTONS = document.querySelectorAll('.admin-nav-btn[data-section]');

  // Store tabs
  const PRODUCTS_PANEL = document.getElementById('productsPanel');
  const ORDERS_PANEL = document.getElementById('ordersPanel');
  const STORE_TAB_BUTTONS = document.querySelectorAll('#storeSection .admin-tab-btn[data-tab]');

  // Initialize
  function init() {
    checkAuth();
    setupEventListeners();
  }

  function checkAuth() {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    LOGIN_SCREEN.style.display = 'flex';
    ADMIN_DASHBOARD.style.display = 'none';
    ADMIN_KEY_INPUT.focus();
  }

  function showDashboard() {
    LOGIN_SCREEN.style.display = 'none';
    ADMIN_DASHBOARD.style.display = 'block';
    loadStoreAdmin();
    loadProspectsInterface();
  }

  function setupEventListeners() {
    // Login
    LOGIN_FORM.addEventListener('submit', handleLogin);

    // Logout
    LOGOUT_BTN.addEventListener('click', handleLogout);

    // Section navigation
    SIDEBAR_BUTTONS.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = btn.dataset.section;
        switchSection(section);
      });
    });

    // Store tabs
    STORE_TAB_BUTTONS.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        switchStoreTab(tab);
      });
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    LOGIN_ERROR.textContent = '';
    const password = ADMIN_KEY_INPUT.value;

    try {
      const response = await fetch('/api/prospects/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: password })
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || 'Invalid password');
      }

      sessionStorage.setItem('admin_token', data.token);
      showDashboard();
    } catch (err) {
      LOGIN_ERROR.textContent = err.message || 'Authentication failed';
    } finally {
      ADMIN_KEY_INPUT.value = '';
    }
  }

  function handleLogout() {
    if (confirm('Sign out of admin panel?')) {
      sessionStorage.removeItem('admin_token');
      showLogin();
      LOGIN_ERROR.textContent = '';
    }
  }

  function switchSection(section) {
    // Update sidebar active state
    SIDEBAR_BUTTONS.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.section === section) {
        btn.classList.add('active');
      }
    });

    // Show/hide sections
    if (section === 'store') {
      STORE_SECTION.style.display = 'block';
      PROSPECTS_SECTION.style.display = 'none';
    } else if (section === 'prospects') {
      STORE_SECTION.style.display = 'none';
      PROSPECTS_SECTION.style.display = 'block';
    }
  }

  function switchStoreTab(tab) {
    // Update tab button active state
    STORE_TAB_BUTTONS.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
      }
    });

    // Show/hide panels
    if (tab === 'products') {
      PRODUCTS_PANEL.style.display = 'block';
      ORDERS_PANEL.style.display = 'none';
    } else if (tab === 'orders') {
      PRODUCTS_PANEL.style.display = 'none';
      ORDERS_PANEL.style.display = 'block';
    }
  }

  function loadStoreAdmin() {
    // Store admin functionality is loaded via store-admin.js
    // This just initializes it in the admin context
    if (window.initStoreAdmin && typeof window.initStoreAdmin === 'function') {
      window.initStoreAdmin();
    }
  }

  function loadProspectsInterface() {
    const container = document.getElementById('prospectsContent');
    if (!container) return;

    // Load prospects in an iframe
    const iframe = document.createElement('iframe');
    iframe.src = '/admin/prospects.html';
    iframe.title = 'Prospects Tracker';
    iframe.style.cssText = `
      width: 100%;
      height: calc(100vh - 300px);
      min-height: 600px;
      border: none;
      border-radius: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
    `;

    container.innerHTML = '';
    container.appendChild(iframe);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
