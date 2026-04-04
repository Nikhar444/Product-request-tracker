// app/intake-status/search-client.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { EnrichedRequest, TrackerStep } from "@/types";

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EnrichedRequest[]>([]);
  const [selected, setSelected] = useState<EnrichedRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check URL for ?req= param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const req = params.get("req");
    if (req) {
      setQuery(req);
      doSearch(req);
    }
  }, []);

  async function doSearch(q: string) {
    if (q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      const items = data.results || [];
      setResults(items);
      // Auto-select if exactly one result
      if (items.length === 1) setSelected(items[0]);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  return (
    <div>
      {/* Search box */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Request number or keywords
        </label>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
          placeholder="e.g. DPS-100999 or 'network mismatch'"
          className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#5B2D8E] focus:border-transparent"
        />
        <button
          onClick={() => doSearch(query)}
          disabled={loading || query.trim().length < 2}
          className="mt-3 h-10 px-6 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg
                     hover:bg-[#4A2574] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Searching…" : "View status"}
        </button>
      </div>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <NotFoundState query={query} />
      )}

      {/* Multiple results — pick one */}
      {!loading && results.length > 1 && !selected && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-sm text-gray-500">{results.length} results found</p>
          {results.map((r) => (
            <button
              key={r.jiraKey}
              onClick={() => setSelected(r)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 p-5
                         hover:border-[#5B2D8E]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-[#5B2D8E] bg-[#F3EEFF] px-2 py-0.5 rounded">
                    {r.jiraKey}
                  </span>
                  <h3 className="mt-1.5 text-sm font-medium text-gray-900 line-clamp-2">{r.summary}</h3>
                </div>
                <StatusPill status={r.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected result — full detail view */}
      {selected && <DetailView request={selected} onBack={() => setSelected(null)} />}
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────

function DetailView({ request: r, onBack }: { request: EnrichedRequest; onBack: () => void }) {
  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back button (if multiple results) */}
      <button onClick={onBack} className="text-sm text-[#5B2D8E] hover:underline">
        ← Back to results
      </button>

      {/* Section A: Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 leading-snug mb-3">
          {r.client && <span>{r.client} | </span>}
          {r.jiraKey} | {r.summary}
        </h2>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusPill status={r.status} />
          {r.issueType && (
            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              {r.issueType}
            </span>
          )}
          <span className="text-xs text-gray-400">
            Updated {new Date(r.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Information as of {new Date(r.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Reference from your confirmation: <strong className="text-gray-600">{r.jiraKey}</strong>
        </p>
      </div>

      {/* Section B: Product Manager */}
      {r.productManager && (
        <div className="bg-[#F3EEFF] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#5B2D8E] text-white text-sm font-semibold
                          flex items-center justify-center flex-shrink-0">
            {r.productManager.initials}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
              Product manager for this request
            </p>
            <p className="text-sm font-semibold text-gray-900">{r.productManager.name}</p>
          </div>
        </div>
      )}

      {/* Section C: Description */}
      {r.description && <DescriptionSection text={r.description} />}

      {/* Section D: Pizza Tracker */}
      {r.tracker.length > 0 && <PizzaTracker steps={r.tracker} />}

      {/* Section E: Email Subscription */}
      <SubscriptionBanner jiraKey={r.jiraKey} summary={r.summary} />

      {/* Section F: Recent Notes */}
      {r.recentNotes.length > 0 && <RecentNotes notes={r.recentNotes} />}

      {/* Section G: Jira Link */}
      {r.url && r.url !== "#" && (
        <div className="flex items-center gap-3 text-sm">
          <span className="w-6 h-6 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center">J</span>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[#5B2D8E] hover:underline font-medium">
            {r.jiraKey}
          </a>
          <StatusPill status={r.status} small />
        </div>
      )}
    </div>
  );
}

// ─── Pizza Tracker ────────────────────────────────────────

function PizzaTracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-5">
        How we get there
      </p>
      <div className="space-y-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4">
            {/* Timeline column */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                  ${step.status === "complete" ? "bg-[#1D9E75] text-white" : ""}
                  ${step.status === "current" ? "bg-white text-[#1D9E75] border-2 border-[#1D9E75] animate-pulse-ring" : ""}
                  ${step.status === "upcoming" ? "bg-gray-100 text-gray-400 border border-gray-200" : ""}
                `}
              >
                {step.status === "complete" ? "✓" : idx + 1}
              </div>
              {/* Line */}
              {idx < steps.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-[32px] my-1
                    ${step.status === "complete" ? "bg-[#1D9E75]" : "border-l-2 border-dashed border-gray-200"}
                  `}
                />
              )}
            </div>
            {/* Content */}
            <div className="pb-6 pt-1">
              <p className={`text-sm font-semibold ${step.status === "upcoming" ? "text-gray-400" : "text-gray-900"}`}>
                {step.label}
              </p>
              {step.subtitle && (
                <p className="text-xs text-gray-400 mt-0.5">{step.subtitle}</p>
              )}
              {step.date && step.status !== "upcoming" && (
                <p className="text-xs font-medium text-[#1D9E75] mt-1">
                  {new Date(step.date).toLocaleDateString("en-US", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 italic mt-2">
        Dates are planning targets and may change.
      </p>
    </div>
  );
}

// ─── Description ──────────────────────────────────────────

function DescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
        What this request covers
      </p>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {isLong && !expanded ? text.slice(0, 300) + "…" : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-[#5B2D8E] hover:underline mt-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ─── Subscription Banner ──────────────────────────────────

function SubscriptionBanner({ jiraKey, summary }: { jiraKey: string; summary: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"full_activity" | "status_milestones">("status_milestones");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubscribe() {
    if (!email) return;
    setSubmitting(true);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, jiraKey, type }),
      });
      setDone(true);
    } catch {}
    setSubmitting(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Collapsed banner */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="w-8 h-8 bg-[#F3EEFF] rounded-full flex items-center justify-center flex-shrink-0 text-[#5B2D8E] text-sm">
          🔔
        </span>
        <span className="text-sm text-gray-700 flex-1">
          Click to subscribe for email updates about this request
        </span>
        <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[200px]">
          {jiraKey} · {summary.slice(0, 50)}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded form */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 animate-fade-in">
          {done ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-[#1D9E75]">Subscribed!</p>
              <p className="text-xs text-gray-400 mt-1">You'll receive email updates for {jiraKey}.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mt-4 mb-1">
                <h3 className="text-sm font-semibold text-gray-900">Email updates</h3>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Choose what we include. We never change anything in Jira — read-only notifications only.
              </p>

              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">
                Your email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm mb-4
                           focus:outline-none focus:ring-2 focus:ring-[#5B2D8E] focus:border-transparent"
              />

              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-2">
                Update type
              </label>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <TypeCard
                  selected={type === "full_activity"}
                  onClick={() => setType("full_activity")}
                  title="Full activity summary"
                  desc="Smart summaries when status changes, new comments appear, or the description is updated."
                />
                <TypeCard
                  selected={type === "status_milestones"}
                  onClick={() => setType("status_milestones")}
                  title="Status milestones only"
                  desc="Email when the ticket moves among key milestones (In Progress, In Scope Review, Ready for Release, Closed)."
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSubscribe}
                  disabled={!email || submitting}
                  className="h-10 px-6 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg
                             hover:bg-[#4A2574] disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Subscribing…" : "Subscribe to updates"}
                </button>
                <p className="text-xs text-gray-400">
                  Unsubscribe anytime from the link in each email.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TypeCard({ selected, onClick, title, desc }: {
  selected: boolean; onClick: () => void; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border-2 transition-all ${
        selected
          ? "border-[#5B2D8E] bg-[#F3EEFF]/30"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-[#5B2D8E]" : "border-gray-300"
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-[#5B2D8E]" />}
        </div>
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── Recent Notes ─────────────────────────────────────────

function RecentNotes({ notes }: { notes: EnrichedRequest["recentNotes"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
        Recent notes
      </p>
      <p className="text-xs text-gray-400 mb-5">
        Each entry shows who commented and when, so you can follow the conversation.
      </p>
      <div className="space-y-5">
        {notes.map((note) => (
          <div key={note.id}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#F3EEFF] text-[#5B2D8E] text-xs font-semibold
                              flex items-center justify-center flex-shrink-0">
                {note.author.initials}
              </div>
              <span className="text-sm font-medium text-[#5B2D8E]">{note.author.name}</span>
              <span className="text-xs text-gray-400">
                {new Date(note.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })} · {new Date(note.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed pl-11 whitespace-pre-wrap">
              {note.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Not Found State ──────────────────────────────────────

function NotFoundState({ query }: { query: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!email) return;
    await fetch("/api/ask-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, requestNumber: query }),
    });
    setSent(true);
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-lg">
        <p className="text-sm text-amber-900 leading-relaxed">
          We could not find a request matching that number in this portal yet. Check the number
          on your confirmation email, watch for typos, or ask your contact. You can ask the
          product team to look into it using the form below.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Ask product to review
        </p>
        {sent ? (
          <p className="text-sm text-[#1D9E75] font-medium">
            Sent! The product team will look into this and get back to you.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              Leave your email and <strong>confirm the same request number</strong> you searched for so we can route it correctly.
            </p>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Request to confirm: <strong className="text-[#5B2D8E]">{query}</strong>
            </p>
            <label className="text-xs font-medium text-gray-600 block mb-1">Your email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm mb-3
                         focus:outline-none focus:ring-2 focus:ring-[#5B2D8E] focus:border-transparent"
            />
            <label className="text-xs font-medium text-gray-600 block mb-1">Confirm request number</label>
            <input
              type="text"
              value={query}
              readOnly
              className="w-full h-10 px-4 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 mb-4"
            />
            <button
              onClick={handleSend}
              disabled={!email}
              className="h-10 px-6 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg
                         hover:bg-[#4A2574] disabled:opacity-50 transition-colors"
            >
              Send to product
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────

function StatusPill({ status, small }: { status: string; small?: boolean }) {
  const colors: Record<string, string> = {
    "Done": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Closed": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Released": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
    "In Review": "bg-amber-50 text-amber-700 border-amber-200",
    "Ready for QA": "bg-blue-50 text-blue-700 border-blue-200",
    "UAT": "bg-blue-50 text-blue-700 border-blue-200",
  };
  const color = colors[status] || "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <span className={`inline-block border rounded-full font-medium ${color} ${
      small ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"
    }`}>
      {status}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-4 w-64 bg-gray-200 rounded mb-3" />
        <div className="h-3 w-48 bg-gray-100 rounded mb-2" />
        <div className="h-3 w-32 bg-gray-100 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-3 w-24 bg-gray-200 rounded mb-4" />
        <div className="flex gap-4 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-48 bg-gray-100 rounded" />
        </div>
        <div className="flex gap-4 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-56 bg-gray-100 rounded" />
        </div>
        <div className="flex gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-40 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}
