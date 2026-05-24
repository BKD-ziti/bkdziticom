/* =========================================================================
   BKDziti Store — frontend JavaScript
   Handles: storefront (product grid + modal), cart, checkout,
            confirmation, order lookup.
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

  function addToCart(product, qty) {
    qty = qty || 1;
    const cart = getCart();
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + qty);
    } else {
      cart.push({
        productId:    product.id,
        name:         product.name,
        price:        product.price,
        imageUrl:     product.imageUrl || '',
        category:     product.category,
        type:         product.type || 'product',
        pricingModel: product.pricingModel || 'one-time',
        billingInterval: product.billingInterval || '',
        quantity:     qty
      });
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

  // ── Billing label helpers ────────────────────────────────────────────────

  function billingPeriodLabel(pricingModel, billingInterval) {
    if (!pricingModel || pricingModel === 'one-time') return '';
    if (pricingModel === 'quote')    return '';
    if (pricingModel === 'monthly')  return '/mo';
    if (pricingModel === 'yearly')   return '/yr';
    if (pricingModel === 'weekly')   return '/wk';
    if (pricingModel === 'biweekly') return '/2 wks';
    if (pricingModel === 'custom')   return billingInterval ? ' / ' + billingInterval : '/period';
    return '';
  }

  function billingFullLabel(pricingModel, billingInterval) {
    if (!pricingModel || pricingModel === 'one-time') return 'One-time purchase';
    if (pricingModel === 'quote')    return 'Custom quote';
    if (pricingModel === 'monthly')  return 'Billed monthly';
    if (pricingModel === 'yearly')   return 'Billed yearly';
    if (pricingModel === 'weekly')   return 'Billed weekly';
    if (pricingModel === 'biweekly') return 'Billed bi-weekly';
    if (pricingModel === 'custom')   return billingInterval ? 'Billed ' + billingInterval : 'Recurring billing';
    return '';
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

    // ── Product detail modal ──
    const detailModal    = document.getElementById('productDetailModal');
    const pdModalClose   = document.getElementById('pdModalClose');
    const pdModalMedia   = document.getElementById('pdModalMedia');
    const pdModalPH      = document.getElementById('pdModalImgPlaceholder');
    const pdModalCat     = document.getElementById('pdModalCategory');
    const pdModalBadge   = document.getElementById('pdModalTypeBadge');
    const pdModalName    = document.getElementById('pdModalName');
    const pdModalPrice   = document.getElementById('pdModalPrice');
    const pdModalBilling = document.getElementById('pdModalBilling');
    const pdModalDesc    = document.getElementById('pdModalDesc');
    const pdModalAddBtn  = document.getElementById('pdModalAddBtn');
    const pdModalCart    = document.getElementById('pdModalCartLink');

    let currentProduct = null;

    function openProductModal(product) {
      currentProduct = product;

      // Media
      // Remove any previous dynamic media element
      const prevMedia = pdModalMedia.querySelector('img, video');
      if (prevMedia) prevMedia.remove();
      if (pdModalPH)  pdModalPH.style.display = product.imageUrl ? 'none' : 'flex';

      if (product.imageUrl) {
        const isVideo = /\.(webm|mp4)$/i.test(product.imageUrl);
        if (isVideo) {
          const v = document.createElement('video');
          v.muted = true; v.loop = true;
          v.setAttribute('playsinline', '');
          v.setAttribute('preload', 'metadata');
          v.src = product.imageUrl;
          v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
          pdModalMedia.insertBefore(v, pdModalPH);
          v.play().catch(() => {});
        } else {
          const img = document.createElement('img');
          img.src = product.imageUrl;
          img.alt = escHtml(product.name);
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
          pdModalMedia.insertBefore(img, pdModalPH);
        }
      }

      // Type badge
      const type = product.type || 'product';
      if (pdModalBadge) {
        pdModalBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        pdModalBadge.className = 'product-type-badge ' + type;
      }
      if (pdModalCat) pdModalCat.textContent = product.category || '';
      if (pdModalName) pdModalName.textContent = product.name;

      // Price
      const pm = product.pricingModel || 'one-time';
      const bi = product.billingInterval || '';
      const isQuote = pm === 'quote';

      if (pdModalPrice) pdModalPrice.textContent = isQuote ? 'Custom Quote' : formatPrice(product.price);
      if (pdModalBilling) pdModalBilling.textContent = isQuote ? 'Tell us what you need — we\'ll send a quote' : billingFullLabel(pm, bi);

      // Description
      if (pdModalDesc) pdModalDesc.textContent = product.description || 'No description provided.';

      // Features list
      const featuresEl = document.getElementById('pdModalFeatures');
      if (featuresEl) {
        const feats = product.features;
        if (Array.isArray(feats) && feats.length) {
          featuresEl.innerHTML = feats.map(f => `<li>${escHtml(f)}</li>`).join('');
          featuresEl.style.display = '';
        } else {
          featuresEl.innerHTML = '';
          featuresEl.style.display = 'none';
        }
      }

      // Quote form in modal actions area
      const actionsEl = document.querySelector('.pd-modal-actions');
      const existingQuoteForm = actionsEl && actionsEl.querySelector('.quote-form-inline');
      if (existingQuoteForm) existingQuoteForm.remove();

      if (isQuote) {
        if (pdModalAddBtn) pdModalAddBtn.style.display = 'none';
        if (pdModalCart) pdModalCart.style.display = 'none';
        if (actionsEl) {
          actionsEl.insertAdjacentHTML('beforeend', `
            <div class="quote-form-inline">
              <form class="quote-form">
                <input type="text" name="name" placeholder="Your name" required maxlength="80">
                <input type="email" name="email" placeholder="Your email" required maxlength="120">
                <input type="tel" name="phone" placeholder="Phone (optional)" maxlength="40">
                <select name="service">
                  <option value="">Interested in… (optional)</option>
                  <option value="Pop-Up Coordination">Pop-Up Coordination</option>
                  <option value="Culinary Consulting">Culinary Consulting</option>
                  <option value="Videography">Videography & Content</option>
                  <option value="Photography">Photography</option>
                  <option value="Full Package">Full Package (multiple services)</option>
                  <option value="Other">Other</option>
                </select>
                <textarea name="details" placeholder="Tell us about your project — what do you need?" required maxlength="3000" rows="4"></textarea>
                <button type="submit" class="add-to-cart-btn quote-submit-btn"><i class="fas fa-paper-plane"></i> Request Quote</button>
                <div class="quote-form-msg"></div>
              </form>
            </div>`);
          const qForm = actionsEl.querySelector('.quote-form');
          qForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = qForm.querySelector('.quote-submit-btn');
            const msg = qForm.querySelector('.quote-form-msg');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending…';
            msg.textContent = '';
            msg.className = 'quote-form-msg';
            try {
              const resp = await fetch('/api/store/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: qForm.name.value.trim(),
                  email: qForm.email.value.trim(),
                  phone: qForm.phone.value.trim(),
                  service: qForm.service.value,
                  details: qForm.details.value.trim()
                })
              });
              const data = await resp.json();
              if (data.ok) {
                msg.textContent = 'Quote request sent! We\'ll get back to you soon.';
                msg.classList.add('success');
                btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
                qForm.reset();
              } else {
                throw new Error(data.error || 'Failed to send');
              }
            } catch (err) {
              msg.textContent = err.message || 'Something went wrong. Try again.';
              msg.classList.add('error');
              btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-paper-plane"></i> Request Quote';
            }
          });
        }
      } else {
        // Reset add button — show Subscribe for recurring, Add to Cart for one-time
        if (pdModalAddBtn) {
          const isSub = pm !== 'one-time' && pm !== 'quote';
          pdModalAddBtn.style.display = '';
          pdModalAddBtn.classList.remove('added');
          pdModalAddBtn.innerHTML = isSub
            ? '<i class="fas fa-sync-alt"></i> Subscribe'
            : '<i class="fas fa-cart-plus"></i> Add to Cart';
          pdModalAddBtn.disabled = false;
        }
        if (pdModalCart) pdModalCart.style.display = 'none';
      }

      // Reviews section
      const reviewsContainer = document.getElementById('pdModalReviews');
      if (reviewsContainer) {
        reviewsContainer.innerHTML = '<div class="reviews-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading reviews…</div>';
        loadProductReviews(product.id, reviewsContainer);
      }

      // Open modal
      if (detailModal) detailModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeProductModal() {
      if (detailModal) detailModal.classList.remove('open');
      document.body.style.overflow = '';
      // Pause video if any
      const vid = pdModalMedia && pdModalMedia.querySelector('video');
      if (vid) vid.pause();
    }

    if (pdModalClose) pdModalClose.addEventListener('click', closeProductModal);
    if (detailModal) {
      detailModal.addEventListener('click', e => {
        if (e.target === detailModal) closeProductModal();
      });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && detailModal && detailModal.classList.contains('open')) closeProductModal();
    });

    // Add to cart from modal
    if (pdModalAddBtn) {
      pdModalAddBtn.addEventListener('click', () => {
        if (!currentProduct) return;
        addToCart(currentProduct, 1);
        const isSub = currentProduct.pricingModel && currentProduct.pricingModel !== 'one-time' && currentProduct.pricingModel !== 'quote';
        pdModalAddBtn.classList.add('added');
        pdModalAddBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        pdModalAddBtn.disabled = true;
        if (pdModalCart) pdModalCart.style.display = '';
        setTimeout(() => {
          pdModalAddBtn.classList.remove('added');
          pdModalAddBtn.innerHTML = isSub
            ? '<i class="fas fa-sync-alt"></i> Subscribe'
            : '<i class="fas fa-cart-plus"></i> Add to Cart';
          pdModalAddBtn.disabled = false;
        }, 2000);
      });
    }

    // ── Reviews ──
    function starHtml(rating, max) {
      max = max || 5;
      let html = '';
      for (let i = 1; i <= max; i++) {
        html += '<i class="fas fa-star' + (i <= rating ? ' filled' : '') + '"></i>';
      }
      return html;
    }

    function renderReviewForm(productId, container) {
      const formHtml = `
        <div class="review-form-wrap">
          <h4>Leave a Review</h4>
          <form class="review-form" data-product-id="${productId}">
            <div class="review-form-row">
              <input type="text" name="name" placeholder="Your name" required maxlength="80">
              <input type="email" name="email" placeholder="Email used at checkout" required maxlength="120">
            </div>
            <div class="review-stars-input" data-rating="0">
              <span>Rating:</span>
              ${[1,2,3,4,5].map(n => '<button type="button" class="star-pick" data-val="' + n + '"><i class="fas fa-star"></i></button>').join('')}
            </div>
            <textarea name="comment" placeholder="Share your experience… (optional)" maxlength="1000" rows="3"></textarea>
            <button type="submit" class="pill-btn review-submit-btn" style="margin-top:0">Submit Review <i class="fas fa-arrow-right"></i></button>
            <div class="review-form-msg"></div>
          </form>
        </div>`;
      container.insertAdjacentHTML('beforeend', formHtml);

      const form = container.querySelector('.review-form');
      const starsInput = form.querySelector('.review-stars-input');
      let selectedRating = 0;

      starsInput.querySelectorAll('.star-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedRating = parseInt(btn.dataset.val, 10);
          starsInput.dataset.rating = selectedRating;
          starsInput.querySelectorAll('.star-pick').forEach((b, idx) => {
            b.classList.toggle('active', idx < selectedRating);
          });
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = form.querySelector('.review-form-msg');
        const submitBtn = form.querySelector('.review-submit-btn');
        if (!selectedRating) { msgEl.textContent = 'Please select a rating.'; msgEl.className = 'review-form-msg error'; return; }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…';
        msgEl.textContent = '';

        try {
          const resp = await fetch('/api/store/products/' + productId + '/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.querySelector('[name=name]').value.trim(),
              email: form.querySelector('[name=email]').value.trim(),
              rating: selectedRating,
              comment: form.querySelector('[name=comment]').value.trim()
            })
          });
          const data = await resp.json();
          if (!data.ok) throw new Error(data.error || 'Failed to submit');
          msgEl.textContent = 'Review submitted!';
          msgEl.className = 'review-form-msg success';
          form.reset();
          selectedRating = 0;
          starsInput.dataset.rating = 0;
          starsInput.querySelectorAll('.star-pick').forEach(b => b.classList.remove('active'));
          loadProductReviews(productId, container);
        } catch (err) {
          msgEl.textContent = err.message;
          msgEl.className = 'review-form-msg error';
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Submit Review <i class="fas fa-arrow-right"></i>';
        }
      });
    }

    function loadProductReviews(productId, container) {
      fetch('/api/store/products/' + productId + '/reviews')
        .then(r => r.json())
        .then(data => {
          if (!data.ok) throw new Error(data.error);
          const reviews = data.reviews || [];
          const avg = data.average || 0;
          const count = data.count || 0;

          let html = '<div class="reviews-section">';
          html += '<div class="reviews-header">';
          html += '<h3>Reviews</h3>';
          if (count > 0) {
            html += '<div class="reviews-summary">';
            html += '<span class="reviews-avg">' + avg.toFixed(1) + '</span>';
            html += '<span class="reviews-stars">' + starHtml(Math.round(avg)) + '</span>';
            html += '<span class="reviews-count">(' + count + ' review' + (count !== 1 ? 's' : '') + ')</span>';
            html += '</div>';
          }
          html += '</div>';

          if (reviews.length) {
            html += '<div class="reviews-list">';
            reviews.forEach(r => {
              const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              html += '<div class="review-item">';
              html += '<div class="review-item-header">';
              html += '<span class="review-author">' + escHtml(r.name) + '</span>';
              html += '<span class="review-date">' + date + '</span>';
              html += '</div>';
              html += '<div class="review-item-stars">' + starHtml(r.rating) + '</div>';
              if (r.comment) html += '<p class="review-comment">' + escHtml(r.comment) + '</p>';
              html += '</div>';
            });
            html += '</div>';
          } else {
            html += '<p class="reviews-empty">No reviews yet. Be the first!</p>';
          }
          html += '</div>';

          container.innerHTML = html;
          renderReviewForm(productId, container);
        })
        .catch(() => {
          container.innerHTML = '<div class="reviews-section"><h3>Reviews</h3><p class="reviews-empty">Could not load reviews.</p></div>';
          renderReviewForm(productId, container);
        });
    }

    // ── Grid rendering ──
    function renderGrid() {
      let filtered = allProducts;
      if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.type || '').toLowerCase().includes(q)
        );
      }

      if (!filtered.length) {
        grid.innerHTML = `<div class="product-grid-empty"><i class="fas fa-search" style="font-size:2rem;color:rgba(249,83,1,0.2);display:block;margin-bottom:1rem"></i>${searchQuery || activeCategory !== 'all' ? 'No items match your search.' : 'No products yet — check back soon!'}</div>`;
        return;
      }

      grid.innerHTML = filtered.map(p => {
        const pm    = p.pricingModel || 'one-time';
        const bi    = p.billingInterval || '';
        const label = billingPeriodLabel(pm, bi);
        const type  = p.type || 'product';
        const isQuote = pm === 'quote';
        const isSub = !isQuote && pm !== 'one-time';
        const priceHtml = isQuote
          ? `<div class="product-card-price quote-price">Custom Quote</div>`
          : `<div class="product-card-price">${formatPrice(p.price)}<span class="product-card-billing">${escHtml(label)}</span></div>`;
        const subBadge = isSub
          ? `<span class="product-card-sub-badge"><i class="fas fa-sync-alt" style="font-size:0.55rem"></i> Subscription</span>`
          : '';
        return `
        <div class="product-card${isQuote ? ' quote-card' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="View ${escHtml(p.name)}">
          ${p.imageUrl
            ? /\.(webm|mp4)$/i.test(p.imageUrl)
              ? `<video class="product-card-img" src="${escHtml(p.imageUrl)}" muted loop playsinline preload="metadata" autoplay></video>`
              : `<img class="product-card-img" src="${escHtml(p.imageUrl)}" alt="${escHtml(p.name)}" loading="lazy">`
            : `<div class="product-card-img-placeholder"><i class="fas fa-image"></i></div>`}
          <div class="product-card-body">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
              <div class="product-card-category">${escHtml(p.category)}</div>
              <span class="product-type-badge ${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
              ${subBadge}
            </div>
            <div class="product-card-name">${escHtml(p.name)}</div>
            <div class="product-card-desc">${escHtml(p.description || '')}</div>
            <div class="product-card-rating" data-product-id="${p.id}"></div>
            <div class="product-card-footer">
              ${priceHtml}
              <span style="font-size:0.78rem;color:rgba(252,249,245,0.35)">${isQuote ? 'Request a quote' : 'Click to view'}</span>
            </div>
          </div>
        </div>`;
      }).join('');

      // Load card ratings
      grid.querySelectorAll('.product-card-rating').forEach(el => {
        const pid = el.dataset.productId;
        fetch('/api/store/products/' + pid + '/reviews')
          .then(r => r.json())
          .then(data => {
            if (data.ok && data.count > 0) {
              el.innerHTML = '<span class="card-stars">' + starHtml(Math.round(data.average)) +
                '</span><span class="card-rating-count">(' + data.count + ')</span>';
            }
          })
          .catch(() => {});
      });

      // Click handlers for cards
      grid.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const product = allProducts.find(p => p.id === id);
        if (!product) return;
        card.addEventListener('click', () => openProductModal(product));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProductModal(product); }
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

    // Also update search placeholder to mention services
    if (searchEl) searchEl.placeholder = 'Search products & services…';

    grid.innerHTML = `<div class="store-loading"><i class="fas fa-circle-notch"></i>Loading…</div>`;
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

      // Warn about mixed carts
      const hasSub = cart.some(i => i.pricingModel && i.pricingModel !== 'one-time');
      const hasOne = cart.some(i => !i.pricingModel || i.pricingModel === 'one-time');
      const mixedWarning = (hasSub && hasOne)
        ? `<div style="background:rgba(255,154,11,0.12);border:1px solid rgba(255,154,11,0.3);border-radius:var(--radius-md);padding:0.9rem 1.25rem;margin-bottom:1.5rem;font-size:0.88rem;color:rgba(255,154,11,0.9)"><i class="fas fa-info-circle"></i> Your cart contains both one-time and subscription items. Please checkout subscriptions and one-time purchases separately.</div>`
        : '';

      const total = cartTotal(cart);
      container.innerHTML = mixedWarning + `
        <div style="overflow-x:auto">
          <table class="cart-table">
            <thead><tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${cart.map(item => {
                const pm = item.pricingModel || 'one-time';
                const bi = item.billingInterval || '';
                const periodLabel = billingPeriodLabel(pm, bi);
                const subLabel = pm !== 'one-time' ? `<div class="cart-item-sub"><i class="fas fa-sync-alt" style="font-size:0.6rem"></i> ${billingFullLabel(pm, bi)}</div>` : '';
                return `
                <tr class="cart-row" data-id="${item.productId}">
                  <td>
                    <div class="cart-item-info">
                      ${item.imageUrl
                        ? `<img class="cart-item-img" src="${escHtml(item.imageUrl)}" alt="">`
                        : `<div class="cart-item-img-placeholder"><i class="fas fa-image"></i></div>`}
                      <div>
                        <div class="cart-item-name">${escHtml(item.name)}</div>
                        <div class="cart-item-category">${escHtml(item.category || '')}${item.type === 'service' ? ' · service' : ''}</div>
                        ${subLabel}
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
                  <td><span class="cart-price">${formatPrice(item.price * item.quantity)}${periodLabel ? `<span class="product-card-billing">${escHtml(periodLabel)}</span>` : ''}</span></td>
                  <td><button class="remove-btn" data-id="${item.productId}" aria-label="Remove"><i class="fas fa-times"></i></button></td>
                </tr>`;
              }).join('')}
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

    // Check for mixed cart
    const hasSub = cart.some(i => i.pricingModel && i.pricingModel !== 'one-time');
    const hasOne = cart.some(i => !i.pricingModel || i.pricingModel === 'one-time');

    if (hasSub && hasOne) {
      // Show warning but still allow checkout — server will catch it
      const warn = document.createElement('div');
      warn.style.cssText = 'background:rgba(255,154,11,0.12);border:1px solid rgba(255,154,11,0.3);border-radius:var(--radius-md);padding:0.9rem 1.25rem;margin-bottom:1.25rem;font-size:0.85rem;color:rgba(255,154,11,0.9)';
      warn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Mixed cart: subscriptions and one-time purchases must be bought separately. Please go back and split your cart.';
      form.parentElement.insertBefore(warn, form);
    }

    const total = cartTotal(cart);
    summary.innerHTML = cart.map(item => {
      const pm = item.pricingModel || 'one-time';
      const bi = item.billingInterval || '';
      const periodLabel = billingPeriodLabel(pm, bi);
      return `
      <div class="checkout-order-item">
        <div>
          <div class="checkout-order-item-name">${escHtml(item.name)}${item.type === 'service' ? ' <span style="font-size:0.7rem;opacity:0.5">(service)</span>' : ''}</div>
          <div class="checkout-order-item-qty">×${item.quantity}${pm !== 'one-time' ? ` · <span style="color:rgba(100,149,237,0.8)">${billingFullLabel(pm, bi)}</span>` : ''}</div>
        </div>
        <div style="font-family:'Dela Gothic One',sans-serif;color:var(--amber)">${formatPrice(item.price * item.quantity)}${periodLabel ? `<span style="font-size:0.75rem;font-family:'Golos Text',sans-serif;color:rgba(252,249,245,0.4)">${escHtml(periodLabel)}</span>` : ''}</div>
      </div>`;
    }).join('') + `<div class="checkout-order-total"><span>Total</span><span>${formatPrice(total)}</span></div>`;

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

  function showStoreToast(msg, isError) {
    isError = isError || false;
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
