# Product Request Tracker

A Vercel-hosted portal where stakeholders can track product intake requests by searching Jira tickets in plain English. Sends automated Outlook email notifications when statuses change.

## Architecture (Jira-only)

```
Stakeholder → Search UI → /api/search → Jira REST API (JQL text search)
                                              ↓
                                    Enriched result + pizza tracker

Jira webhook (status change) → /api/webhooks/jira → Lookup requester → Send Outlook email
```

**No Freshservice required.** Jira is the single source of truth. The requester's email comes from either a custom field on the Jira ticket or the reporter field.

## Features

- **Search by text**: Stakeholders type keywords like "network mismatch" or a Jira key like "DPS-100999"
- **Pizza tracker**: Visual 6-step progress bar (Submitted → Review → Scope → Dev → UAT → Released)
- **Email notifications**: Auto-sent on status changes, sprint assignments, and PM assignments
- **Email subscriptions**: Stakeholders subscribe to "full activity" or "milestones only" updates
- **Recent notes**: Shows latest Jira comments in plain text
- **Not-found escalation**: If a search fails, stakeholders can ask the product team to look into it

## Quick Start

```bash
# 1. Clone
git clone <repo> && cd product-request-tracker

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# Edit .env.local with your Jira + SMTP credentials

# 4. Run
npm run dev
# Open http://localhost:3000/intake-status
```

## Setup Guide

### 1. Jira Configuration

**API Token:**
- Go to https://id.atlassian.com/manage-profile/security/api-tokens
- Create a token for a service account (not your personal account)

**Custom Fields (recommended):**
Create these custom fields in Jira so the app knows who to email:
- "Requester Email" (text field) → note the `customfield_XXXXX` ID
- "Requester Name" (text field) → optional
- "Client" (text field or select) → optional

Set these IDs in your env vars.

**Alternative:** If you don't create custom fields, the app falls back to the Jira reporter's email.

### 2. Jira Webhook

Go to **Jira Settings → System → Webhooks**:
- URL: `https://your-app.vercel.app/api/webhooks/jira?secret=YOUR_WEBHOOK_SECRET`
- Events: `jira:issue_updated`
- Filter (JQL): `project = DPS` (scope to your project)

### 3. Email (SMTP)

**Microsoft 365:**
- Host: `smtp.office365.com`, Port: `587`
- Use a shared mailbox (e.g., `noreply-product@company.com`)
- Create an App Password or configure OAuth2

**Gmail (for testing):**
- Host: `smtp.gmail.com`, Port: `587`
- Enable 2FA → create an App Password

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Add all env vars in **Vercel Dashboard → Settings → Environment Variables**.

Optional: Link a **Vercel KV** store for persistent subscriptions.

## Project Structure

```
app/
  intake-status/
    page.tsx              ← Server component (header + hero)
    search-client.tsx     ← Client component (search, results, detail view)
  api/
    search/route.ts       ← GET /api/search?q=... → Jira JQL search
    webhooks/jira/route.ts← POST webhook → parse status change → send email
    subscribe/route.ts    ← POST subscription
    unsubscribe/route.ts  ← GET unsubscribe link
    ask-product/route.ts  ← POST "can't find my request" form
lib/
  jira.ts                 ← Jira REST API client (search, get issue, get comments)
  enrich.ts               ← Transforms Jira issue → EnrichedRequest + pizza tracker
  email.ts                ← nodemailer SMTP sender + HTML template
  store.ts                ← Vercel KV / in-memory subscription store
  webhook-auth.ts         ← Webhook secret verification
config/
  constants.ts            ← Status mappings, tracker stages, email templates
types/
  index.ts                ← All TypeScript interfaces
scripts/
  test-webhook.ts         ← Simulate a Jira webhook locally
  test-email.ts           ← Send a test email to verify SMTP
```

## Customization

### Status Mappings

Edit `config/constants.ts` to match your Jira workflow:

```typescript
// Map YOUR Jira status names → pizza tracker stages
export const JIRA_STATUS_TO_STAGE = {
  "Your Custom Status": "development",  // ← maps to the "development" step
  ...
};

// Map YOUR Jira status names → plain English
export const JIRA_STATUS_HUMAN = {
  "Your Custom Status": "A developer is working on this right now",
  ...
};
```

### Tracker Steps

Edit the `TRACKER_STAGES` array in `config/constants.ts` to add/remove/rename steps.

### Email Template

Edit the `buildHtml()` function in `lib/email.ts` to change the email design.

## Production Checklist

- [ ] Replace in-memory store with Vercel KV or a database
- [ ] Add OKTA/SSO authentication (NextAuth.js)
- [ ] Set up monitoring (Sentry, Vercel Logs)
- [ ] Add rate limiting to search endpoint
- [ ] Configure M365 OAuth2 instead of SMTP App Password
- [ ] Set up Jira webhook with proper project filter
