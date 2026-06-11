# BKDziti Website - Comprehensive Testing Checklist

## Overview
Complete functional testing of all website features, links, and sections.

---

## 1. MAIN PAGES & NAVIGATION

### Home Page (index.html)
- [ ] Page loads without errors
- [ ] Hero section displays correctly
- [ ] All navigation links in side panel work
- [ ] Social media links in footer are valid
- [ ] "Resume" button links to secret.html
- [ ] Canvas background animation runs smoothly
- [ ] Video elements load and play (if applicable)

### Services Page (services.html)
- [ ] Page loads and displays all service sections
- [ ] All links within page work
- [ ] Navigation back to home works
- [ ] Mobile responsive layout tested

### Portfolio Page (portfolio.html)
- [ ] Portfolio items display correctly
- [ ] Image assets load properly
- [ ] Links to project details work
- [ ] Filtering/sorting functions (if any) work

### Contact Page (contact.html)
- [ ] Contact form displays
- [ ] Form fields are functional
- [ ] Form submission works (if backend exists)
- [ ] Contact information is displayed
- [ ] Map embed (if any) loads

### Blog Section (blog/index.html)
- [ ] Blog landing page loads
- [ ] All blog post links work
- [ ] Individual blog post pages load

**Blog Posts to Test:**
- [ ] food-photography-videography-guide.html
- [ ] how-to-start-popup-restaurant.html
- [ ] restaurant-branding-media-strategy.html

---

## 2. STORE FUNCTIONALITY

### Store Home (store/index.html)
- [ ] Product grid loads
- [ ] Products display with images, prices, names
- [ ] Search functionality works
- [ ] Category filters work
- [ ] Product detail modal opens when clicked
- [ ] Add to cart button works
- [ ] Cart badge updates correctly

### Shopping Cart (store/cart.html)
- [ ] Cart displays all added items
- [ ] Quantity can be modified
- [ ] Items can be removed
- [ ] Cart total calculates correctly
- [ ] "Proceed to Checkout" button works
- [ ] Cart persists on page refresh (localStorage)

### Checkout (store/checkout.html)
- [ ] Checkout form displays
- [ ] Form validation works
- [ ] All required fields are marked
- [ ] Payment section loads (if integrated)
- [ ] Order submission works

### Order Confirmation (store/confirmation.html)
- [ ] Displays after successful order
- [ ] Shows order number
- [ ] Shows order details
- [ ] Confirmation email message displays

### Order Lookup (store/orders.html)
- [ ] Order lookup form works
- [ ] Can search by order number
- [ ] Displays order history
- [ ] Shows order status and details

### Store Admin (store/admin/index.html)
- [ ] Admin panel loads
- [ ] Product management functions (if implemented)
- [ ] Order management functions (if implemented)
- [ ] Admin authentication/protection works

---

## 3. RESEARCH & CORRUPTION TIMELINE

### Research Landing (research/index.html)
- [ ] Timeline loads without errors
- [ ] Data from sample-data.js displays correctly
- [ ] All 27+ entries show with proper formatting
- [ ] Filter buttons work for each category
- [ ] "All Entries" filter works
- [ ] Entries sort by date (newest first)
- [ ] Stats display correctly (total entries, year range, categories)

**Category Filters to Test:**
- [ ] sheriff-office
- [ ] investigations
- [ ] arrests
- [ ] financial-mismanagement
- [ ] city-council
- [ ] government-scandal
- [ ] legal-action
- [ ] police-corruption

### Entry Details
- [ ] Entry titles display correctly
- [ ] Dates format properly
- [ ] Categories display with correct styling
- [ ] Sources cite properly
- [ ] Descriptions are readable
- [ ] External links (Article, Video) work
- [ ] Notes section (if any) displays

**Sample Entries to Test:**
- [ ] FBI Investigation - Marceno Closed
- [ ] Sheriff Caught Racing Video
- [ ] Cape Coral Councilmember Fraud
- [ ] Cape Coral Pay Raise Controversy

### Research Admin (research/admin.html)
- [ ] Admin panel loads
- [ ] Can add new entries (if implemented)
- [ ] Can edit existing entries
- [ ] Can delete entries
- [ ] Data persists to localStorage/sample-data.js

### Submit Entry (research/submit.html)
- [ ] Submit form displays
- [ ] All form fields present
- [ ] Form validation works
- [ ] Submit button works
- [ ] Success message displays
- [ ] New entries appear in timeline

