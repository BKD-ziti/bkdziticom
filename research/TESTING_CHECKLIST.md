# Comprehensive Testing Checklist
## Lee County Corruption Research Timeline Integration

### Phase 1: File Structure & Imports ✓

**Core Files Present:**
- [x] sample-data.js - Contains 26 entries (2018-2026)
- [x] research/index.html - Public timeline
- [x] research/admin.html - Admin panel
- [x] research/submit.html - Public submission form

**Import Verification:**
- [ ] research/index.html imports sample-data.js correctly
- [ ] research/admin.html imports sample-data.js correctly
- [ ] Both have updated initialization functions
- [ ] No syntax errors in any files

---

### Phase 2: Navigation Integration

**Main Pages Checked:**
- [ ] index.html - Research link in sidebar nav
- [ ] secret.html - Research link in sidebar nav
- [ ] contact.html - Research link (both footer-nav and PAGE_CONFIG)
- [ ] services.html - Research link in sidebar nav
- [ ] portfolio.html - Research link in sidebar nav
- [ ] faq.html - Research link in sidebar nav
- [ ] food-consulting.html - Research link in sidebar nav
- [ ] media-production.html - Research link in sidebar nav
- [ ] blog/index.html - Research link (both footer-nav and PAGE_CONFIG)

**Link Verification:**
- [ ] All links use correct relative paths
- [ ] Links point to research/index.html#hero
- [ ] Positioned after Resume & Cover Letter
- [ ] Separated from business content with divider

---

### Phase 3: Data Loading & Display

**Entry Count:**
- [ ] Total entries load: 26 (from sample-data.js)
- [ ] Year range displays: 2018–2026
- [ ] All categories represented
- [ ] No duplicate entries

**Data Integrity:**
- [ ] All Sheriff Marceno entries (9)
- [ ] All Cape Coral entries (9)
- [ ] All investigation entries (8)
- [ ] Correct dates on all entries
- [ ] Links work (articles and videos)

---

### Phase 4: Public Timeline (index.html)

**Display:**
- [ ] All 26 entries visible when scrolling
- [ ] Year markers display correctly
- [ ] Statistics show correct values
  - Total: 26 entries
  - Range: 2018–2026
  - Categories: 8
- [ ] Entries sorted by date (newest first)

**Filtering:**
- [ ] "All Entries" button shows all 26
- [ ] Each category filter works
- [ ] Filter count updates correctly
- [ ] Active filter styling shows
- [ ] Can clear filters

**Mobile Responsiveness:**
- [ ] Timeline readable on mobile
- [ ] Categories stack properly
- [ ] Entries not cut off
- [ ] Links clickable on mobile

---

### Phase 5: Admin Panel (admin.html)

**Authentication:**
- [ ] Login screen appears
- [ ] Password protection works
- [ ] Session persists on refresh
- [ ] Logout works

**Data Management:**
- [ ] All 26 entries display in list
- [ ] Can add new entry
- [ ] Can edit entry (loads form correctly)
- [ ] Can delete entry (with confirmation)
- [ ] Entry count updates
- [ ] Form validates required fields

**Pending Submissions:**
- [ ] Section displays submissions
- [ ] Approve button publishes to timeline
- [ ] Reject button removes submission
- [ ] Submission metadata shows correctly

---

### Phase 6: Public Submission Form (submit.html)

**Form Display:**
- [ ] All form fields present
- [ ] Dropdown categories correct
- [ ] Form validates on submit
- [ ] Success message displays
- [ ] Redirects to timeline after 2 seconds

**Data Storage:**
- [ ] Submissions save to localStorage
- [ ] Appear in admin pending section
- [ ] Can be approved/rejected
- [ ] Submitted email/name captured

---

### Phase 7: Data Synchronization

**Cache Behavior:**
- [ ] Initial visit loads all 26 entries
- [ ] Fresh page load = complete data
- [ ] Edit in admin reflects in public
- [ ] New submissions appear in pending
- [ ] Approved submissions on timeline

**localStorage Keys:**
- [ ] leecountyresearch_entries - published data
- [ ] leecountyresearch_pending - submissions
- [ ] Both persist across sessions

---

### Phase 8: Browser Compatibility

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome)

---

### Phase 9: Edge Cases & Errors

- [ ] Console has no errors
- [ ] No 404s for images/assets
- [ ] External links don't break page
- [ ] Video embeds load correctly
- [ ] PDF links work (if any)
- [ ] No CORS issues

---

### Phase 10: Performance

- [ ] Page loads in < 2 seconds
- [ ] Filter/search responsive
- [ ] Scrolling smooth
- [ ] No lag when adding entries
- [ ] localStorage operations fast

---

## Issues Found:
(To be filled during testing)

1. 
2. 
3. 

## Changes Recommended:
(To be confirmed with user before implementing)

1. 
2. 
3. 

---

**Status:** Ready for testing
**Last Updated:** June 11, 2026
