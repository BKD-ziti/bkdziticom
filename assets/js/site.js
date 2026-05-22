/* =========================================================================
   BKDziti — shared site behavior
   Reads window.PAGE_CONFIG and builds the page. Each HTML file declares
   its sections, side-panel nav extras, and per-section pulse palettes
   inline, then loads this script.
   ========================================================================= */
(function () {
    'use strict';

    const SOCIALS  = (window.BKD && window.BKD.SOCIALS) || [];
    const CONFIG   = window.PAGE_CONFIG || {};
    const SECTIONS = CONFIG.sections || [];

    /* ── helpers ───────────────────────────────────────────────────────── */
    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const rand = (min, max) => min + Math.random() * (max - min);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const prefersReducedMotion = () =>
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const runWhenIdle = (fn, timeout = 1500) => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => fn(), { timeout });
        } else {
            setTimeout(fn, 0);
        }
    };
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const isProbablyMobile = () =>
        (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches)
        || (navigator && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);

    /* ── BACKGROUND PULSE (fullscreen) ─────────────────────────────────── */
    function initBackgroundPulse() {
        const canvas = $('#bgPulse');
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        const state = {
            raf: 0,
            running: false,
            lastFrameTs: 0,
            frameIntervalMs: isProbablyMobile() ? 1000 / 24 : 1000 / 32
        };

        const PALETTE = [
            { rgb: [233, 50,  0],   weight: 'dark'  },
            { rgb: [231, 54,  2],   weight: 'dark'  },
            { rgb: [249, 83,  1],   weight: 'mid'   },
            { rgb: [249, 83,  5],   weight: 'mid'   },
            { rgb: [255, 154, 11],  weight: 'mid'   },
            { rgb: [188, 149, 117], weight: 'light' },
            { rgb: [249, 234, 202], weight: 'light' },
            { rgb: [254, 241, 194], weight: 'light' },
            { rgb: [255, 242, 194], weight: 'light' },
            { rgb: [252, 249, 245], weight: 'light' }
        ];

        const slots = ['dark','mid','light','dark','light','mid','light','mid','light','dark'];
        const orbs = slots.map(weight => {
            const entry = pick(PALETTE.filter(p => p.weight === weight));
            const isLight = weight === 'light';
            const isDark  = weight === 'dark';
            return {
                rgb:         entry.rgb,
                vx:          rand(-0.00012, 0.00012) * (isDark ? 0.6 : 1.2),
                vy:          rand(-0.00012, 0.00012) * (isDark ? 0.6 : 1.2),
                wanderAmpX:  rand(0.03, 0.12),
                wanderAmpY:  rand(0.03, 0.12),
                wanderFreqX: rand(0.0002, 0.0006),
                wanderFreqY: rand(0.0002, 0.0006),
                wanderOffX:  rand(0, Math.PI * 2),
                wanderOffY:  rand(0, Math.PI * 2),
                size:        isLight ? rand(0.55, 0.75) : rand(0.18, 0.40),
                alpha:       isLight ? rand(0.04, 0.09) : isDark ? rand(0.10, 0.20) : rand(0.07, 0.14),
                pulseAmp:    isLight ? rand(0.02, 0.05) : rand(0.04, 0.10),
                pulseSpeed:  rand(0.0002, 0.0010),
                pulseOff:    rand(0, Math.PI * 2),
                squash:      rand(0.45, 0.95),
                angle:       rand(0, Math.PI),
                baseX:       rand(0, 1),
                baseY:       rand(0, 1)
            };
        });

        function applyCanvasResolution() {
            const cssW = Math.max(1, window.innerWidth);
            const cssH = Math.max(1, window.innerHeight);
            const dpr  = clamp(window.devicePixelRatio || 1, 1, 2);

            const targetPixels = (isProbablyMobile() ? 1.1 : 1.8) * 1_000_000;
            const fullPixels   = cssW * cssH * dpr * dpr;
            const quality      = clamp(Math.sqrt(targetPixels / Math.max(1, fullPixels)), 0.45, 1);

            const w = Math.floor(cssW * dpr * quality);
            const h = Math.floor(cssH * dpr * quality);

            canvas.style.width  = cssW + 'px';
            canvas.style.height = cssH + 'px';
            canvas.width  = Math.max(1, w);
            canvas.height = Math.max(1, h);
            ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);
        }

        const resize = () => applyCanvasResolution();
        resize();
        window.addEventListener('resize', resize, { passive: true });

        let t = 0;
        function draw(now) {
            if (!state.running) return;
            if (document.hidden) {
                state.raf = requestAnimationFrame(draw);
                return;
            }
            if (state.lastFrameTs && (now - state.lastFrameTs) < state.frameIntervalMs) {
                state.raf = requestAnimationFrame(draw);
                return;
            }
            state.lastFrameTs = now;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const diag = Math.hypot(canvas.width, canvas.height);

            orbs.forEach(orb => {
                orb.baseX += orb.vx;
                orb.baseY += orb.vy;
                if (orb.baseX < -0.2) orb.baseX = 1.2;
                if (orb.baseX >  1.2) orb.baseX = -0.2;
                if (orb.baseY < -0.2) orb.baseY = 1.2;
                if (orb.baseY >  1.2) orb.baseY = -0.2;

                const cx = (orb.baseX + Math.sin(t * orb.wanderFreqX + orb.wanderOffX) * orb.wanderAmpX) * canvas.width;
                const cy = (orb.baseY + Math.sin(t * orb.wanderFreqY + orb.wanderOffY) * orb.wanderAmpY) * canvas.height;
                const alpha = Math.max(0, orb.alpha + Math.sin(t * orb.pulseSpeed + orb.pulseOff) * orb.pulseAmp);
                const r = orb.size * diag;
                const [R, G, B] = orb.rgb;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(orb.angle);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                grad.addColorStop(0,    `rgba(${R},${G},${B},${alpha})`);
                grad.addColorStop(0.45, `rgba(${R},${G},${B},${alpha * 0.35})`);
                grad.addColorStop(1,    `rgba(${R},${G},${B},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(0, 0, r, r * orb.squash, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            t++;
            state.raf = requestAnimationFrame(draw);
        }

        function start() {
            if (state.running) return;
            state.running = true;
            state.lastFrameTs = 0;
            state.raf = requestAnimationFrame(draw);
        }

        function stop() {
            state.running = false;
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = 0;
        }

        const onVis = () => {
            if (document.hidden) return;
            if (state.running) resize();
        };
        document.addEventListener('visibilitychange', onVis);

        start();
        return { start, stop, resize };
    }

    /* ── PER-SECTION PULSE CANVAS ──────────────────────────────────────── */
    function createSectionPulseController(section) {
        const canvas = document.getElementById('pulse-' + section.id);
        if (!canvas || !section.palette) return;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        const state = {
            raf: 0,
            running: false,
            t: 0,
            lastFrameTs: 0,
            frameIntervalMs: isProbablyMobile() ? 1000 / 24 : 1000 / 30
        };

        function resize() {
            const cssW = Math.max(1, canvas.offsetWidth);
            const cssH = Math.max(1, canvas.offsetHeight);
            const dpr  = clamp(window.devicePixelRatio || 1, 1, 2);
            const quality = isProbablyMobile() ? 0.75 : 1;

            canvas.width  = Math.max(1, Math.floor(cssW * dpr * quality));
            canvas.height = Math.max(1, Math.floor(cssH * dpr * quality));
            ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const orbs = [];
        section.palette.forEach(([R, G, B, maxA]) => {
            const count = Math.random() > 0.4 ? 2 : 1;
            for (let i = 0; i < count; i++) {
                orbs.push({
                    R, G, B, maxA,
                    baseX:      rand(0.05, 0.95),
                    baseY:      rand(0.05, 0.95),
                    vx:         rand(-0.00006, 0.00006),
                    vy:         rand(-0.00006, 0.00006),
                    wanderAmpX: rand(0.05, 0.20),
                    wanderAmpY: rand(0.05, 0.20),
                    wanderFX:   rand(0.0003, 0.0008),
                    wanderFY:   rand(0.0003, 0.0008),
                    wanderOX:   rand(0, Math.PI * 2),
                    wanderOY:   rand(0, Math.PI * 2),
                    size:       rand(0.30, 0.70),
                    pulseAmp:   rand(0.03, 0.08),
                    pulseSpeed: rand(0.0004, 0.0014),
                    pulseOff:   rand(0, Math.PI * 2),
                    squash:     rand(0.5, 0.95),
                    angle:      rand(0, Math.PI)
                });
            }
        });

        function draw(now) {
            if (!state.running) return;
            if (document.hidden) {
                state.raf = requestAnimationFrame(draw);
                return;
            }
            if (state.lastFrameTs && (now - state.lastFrameTs) < state.frameIntervalMs) {
                state.raf = requestAnimationFrame(draw);
                return;
            }
            state.lastFrameTs = now;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const diag = Math.hypot(canvas.width, canvas.height);

            orbs.forEach(orb => {
                orb.baseX += orb.vx;
                orb.baseY += orb.vy;
                if (orb.baseX < -0.15) orb.baseX = 1.15;
                if (orb.baseX >  1.15) orb.baseX = -0.15;
                if (orb.baseY < -0.15) orb.baseY = 1.15;
                if (orb.baseY >  1.15) orb.baseY = -0.15;

                const cx = (orb.baseX + Math.sin(t * orb.wanderFX + orb.wanderOX) * orb.wanderAmpX) * canvas.width;
                const cy = (orb.baseY + Math.sin(t * orb.wanderFY + orb.wanderOY) * orb.wanderAmpY) * canvas.height;
                const alpha = Math.max(0, orb.maxA + Math.sin(t * orb.pulseSpeed + orb.pulseOff) * orb.pulseAmp);
                const r = orb.size * diag;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(orb.angle);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                grad.addColorStop(0,    `rgba(${orb.R},${orb.G},${orb.B},${alpha})`);
                grad.addColorStop(0.5,  `rgba(${orb.R},${orb.G},${orb.B},${alpha * 0.3})`);
                grad.addColorStop(1,    `rgba(${orb.R},${orb.G},${orb.B},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(0, 0, r, r * orb.squash, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            state.t++;
            state.raf = requestAnimationFrame(draw);
        }

        function start() {
            if (state.running) return;
            state.running = true;
            state.lastFrameTs = 0;
            state.raf = requestAnimationFrame(draw);
        }

        function stop() {
            state.running = false;
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = 0;
        }

        function destroy() {
            stop();
            ro.disconnect();
        }

        return { start, stop, destroy };
    }

    /* ── SOCIALS RENDER ────────────────────────────────────────────────── */
    function renderSocials(containerId, modifier) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = SOCIALS.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener"
               class="social-btn social-btn--${modifier}"
               aria-label="${s.platform}">
                <i class="${s.icon}"></i>
            </a>
        `).join('');
    }

    /* ── CONTENT SECTIONS RENDER ───────────────────────────────────────── */
    function buildMediaElement(section) {
        const src  = section.media;
        const type = section.mediaType || (src ? guessType(src) : 'placeholder');

        if (type === 'form') {
            const action = (section.form && section.form.action) || '/api/contact';
            return `
                <form class="contact-form" data-bkd-contact-form="1" method="POST" action="${action}">
                    <div class="form-row">
                        <div class="form-field">
                            <label for="cf-name">Name</label>
                            <input id="cf-name" name="name" type="text" autocomplete="name" required>
                        </div>
                        <div class="form-field">
                            <label for="cf-email">Email</label>
                            <input id="cf-email" name="email" type="email" autocomplete="email" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-field">
                            <label for="cf-phone">Phone (optional)</label>
                            <input id="cf-phone" name="phone" type="tel" autocomplete="tel">
                        </div>
                        <div class="form-field">
                            <label for="cf-topic">Topic (optional)</label>
                            <input id="cf-topic" name="topic" type="text" autocomplete="off">
                        </div>
                    </div>

                    <div class="form-field">
                        <label for="cf-message">Message</label>
                        <textarea id="cf-message" name="message" rows="6" required></textarea>
                    </div>

                    <input class="hp-field" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
                    <button type="submit" class="pill-btn">Send <i class="fas fa-arrow-right"></i></button>
                    <div class="form-fineprint">
                        Prefer fast? <a href="sms:+12394205010">Text</a> or <a href="mailto:AlexZornes@BKDziti.com">email</a>.
                    </div>
                </form>
            `;
        }
        if (!src || type === 'placeholder') {
            return `<div class="media-placeholder">
                        <i class="fas fa-film"></i>
                        <span>${section.id}</span>
                    </div>`;
        }
        if (type === 'video' || type === 'webm') {
            const lower = src.toLowerCase();
            const base = lower.endsWith('.webm') ? src.slice(0, -5) : lower.endsWith('.mp4') ? src.slice(0, -4) : src;
            const webm = base + '.webm';
            const mp4  = base + '.mp4';
            return `<video muted loop playsinline preload="metadata" data-bkd-video="1" data-autoplay="1"
                        data-src-webm="${webm}" data-src-mp4="${mp4}"></video>`;
        }
        if (type === 'pdf') {
            return `<iframe data-bkd-iframe="1" data-src="${src}#view=FitH" title="${section.title}" loading="lazy"></iframe>`;
        }
        return `<img src="${src}" alt="${section.title}" loading="lazy">`;
    }

    function guessType(src) {
        const lower = src.toLowerCase();
        if (lower.endsWith('.webm') || lower.endsWith('.mp4')) return 'video';
        if (lower.endsWith('.pdf')) return 'pdf';
        return 'image';
    }

    function renderContentSections() {
        const container = $('#contentSections');
        if (!container) return;

        container.innerHTML = SECTIONS.map(sec => {
            const isReverse = sec.align === 'right';
            const type = sec.mediaType || (sec.media ? guessType(sec.media) : 'placeholder');
            const wrapMods = [
                type === 'pdf' ? 'pdf no-overlay' : '',
                sec.contain ? 'contain' : ''
            ].filter(Boolean).join(' ');

            return `
            <section id="${sec.id}" class="content-section">
                <canvas class="section-pulse-canvas" id="pulse-${sec.id}"></canvas>
                <div class="section-container">
                    <div class="content-split${isReverse ? ' reverse' : ''} reveal">
                        <div>
                            <div class="section-label">${sec.label}</div>
                            <h2 class="section-title">${sec.title}</h2>
                            <hr class="section-divider">
                            <p class="section-body">${sec.body}</p>
                            ${sec.button ? `
                                <a href="${sec.button.url || '#'}" class="pill-btn" id="btn-${sec.id}"${sec.button.download ? ' download' : ''}${sec.button.target ? ` target="${sec.button.target}" rel="noopener"` : ''}>
                                    ${sec.button.text} <i class="fas fa-arrow-right"></i>
                                </a>` : ''}
                        </div>
                        <div style="position:relative;">
                            <div class="content-glow"></div>
                            <div class="content-media-wrap ${wrapMods}">
                                ${buildMediaElement(sec)}
                            </div>
                        </div>
                    </div>
                </div>
            </section>`;
        }).join('');
    }

    /* ── SECTION BUTTON ACTIONS ────────────────────────────────────────── */
    function wireSectionButtons() {
        const handlers = CONFIG.buttonActions || {};
        SECTIONS.forEach(sec => {
            if (!sec.button) return;
            const btn = document.getElementById('btn-' + sec.id);
            if (!btn) return;

            const action = handlers[sec.id];
            if (typeof action === 'function') {
                btn.addEventListener('click', e => action(e, { showNotification }));
            }
        });
    }

    /* ── NOTIFICATION ──────────────────────────────────────────────────── */
    function showNotification(message, ms = 4250) {
        const banner  = $('#notificationBanner');
        const overlay = $('#notificationOverlay');
        if (!banner || !overlay) return;
        banner.textContent = message;
        overlay.classList.add('active');
        banner.classList.remove('hide');
        banner.classList.add('show');
        setTimeout(() => {
            banner.classList.remove('show');
            banner.classList.add('hide');
            overlay.classList.remove('active');
        }, ms);
    }

    // Allow small per-page scripts to use the same toast UI.
    window.BKD = window.BKD || {};
    window.BKD.notify = showNotification;

    /* ── CONTACT FORMS ────────────────────────────────────────────────── */
    function initContactForms() {
        const forms = $$('form[data-bkd-contact-form="1"]');
        if (!forms.length) return;

        forms.forEach(form => {
            if (form.dataset.bound === '1') return;
            form.dataset.bound = '1';

            const submitBtn = form.querySelector('button[type="submit"]');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const fd = new FormData(form);
                if (!fd.has('page')) fd.set('page', location.href);

                try {
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.dataset.prevText = submitBtn.textContent || '';
                        submitBtn.textContent = 'Sending…';
                    }

                    const res = await fetch(form.action || '/api/contact', {
                        method: form.method || 'POST',
                        body: fd
                    });

                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !json.ok) {
                        throw new Error(json.error || 'Message failed to send. Try again or text/email me.');
                    }

                    form.reset();
                    showNotification('Got it — I’ll get back to you soon.', 4200);
                } catch (err) {
                    showNotification(err && err.message ? err.message : 'Something went wrong. Please try again.', 5200);
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.dataset.prevText || 'Send';
                    }
                }
            });
        });
    }

    /* ── SIDE PANEL NAV (auto-built from sections + extras) ────────────── */
    function renderNav() {
        const container = $('#panelNav');
        if (!container) return;

        const nav    = CONFIG.nav || {};
        const before = nav.before || [];
        const after  = nav.after  || [];

        const sectionLinks = SECTIONS.map(sec => ({
            label: sec.navLabel || sec.label,
            href:  '#' + sec.id
        }));

        const combined = [...before, ...sectionLinks, ...after];

        const seenLabels = new Set();
        const deduped = combined.filter(link => {
            if (!link || !link.label) return false;
            if (link.label.startsWith('─')) return true;
            const key = String(link.label).trim().toLowerCase();
            if (!key) return false;
            if (seenLabels.has(key)) return false;
            seenLabels.add(key);
            return true;
        });

        container.innerHTML = deduped
            .map(link => {
                // Render separator entries as visual dividers, not links
                if (link.label && link.label.startsWith('─')) {
                    return '<hr class="panel-nav-divider">';
                }
                return `<a href="${link.href}">${link.label}</a>`;
            })
            .join('');
    }

    /* ── SIDE PANEL ────────────────────────────────────────────────────── */
    function initSidePanel() {
        const trigger  = $('#menuTrigger');
        const panel    = $('#sidePanel');
        const backdrop = $('#sidePanelBackdrop');
        if (!trigger || !panel || !backdrop) return;

        const open  = () => { panel.classList.add('open');    backdrop.classList.add('open');    document.body.style.overflow = 'hidden'; };
        const close = () => { panel.classList.remove('open'); backdrop.classList.remove('open'); document.body.style.overflow = ''; };

        trigger.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
        backdrop.addEventListener('click', close);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        // Close when a panel nav link is clicked (better UX on mobile)
        $$('.panel-nav a', panel).forEach(a => a.addEventListener('click', close));

        let touchStartX = 0;
        panel.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        panel.addEventListener('touchend',   e => { if (touchStartX - e.changedTouches[0].screenX > 50) close(); });
    }

    /* ── INTERSECTION OBSERVER (reveal-on-scroll) ──────────────────────── */
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    function observeReveals() {
        $$('.reveal').forEach(el => observer.observe(el));
    }

    /* ── MEDIA HYDRATION (videos + iframes) ───────────────────────────── */
    function initDeferredMedia() {
        const videos  = $$('video[data-bkd-video="1"]');
        const iframes = $$('iframe[data-bkd-iframe="1"]');

        function hydrateVideo(video) {
            if (video.dataset.hydrated === '1') return;
            video.dataset.hydrated = '1';

            const webm = video.dataset.srcWebm;
            const mp4  = video.dataset.srcMp4;

            const sources = [];
            if (webm) sources.push({ src: webm, type: 'video/webm' });
            if (mp4)  sources.push({ src: mp4,  type: 'video/mp4' });

            sources.forEach(s => {
                const el = document.createElement('source');
                el.src  = s.src;
                el.type = s.type;
                video.appendChild(el);
            });

            video.load();
        }

        function maybePlay(video) {
            if (video.dataset.autoplay !== '1') return;
            const p = video.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }

        function pauseVideo(video) {
            try { video.pause(); } catch (_) {}
        }

        function hydrateIframe(frame) {
            if (frame.dataset.hydrated === '1') return;
            const src = frame.dataset.src;
            if (!src) return;
            frame.dataset.hydrated = '1';
            frame.src = src;
        }

        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const el = entry.target;
                const isIn = entry.isIntersecting;

                if (el.tagName === 'VIDEO') {
                    if (isIn) {
                        hydrateVideo(el);
                        maybePlay(el);
                    } else {
                        pauseVideo(el);
                    }
                    return;
                }

                if (el.tagName === 'IFRAME') {
                    if (isIn) hydrateIframe(el);
                    return;
                }
            });
        }, { threshold: 0.15, rootMargin: '200px 0px 200px 0px' });

        videos.forEach(v => io.observe(v));
        iframes.forEach(f => io.observe(f));

        const onVis = () => {
            if (!document.hidden) return;
            videos.forEach(pauseVideo);
        };
        document.addEventListener('visibilitychange', onVis);

        return { disconnect: () => io.disconnect() };
    }

    /* ── FEATURED GALLERY (data-driven) ───────────────────────────────── */
    function initFeaturedGallery() {
        const container = document.querySelector('[data-bkd-featured-gallery="1"]');
        if (!container) return;
        if (container.dataset.hydrated === '1') return;
        container.dataset.hydrated = '1';

        fetch('/assets/data/featured.json', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                const items = (data && data.items) || [];
                if (!items.length) {
                    container.innerHTML = '<div class="featured-empty">No featured posts yet.</div>';
                    return;
                }

                container.innerHTML = `
                    <div class="featured-grid">
                        ${items.map(item => `
                            <a class="featured-card" href="${item.url}" target="_blank" rel="noopener">
                                <img class="featured-thumb" src="${item.thumbnail}" alt="${item.title || item.platform}" loading="lazy">
                                <div class="featured-meta">
                                    <div class="featured-platform">${item.platform || ''}</div>
                                    <div class="featured-title">${item.title || ''}</div>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                `;
            })
            .catch(() => {
                container.innerHTML = '<div class="featured-empty">Unable to load featured posts.</div>';
            });
    }

    /* ── VIEWPORT-ACTIVATED SECTION EFFECTS ───────────────────────────── */
    function initViewportActivatedEffects() {
        const controllers = new Map();

        const getController = (section) => {
            if (controllers.has(section.id)) return controllers.get(section.id);
            const c = createSectionPulseController(section);
            controllers.set(section.id, c || null);
            return c;
        };

        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const section = SECTIONS.find(s => s.id === id);
                if (!section) return;
                const c = getController(section);
                if (!c) return;
                if (prefersReducedMotion()) {
                    c.stop();
                    return;
                }
                if (entry.isIntersecting) c.start();
                else c.stop();
            });
        }, { threshold: 0.12, rootMargin: '120px 0px 120px 0px' });

        SECTIONS.forEach(sec => {
            const el = document.getElementById(sec.id);
            if (el) io.observe(el);
        });

        const onVis = () => {
            if (!document.hidden) return;
            controllers.forEach(c => c && c.stop());
        };
        document.addEventListener('visibilitychange', onVis);

        return { disconnect: () => io.disconnect() };
    }

    /* ── SCROLL-TO-FIRST-SECTION HINT ──────────────────────────────────── */
    function wireScrollHint() {
        const btn = $('#scrollToAbout');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const target = (SECTIONS[0] && document.getElementById(SECTIONS[0].id))
                || $('#contentSections');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    }

    /* ── IDLE PEEK ANIMATION ───────────────────────────────────────────── */
    function initIdlePeek() {
        const firstSection = SECTIONS[0] && document.getElementById(SECTIONS[0].id);
        if (!firstSection) return;

        let peekDisabled = false;
        let peekTimer = null;
        let isAnimating = false;

        const isAtBottom = () =>
            (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50;

        function easeOutBounce(t) {
            if (t < 1 / 2.75)        return 7.5625 * t * t;
            if (t < 2 / 2.75)      { t -= 1.5  / 2.75; return 7.5625 * t * t + 0.75; }
            if (t < 2.5 / 2.75)    { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
                                     t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
        }

        function doPeek() {
            if (peekDisabled || isAnimating || window.scrollY > window.innerHeight * 0.15) {
                if (!peekDisabled) schedulePeek();
                return;
            }
            isAnimating = true;

            const peekAmount = Math.min(130, firstSection.getBoundingClientRect().top * 0.22);
            document.documentElement.style.scrollBehavior = 'auto';

            const duration  = 1800;
            const startTime = performance.now();

            function tick(now) {
                const elapsed  = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                let scrollY;
                if (progress < 0.45) {
                    const p = progress / 0.45;
                    const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
                    scrollY = eased * peekAmount;
                } else {
                    const p = (progress - 0.45) / 0.55;
                    scrollY = (1 - easeOutBounce(p)) * peekAmount;
                }
                window.scrollTo(0, scrollY);

                if (progress < 1) {
                    requestAnimationFrame(tick);
                } else {
                    window.scrollTo(0, 0);
                    document.documentElement.style.scrollBehavior = '';
                    isAnimating = false;
                    schedulePeek();
                }
            }
            requestAnimationFrame(tick);
        }

        function schedulePeek() {
            clearTimeout(peekTimer);
            if (!peekDisabled) peekTimer = setTimeout(doPeek, 4500);
        }

        window.addEventListener('scroll', () => {
            if (isAtBottom()) {
                peekDisabled = true;
                clearTimeout(peekTimer);
                return;
            }
            if (!isAnimating) {
                if (window.scrollY > window.innerHeight * 0.15) clearTimeout(peekTimer);
                else schedulePeek();
            }
        }, { passive: true });

        schedulePeek();
    }

    /* ── HERO PARALLAX (subtle) ────────────────────────────────────────── */
    function initHeroParallax() {
        const heroTitle = $('.hero-title');
        const heroSub   = $('.hero-sub');
        if (!heroTitle && !heroSub) return;

        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            if (y < window.innerHeight) {
                if (heroTitle) heroTitle.style.transform = `translateY(${y * 0.25}px)`;
                if (heroSub)   heroSub.style.transform   = `translateY(${y * 0.15}px)`;
            }
        }, { passive: true });
    }

    /* ── BOOTSTRAP ─────────────────────────────────────────────────────── */
    function start() {
        // Phase 1: guaranteed-first-paint shell wiring
        renderNav();
        renderSocials('panelSocials',  'panel');
        renderSocials('footerSocials', 'footer');
        renderSocials('heroSocials',   'hero');
        initSidePanel();
        wireScrollHint();

        // Phase 2: above-fold polish (lightweight listeners)
        requestAnimationFrame(() => {
            initHeroParallax();
            initIdlePeek();
        });

        // Phase 3: DOM-heavy section render + reveal observer
        requestAnimationFrame(() => {
            renderContentSections();
            wireSectionButtons();
            observeReveals();
            initContactForms();

            // Phase 4: viewport-triggered hydration (media + per-section effects)
            runWhenIdle(() => {
                initDeferredMedia();
                initViewportActivatedEffects();
                initFeaturedGallery();
            }, 2000);
        });

        // Phase 5: expensive background effect (idle + reduced-motion aware)
        if (!prefersReducedMotion()) {
            runWhenIdle(() => initBackgroundPulse(), 2500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