---

## 4. NEW HOSTING SECTION

### Hosting Landing (hosting/index.html)
- [ ] Page loads without errors
- [ ] Hosting features display in grid
- [ ] "Hosted Websites" section shows
- [ ] Contact link works
- [ ] Navigation includes hosting link

### Hosting README (hosting/README.md)
- [ ] File exists and is readable
- [ ] Instructions are clear
- [ ] Examples provided

### Example Site (hosting/example-site/)
- [ ] index.html loads at /hosting/example-site/
- [ ] Styling applies correctly (style.css loads)
- [ ] JavaScript works (smooth scrolling, etc.)
- [ ] Navigation links work
- [ ] Links back to main site work

---

## 5. EXTERNAL LINKS & RESOURCES

### CDN Resources
- [ ] Font Awesome icons load (CDN link works)
- [ ] Google Fonts load correctly
- [ ] All icons display properly

### Image Assets
- [ ] Favicon displays in browser tab
- [ ] Logo images load
- [ ] Product images in store load
- [ ] Blog post images load
- [ ] Profile pictures load
- [ ] Background videos play (if any)

### Social Links (from data.js)
- [ ] Facebook: https://www.facebook.com/TheRealBKDziti/
- [ ] YouTube: https://www.youtube.com/@BKDziti
- [ ] Instagram: https://www.instagram.com/bkdziti/
- [ ] Twitch: https://www.twitch.tv/bkdziti
- [ ] TikTok: https://www.tiktok.com/@bkdziti
- [ ] GitHub: https://www.github.com/bkd-ziti
- [ ] Patreon: https://patreon.bkdziti.com/

### Research External Links (sample entries)
- [ ] WGCU News articles load
- [ ] Florida Trident links work
- [ ] Department of Justice links work
- [ ] Police Scorecard links work
- [ ] Ballotpedia links work

---

## 6. RESPONSIVE DESIGN

### Mobile Testing (320px - 768px)
- [ ] All pages stack vertically
- [ ] Navigation menu collapses to hamburger
- [ ] Text remains readable
- [ ] Images scale properly
- [ ] Forms are usable
- [ ] Buttons are touch-friendly
- [ ] No horizontal scrolling

### Tablet Testing (768px - 1024px)
- [ ] Layout adapts appropriately
- [ ] Two-column layouts work
- [ ] Touch interactions work

### Desktop Testing (1024px+)
- [ ] Multi-column layouts work
- [ ] Hover states display
- [ ] Animations are smooth
- [ ] Spacing is appropriate

---

## 7. PERFORMANCE

- [ ] Pages load in < 3 seconds
- [ ] No console JavaScript errors
- [ ] No missing resources (404s)
- [ ] CSS loads without blocking
- [ ] Images are optimized
- [ ] Videos are optimized

---

## 8. ACCESSIBILITY

- [ ] Page titles are descriptive
- [ ] Headings structure is logical (h1, h2, h3)
- [ ] Alt text on all images
- [ ] Form labels associated with inputs
- [ ] Color contrast is sufficient
- [ ] Keyboard navigation works
- [ ] Tab order is logical

---

## 9. SPECIAL FEATURES

### Canvas Animation (bgPulse)
- [ ] Background animation runs without lag
- [ ] Animation is visible on all pages
- [ ] Performance is acceptable

### localStorage (Cart & Research)
- [ ] Cart items persist
- [ ] Research entries persist
- [ ] Clear functionality works (if implemented)

### Smooth Scrolling
- [ ] Anchor links scroll smoothly
- [ ] Scroll position is accurate
- [ ] Works on all browsers

---

## 10. CROSS-BROWSER TESTING

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Edge

---

## ISSUES FOUND & RESOLUTIONS

### Issue #1: [Description]
- Status: [ ] Not Started [ ] In Progress [ ] Resolved
- Fix: 
- Tested: [ ] Yes [ ] No

### Issue #2: [Description]
- Status: [ ] Not Started [ ] In Progress [ ] Resolved
- Fix: 
- Tested: [ ] Yes [ ] No

---

## SIGN-OFF

- Tested By: _________________
- Date: _________________
- Status: [ ] PASS [ ] FAIL - NEEDS WORK
- Notes: 

---

**Last Updated:** June 11, 2026
