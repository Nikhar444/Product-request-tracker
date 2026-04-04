# V0 PROMPT — Copy everything below into v0.dev

Build a Next.js 14 (App Router, TypeScript, Tailwind CSS) product request status portal. This is a stakeholder-facing tool where business users can look up the status of product requests they've submitted. Use mock data throughout — no real API calls. I'll wire up the backend separately.

---

## Page: `/intake-status`

Everything happens on this single page. Two states: search view and results view.

---

### STATE 1: Search View (default)

**Header bar**: Full-width, solid purple background (#5B2D8E), height ~56px.
- Left: white text "likewize." in lowercase, bold, with a period (this is the logo)
- Right: "New search" link in white text

**Hero section**: Below header, a soft purple gradient background (#5B2D8E fading to #F3EEFF at bottom), padding ~40px vertical.
- Heading (white, bold, ~24px): "Product Request status"
- Two lines of subtext (white/light purple, ~14px): "See status, planned timing, and the latest updates for your product intake requests at one place."

**Search section**: White background, centered, max-width ~560px.
- Label: "Request number or keywords" (small, gray, above the input)
- Input: bordered text field, full width, placeholder "e.g. REQ-11918885 or 'network mismatch'"
- Button below input: "View status" — solid purple (#5B2D8E) button, white text, ~140px wide, left-aligned

**When searching**: Show a loading skeleton below the search

---

### STATE 2: Results View (after clicking "View status")

The search box stays at top (so user can search again). Results appear below, divided into clear sections with generous spacing.

---

#### Section A: Request Header

A card/container showing:
- **Title line** (bold, ~16px): `DISH | US | #REQ-11918885 | Suppress Network Mismatch Escalations For Active IMEI`
- **Row of pills** below the title:
  - Green pill: "Scheduled" (bg #E1F5EE, text #0F6E56, border-radius 12px)
  - Gray pill: "DPS Enhancement" (bg #F3F4F6, text #6B7280)
  - Muted text: "Updated Apr 2, 2026"
- **Timestamp line** (small muted text): "Information as of Apr 2, 10:09 PM"
- **Reference line** (small text): "Reference from your confirmation: **#REQ-11918885**"

---

#### Section B: Product Manager Card

A row/card with light purple background (#F3EEFF), rounded corners, padding ~16px:
- Left: Circle avatar (40px, purple #5B2D8E background, white initials "KP")
- Right of avatar:
  - Small caps label: "PRODUCT MANAGER FOR THIS REQUEST" (muted, 11px, tracking-wide)
  - Name in bold below: "Kavya Parthiban" (~15px)

---

#### Section C: What This Request Covers

- Label: "WHAT THIS REQUEST COVERS" (small caps, muted, tracking-wide, 11px)
- Body text (~14px, regular weight, dark gray): "Objective: Prevent network mismatch escalations when the customer-entered IMEI matches the device on record but the network/carrier association differs. This will reduce unnecessary escalations and improve customer experience."
- If text is longer than 3 lines, truncate with a "Show more" toggle link in purple

---

#### Section D: Pizza Tracker — "HOW WE GET THERE"

This is the KEY visual feature. A **vertical timeline stepper**.

- Section label: "HOW WE GET THERE" (small caps, muted, tracking-wide)

**Three steps, vertically stacked:**

Each step has:
- A numbered circle on the left (32px diameter)
  - COMPLETED: solid teal/green (#1D9E75) background, white number
  - CURRENT: white background with pulsing teal border (animated), teal number
  - UPCOMING: light gray (#E5E7EB) background, gray number
- A vertical line connecting circles:
  - Between completed steps: solid teal line (2px)
  - Between current and upcoming: dashed gray line (2px)
- Text content to the right of each circle:
  - Step name in bold (~14px)
  - Subtitle in muted text (~13px) if applicable
  - Date(s) in teal (#1D9E75, ~13px, font-medium) if completed

**The three steps with mock data:**

1. ● **Scope confirmed with business**
   Subtitle: "Final scope date"
   Date: **22nd December 2025** (teal)
   Status: COMPLETED

2. ● **Development sprint starts**
   Date: **20th February 2026** (teal)
   Status: COMPLETED

3. ● **User acceptance testing**
   Subtitle: "Planned testing window"
   Date: **23rd March 2026 → 27th March 2026** (teal)
   Status: COMPLETED (or CURRENT for some mock items)

Below the stepper: muted italic text (12px): "Dates are planning targets and may change."

**IMPORTANT**: For CLOSED tickets, show all steps completed with a green "Released" badge at the bottom. For early-stage tickets (no Jira yet), add earlier steps: "Request submitted" and "Under product review" before the three above — making it a 5-step tracker.

---

#### Section E: Email Subscription Banner

**Collapsed state** (default): A horizontal banner/card with light lavender (#F8F5FF) background:
- Left: Lock/bell icon (🔔 or a shield icon in a small circle)
- Text: "Click to subscribe for email updates about this request"
- Right side smaller text: "DPS-100999 · DISH | US | #REQ-11918885 | Suppress Network Mismatch Escalations For Acti..."
- Chevron (▼) on far right to expand
- Clicking anywhere expands it

**Expanded state**: Slides open below the banner with a form:
- Close (×) button in top right
- Heading: "Email updates"
- Subtext: "Choose what we include. We never change anything in Jira—read-only notifications only."

- Label: "LIKEWIZE EMAIL" (small caps)
- Input: email field, placeholder "you@likewize.com"

- Label: "UPDATE TYPE" (small caps)
- Two side-by-side selectable cards (radio behavior — only one selected at a time):
  
  **Card 1** (unselected default style):
  - Radio circle (unfilled) + bold title: "Full activity summary"
  - Description: "Smart summaries when status changes, new comments appear, or the description is updated."
  - Border: 1px gray (#D1D5DB)
  
  **Card 2** (selected default style):
  - Radio circle (filled purple) + bold title: "Status milestones only"
  - Description: "Email when the ticket moves among key milestones (In Progress, In Scope Review, Ready for Release, Closed)."
  - Border: 2px purple (#5B2D8E)

- Purple button: "Subscribe to updates"
- Muted text to the right: "Unsubscribe anytime from the link in each email."

---

#### Section F: Recent Notes

- Section label: "RECENT NOTES" (small caps, muted)
- Subtext: "Each entry shows who commented and when, so you can follow the conversation."

**Note cards** (no background, just separated by spacing or thin dividers):
Each note:
- Row: avatar circle (32px, with user initials) + name as purple link + timestamp in muted text (e.g., "Mar 19, 2026 · 2:52 PM")
- Note body text below (~14px, dark gray, multi-line allowed)

**Mock data — 2 notes:**

Note 1:
- Author: Katherine Rentz (avatar "KR")
- Time: Mar 19, 2026 · 2:52 PM
- Body: "Solution is not changing, moving to solution complete to show dependency is not resolved. Will move to RFR when configuration timeline is available."

Note 2:
- Author: Katherine Rentz
- Time: Mar 19, 2026 · 2:50 PM
- Body: "Based on discussion with business stakeholders and CRAC committee - this ticket is accepted for removal from the 14.4 Release as the feature being implemented will not have correct data to build off of and therefore not offer any additional clarity. There are configuration changes that need to be made on partner systems to be able to effectively clean the data and then take this feature forward."

---

#### Section G: Jira Link (small, below notes or in header area)

A subtle row:
- Jira icon (blue square with J) or just text
- "DPS-100999" as a clickable link (purple, underline on hover)
- Opens in new tab (mock href for now)
- Badge next to it showing Jira status: e.g., "In Progress" (amber badge)

---

### Not-Found State (when search returns no results)

Replace the results area with:

**Yellow/amber warning box** (bg #FEF3C7, border-left 4px #D97706):
- Text: "We could not find a request matching that number in this portal yet. Check the number on your confirmation email, watch for typos, or ask your Likewize contact. You can ask the product team to look into it using the form below."

**Below: "ASK PRODUCT TO REVIEW" card**:
- Card with subtle border, padding
- Subtext: "Leave your email and **confirm the same request number** you searched for so we can route it correctly."
- "Request to confirm: REQ-{searched_number}" in bold
- Input: "Your email" (placeholder: you@company.com)
- Input: "Confirm request number" (pre-filled with REQ-{searched_number})
- Purple button: "Send to product"

---

## MOCK DATA

Create a mock data file with 3-4 sample requests at different stages so the UI can be demoed:

1. **REQ-11918885** — "Suppress Network Mismatch Escalations For Active IMEI" — Stage: UAT (step 3/3 complete), PM: Kavya Parthiban, Jira: DPS-100999, Client: DISH, Country: US, Status: Scheduled
2. **REQ-12093026** — "Configurable popup on Pre-trade" — Stage: Development (step 2/3), PM: Mark Sullivan, Jira: DPS-104872, Client: Global, Status: Draft
3. **REQ-12111042** — "Enhanced claim routing for multi-carrier support" — Stage: Under Review (pre-Jira, step 2/5), PM: none yet, Jira: none, Client: Samsung, Country: JP, Status: Under Review
4. **REQ-10048823** — "Auto-populate repair center from postal code" — Stage: Closed/Released (all complete), PM: Kavya Parthiban, Jira: DPS-89221, Client: BBTI, Country: UK, Status: Closed

The search should fuzzy-match against title, request number, client name, and PM name from this mock data.

---

## DESIGN DETAILS

- **Purple**: #5B2D8E (header, buttons, links, selected states)
- **Teal/green**: #1D9E75 (completed stages, dates)
- **Amber**: #D97706 (in-progress, warnings)
- **Light purple bg**: #F3EEFF (PM card, selected subscription card border area)
- **White cards** with border #E5E7EB and shadow-sm
- **Pills**: rounded-full (border-radius 9999px), small text, px-3 py-1
- **Inputs**: rounded-md, border-gray-300, focus:ring-purple-600, h-10
- **Buttons**: rounded-md, bg-[#5B2D8E], text-white, hover:bg-[#4A2574], px-6 h-10
- **Section labels**: uppercase, text-xs, tracking-widest, text-gray-400, font-semibold, mb-3
- **Responsive**: Must look good on desktop (stakeholders demo on projectors) and tablet. Mobile is secondary but should still work.
- **Animations**: Smooth accordion for email subscription section. Fade-in for search results. Subtle pulse animation on the "current step" circle in the pizza tracker.

## COMPONENT STRUCTURE

Build as clean, reusable components:
- `SearchBar` — input + button
- `RequestHeader` — title, pills, timestamps
- `PMCard` — product manager info
- `RequestDescription` — expandable description
- `PizzaTracker` — the vertical timeline stepper (most important component)
- `EmailSubscription` — collapsible subscription form
- `RecentNotes` — notes list
- `JiraLink` — small Jira reference
- `NotFoundState` — warning + ask-product form
- `StatusPill` — reusable colored pill/badge

All data comes from a `lib/mock-data.ts` file. Each component accepts typed props. I'll replace mock data with real API calls later.
