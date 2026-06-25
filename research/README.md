# Lee County Corruption Research Timeline

A comprehensive, searchable timeline documenting incidents, investigations, and scandals in Lee County, Florida.

## Features

### Admin Panel (`admin.html`)
- **Add new entries** with title, date, category, source, and description
- **Rich media support** - attach article URLs and video links
- **Personal notes** - add research notes and follow-ups
- **Edit & delete** - modify or remove entries as needed
- **Live entry count** - see total entries at a glance
- **Beautiful, dark UI** matching main website design

### Public Timeline (`index.html`)
- **Interactive timeline** with hover effects and visual feedback
- **Year-based organization** - entries automatically grouped by year
- **Category filters** - filter incidents by type (Police Corruption, Financial Mismanagement, Arrests, etc.)
- **Quick stats** - total entries, year range, and category count
- **Responsive design** - works perfectly on mobile and desktop
- **Direct source links** - easily access articles and videos

## Categories

- **Police Corruption** - Allegations of misconduct by law enforcement
- **Financial Mismanagement** - Misuse of public funds and money laundering
- **Arrests** - Criminal arrests and indictments
- **Investigations** - Ongoing investigations and probes
- **Government Scandal** - Government official misconduct
- **Sheriff's Office** - Lee County Sheriff Department incidents
- **City Council** - Municipal government issues
- **Legal Action** - Court cases and legal proceedings
- **Other** - Miscellaneous entries

## Initial Sample Data

The timeline comes pre-populated with 7 verified incidents from 2023-2026:

1. **Sheriff Marceno FBI Investigation Closed** (Nov 2025) - Federal investigation into alleged kickbacks
2. **State Ethics Investigation** (May 2026) - Ongoing state-level ethics probe
3. **Undercover FBI Audio** (Jan 2026) - Recorded conversations about payments
4. **Operation No Cap** (Jul 2025) - Large drug trafficking and money laundering organization
5. **Tax Fraud - Roofing Company** (Jun 2025) - 10-year tax evasion scheme
6. **Embezzlement Scheme** (Jan 2023) - $3M+ fraud by company employee
7. **Fraudulent Pain Clinic** (Jun 2024) - Illegal distribution of oxycodone

All entries include:
- Source attribution (news outlets, court records, government agencies)
- Detailed descriptions
- Direct links to articles/investigations
- Research notes

## How to Use

### Adding Entries (Admin)
1. Open `admin.html` in a web browser
2. Fill in the entry form:
   - **Title** - Brief headline of the incident
   - **Date** - When it occurred
   - **Category** - Type of incident
   - **Source** - Where you found this information
   - **Description** - Summary of what happened
   - **Article/Video URLs** (optional) - Links to supporting material
   - **Notes** (optional) - Your research observations
3. Click "Add Entry"
4. Entries appear immediately in the list below

### Viewing Timeline (Public)
1. Open `index.html` in a web browser
2. Browse the chronological timeline
3. Use filter buttons to view specific categories
4. Click "Article" or "Video" links to view source material
5. Hover over timeline entries for visual feedback

## Data Storage

All entries are stored in your browser's **localStorage**. This means:
- ✓ Data persists between page reloads
- ✓ No server or backend required
- ✓ Complete privacy - nothing is uploaded
- ✗ Data is local to each browser/device
- ✗ Clearing browser data will delete entries

**Backup:** Periodically export your data by opening browser Developer Tools and copying the localStorage entry for `leecountyresearch_entries`.

## Design Improvements

### Updated Styling
- Integrated Google Fonts (Golos Text) to match main website
- Font Awesome icons throughout for better UX
- Enhanced color scheme using site's gold (#d4a574) accent
- Improved typography with letter spacing and weights
- Better visual hierarchy and spacing

### Admin Panel Enhancements
- Icon buttons for better visual clarity
- Improved form organization and labels
- Better card layout with hover effects
- Success/error message notifications
- Clear action buttons with icons

### Public Timeline Enhancements
- Year markers automatically inserted between entries
- Animated timeline dots with glow effects
- Category badges with proper capitalization
- Enhanced entry cards with smooth transitions
- Icon indicators for date, articles, and videos
- Better mobile responsiveness

## Customization

### Add More Categories
Edit the category `<select>` in `admin.html` (around line 295):
```html
<option value="your-new-category">Your New Category</option>
```

### Change Colors
Update the color variable `#d4a574` (gold) throughout both files to your preferred color.

### Modify Styling
All CSS is embedded in the `<style>` tags. Feel free to adjust fonts, spacing, or effects.

## Browser Support

- Chrome/Chromium ✓
- Firefox ✓
- Safari ✓
- Edge ✓
- Mobile browsers ✓

## Notes

- This timeline documents public information from credible sources
- All entries should include proper attribution
- Keep descriptions factual and cite sources
- Regular backups of localStorage data are recommended

---

**Last Updated:** June 2026
**Data Sources:** WGCU News, PBS, U.S. Department of Justice, Florida Department of Law Enforcement, Local News Outlets
