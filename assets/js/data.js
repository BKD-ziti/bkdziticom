/* =========================================================================
   BKDziti — site data
   Single source of truth for social profiles. Drives the hero buttons,
   side panel, and footer everywhere they appear.
   ========================================================================= */

window.BKD = window.BKD || {};

window.BKD.SOCIALS = [
    {
        platform: 'Facebook',
        icon:     'fab fa-facebook-f',
        url:      'https://www.facebook.com/TheRealBKDziti/'
    },
    {
        platform: 'YouTube',
        icon:     'fab fa-youtube',
        url:      'https://www.youtube.com/@BKDziti'
    },
    {
        platform: 'Instagram',
        icon:     'fab fa-instagram',
        url:      'https://www.instagram.com/bkdziti/'
    },
    {
        platform: 'Twitch',
        icon:     'fab fa-twitch',
        url:      'https://www.twitch.tv/bkdziti'
    },
    {
        platform: 'TikTok',
        icon:     'fab fa-tiktok',
        url:      'https://www.tiktok.com/@bkdziti'
    }
    ,
    {
        platform: 'Github',
        icon:     'fab fa-github',
        url:      'https://www.github.com/bkd-ziti'
    }
    ,
    {
        platform: 'Patreon',
        icon:     'fab fa-patreon',
        url:      'https://patreon.bkdziti.com/'
    }
];

/* =========================================================================
   SITE NAVIGATION — single source of truth for the side panel.
   Uses root-absolute paths (/...) so the exact same definition works from
   every directory depth (root pages, /articles, /store, /research, /hosting).
   Pages inherit this automatically; a page can override with its own
   PAGE_CONFIG.nav, or pick a named variant via PAGE_CONFIG.navVariant.
   ========================================================================= */
window.BKD.NAV = {
    before: [{ label: 'Home', href: '/index.html#hero' }],
    after: [
        { label: '─────────────', href: '#' },
        { label: 'Store',                 href: '/store/index.html' },
        { label: 'Services',              href: '/services.html#hero' },
        { label: 'Culinary Consulting',   href: '/food-consulting.html#hero' },
        { label: 'Media Production',      href: '/media-production.html#hero' },
        { label: 'Portfolio',             href: '/portfolio.html#hero' },
        { label: 'FAQ',                   href: '/faq.html#hero' },
        { label: 'Articles',               href: '/articles/index.html#hero' },
        { label: '─────────────', href: '#' },
        { label: 'Hosting',               href: 'https://hosting.bkdziti.com' },
        { label: 'Resume & Cover Letter', href: '/secret.html#hero' },
        { label: 'Contact',               href: '/contact.html#hero' },
        { label: '─────────────', href: '#' },
        { label: 'Email',                 href: 'mailto:AlexZornes@BKDziti.com' }
    ]
};

/* Store variant — leads with store-specific links, then the full site nav. */
window.BKD.NAV_STORE = {
    before: [{ label: 'Home', href: '/index.html#hero' }],
    after: [
        { label: '─────────────', href: '#' },
        { label: 'Store Home', href: '/store/index.html' },
        { label: 'My Cart',    href: '/store/cart.html' },
        { label: 'My Orders',  href: '/store/orders.html' },
        { label: '─────────────', href: '#' },
        { label: 'Services',              href: '/services.html#hero' },
        { label: 'Culinary Consulting',   href: '/food-consulting.html#hero' },
        { label: 'Media Production',      href: '/media-production.html#hero' },
        { label: 'Portfolio',             href: '/portfolio.html#hero' },
        { label: 'FAQ',                   href: '/faq.html#hero' },
        { label: 'Articles',               href: '/articles/index.html#hero' },
        { label: 'Hosting',               href: 'https://hosting.bkdziti.com' },
        { label: '─────────────', href: '#' },
        { label: 'Contact',               href: '/contact.html#hero' },
        { label: 'Email',                 href: 'mailto:AlexZornes@BKDziti.com' }
    ]
};
