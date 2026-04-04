# Product Request Tracker

A Vercel-hosted platform connecting **Freshservice**, **Jira**, and **Outlook** to give stakeholders real-time, plain-English updates on their product intake requests.

## What it does

**For stakeholders**: A search portal where they type "reporting dashboard" or "REQ-11918885" and see a pizza-tracker-style progress view — no Freshservice login needed.

**For the product team**: Automated Outlook emails sent to requesters whenever:
1. A product manager is assigned to their Freshservice request
2. A Jira ticket gets linked to the request
3. The Jira ticket status changes (e.g. selected for sprint, in progress, done)

## Architecture

```
┌─────────────────┐     webhook      ┌──────────────────┐     SMTP      ┌───────────┐
│  Freshservice    │───────────────►  │  Vercel App      │──────────────►│  Outlook   │
│  (Service Reqs)  │                  │                  │               │  (M365)    │
└─────────────────┘                  │  /api/webhooks/  │               └───────────┘
                                      │  freshservice    │                     │
┌─────────────────┐     webhook      │  /api/webhooks/  │                     ▼
│  Jira            │───────────────►  │  jira            │              Stakeholder
│  (Dev Tickets)   │                  │                  │              Inbox
└─────────────────┘                  │  /api/search     │
                                      │  /intake-status  │◄─── Stakeholder Browser
                                      └──────────────────┘
```

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd product-request-tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in all values — see .env.example for detailed comments
```

### 3. Run locally

```bash
npm run dev
# Open http://localhost:3000/intake-status
```

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Add all env vars in Vercel Dashboard → Settings → Environment Variables.

## Setup Guide

### Freshservice Custom Field

You need a custom field on Freshservice tickets to store the Jira key:

1. Go to **Admin → Form Fields → Ticket Fields**
2. Add a **Single-line text** field named "Jira Ticket"
3. Note the API name (e.g., `cf_jira_ticket`)
4. Set `FRESHSERVICE_JIRA_FIELD=cf_jira_ticket` in your env

### Jira Custom Field

A field on Jira issues to store the Freshservice ticket number:

1. Go to **Jira Settings → Issues → Custom Fields → Create**
2. Add a **Text Field (single line)** named "Freshservice ID"
3. Note the field ID (e.g., `customfield_10050`)
4. Set `JIRA_FRESHSERVICE_FIELD=customfield_10050` in your env

### Freshservice Webhooks

Go to **Admin → Automations → Workflow Automator** (or Observer Rules):

**Webhook 1: PM Assigned**
- Trigger: When "Agent" field changes on a Service Request
- Action: Trigger Webhook (POST)
- URL: `https://your-app.vercel.app/api/webhooks/freshservice?secret=YOUR_WEBHOOK_SECRET`
- Content type: JSON
- Body: Include `ticket_id` and set `event_type` to `pm_assigned`

**Webhook 2: Jira Ticket Linked**
- Trigger: When custom field "Jira Ticket" is updated
- Action: Trigger Webhook (POST)
- URL: `https://your-app.vercel.app/api/webhooks/freshservice?secret=YOUR_WEBHOOK_SECRET`
- Content type: JSON
- Body: Include `ticket_id` and set `event_type` to `jira_linked`

### Jira Webhook

Go to **Jira Settings → System → Webhooks → Create**:

- URL: `https://your-app.vercel.app/api/webhooks/jira?secret=YOUR_WEBHOOK_SECRET`
- Events: Check **Issue → updated**
- Optional JQL filter: `project = YOUR_PROJECT` (limits to your project)

### Email (M365 SMTP)

For Microsoft 365 Outlook:
- Create a shared mailbox (e.g., `noreply-product@yourcompany.com`)
- Generate an App Password (or configure OAuth2 for production)
- Set `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`

For Gmail (quick testing):
- Enable 2FA and create an App Password
- Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`

## Project Structure

```
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Redirects to /intake-status
│   ├── intake-status/
│   │   ├── page.tsx                   # Server component shell
│   │   └── client.tsx                 # Full client-side UI
│   └── api/
│       ├── webhooks/
│       │   ├── freshservice/route.ts  # Freshservice webhook handler
│       │   └── jira/route.ts          # Jira webhook handler
│       ├── search/route.ts            # Search API
│       ├── subscribe/route.ts         # Email subscription
│       ├── ask-product/route.ts       # Not-found escalation
│       └── unsubscribe/route.ts       # Email unsubscribe
├── lib/
│   ├── freshservice.ts                # Freshservice API client
│   ├── jira.ts                        # Jira API client
│   ├── email.ts                       # SMTP email sender + templates
│   ├── enrich.ts                      # Combines FS + Jira into EnrichedRequest
│   ├── store.ts                       # Subscriptions (Vercel KV / in-memory)
│   └── webhook-auth.ts               # Webhook verification
├── config/
│   └── constants.ts                   # Status mappings, stage definitions
├── types/
│   └── index.ts                       # All TypeScript interfaces
├── scripts/
│   └── test-webhooks.ts              # Webhook testing script
├── .env.example                       # Environment template
└── vercel.json                        # Vercel config
```

## Customization

### Status Mappings

Edit `config/constants.ts` to map your Jira workflow statuses:

- `JIRA_STATUS_HUMAN` — Plain English descriptions for stakeholders
- `JIRA_STATUS_TO_STAGE` — Maps Jira statuses to pizza tracker stages
- `STATUS_EXPLANATIONS` — What each status means (shown in emails)

### Pizza Tracker Stages

Edit `TRACKER_STAGES` in `config/constants.ts` to change the visual stages.

### Email Templates

Edit `lib/email.ts` → `buildEmailHtml()` to customize the notification format.

## Production Checklist

- [ ] Replace in-memory store with Vercel KV or database (link a KV store in Vercel dashboard)
- [ ] Add OKTA/SSO authentication (NextAuth.js + OKTA provider)
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting on search endpoint
- [ ] Switch from SMTP App Password to OAuth2 for M365
- [ ] Add Freshservice requester field to Jira tickets for filtering
- [ ] Test webhook delivery with `npm run test:webhooks`
