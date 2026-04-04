// app/intake-status/client.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { EnrichedRequest } from "@/types";

// ─── Main Client Component ───────────────────────────────

export function IntakeStatusClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("req") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) return;
    setLoading(true);
    setSearched(true);
    setSelectedRequest(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const r = data.results || [];
      setResults(r);
      // Auto-select if only one result
      if (r.length === 1) setSelectedRequest(r[0]);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Auto-search if URL has ?req= param
  useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, [initialQuery, search]);

  const handleSearch = () => {
    if (query.trim().length >= 2) {
      router.push(`/intake-status?req=${encodeURIComponent(query.trim())}`, {
        scroll: false,
      });
      search(query.trim());
    }
  };

  const handleNewSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelectedRequest(null);
    router.push("/intake-status", { scroll: false });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="bg-[#5B2D8E] px-6 py-4 flex items-center justify-between">
        <span className="text-white text-lg font-bold tracking-tight">
          likewize.
        </span>
        <button
          onClick={handleNewSearch}
          className="text-white/80 hover:text-white text-sm transition-colors"
        >
          New search
        </button>
      </header>

      {/* ── Hero ── */}
      <div className="bg-gradient-to-b from-[#5B2D8E] to-[#F3EEFF] px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white text-2xl font-bold mb-2">
            Product Request status
          </h1>
          <p className="text-white/80 text-sm leading-relaxed">
            See status, planned timing, and the latest updates for your product
            intake requests at one place.
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="max-w-2xl mx-auto px-6 -mt-1">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Request number or keywords
          </label>
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. REQ-11918885 or 'network mismatch'"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2D8E]/30 focus:border-[#5B2D8E] transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={loading || query.trim().length < 2}
              className="px-6 py-2.5 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg hover:bg-[#4A2574] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Searching..." : "View status"}
            </button>
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="mt-6 space-y-4 animate-pulse">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-6" />
              <div className="flex gap-2">
                <div className="h-6 bg-gray-100 rounded-full w-24" />
                <div className="h-6 bg-gray-100 rounded-full w-32" />
              </div>
            </div>
          </div>
        )}

        {/* ── Results list (if multiple) ── */}
        {!loading && searched && results.length > 1 && !selectedRequest && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-gray-500">
              {results.length} results found
            </p>
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRequest(r)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-[#5B2D8E]/30 hover:shadow-md transition-all"
              >
                <p className="font-semibold text-sm text-gray-900 mb-1">
                  {r.client && r.country
                    ? `${r.client} | ${r.country} | `
                    : ""}
                  #REQ-{r.id} | {r.subject}
                </p>
                <div className="flex gap-2 mt-2">
                  <StatusPill status={r.status} />
                  {r.category && (
                    <span className="px-3 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      {r.category}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Selected Request Detail ── */}
        {!loading && selectedRequest && (
          <RequestDetail
            request={selectedRequest}
            onBack={
              results.length > 1
                ? () => setSelectedRequest(null)
                : undefined
            }
          />
        )}

        {/* ── Not Found State ── */}
        {!loading && searched && results.length === 0 && (
          <NotFoundState query={query} />
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="text-center py-12 text-xs text-gray-400">
        Product Request Tracker
      </footer>
    </div>
  );
}

// ─── Request Detail View ──────────────────────────────────

function RequestDetail({
  request: r,
  onBack,
}: {
  request: EnrichedRequest;
  onBack?: () => void;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [subType, setSubType] = useState<"full_activity" | "status_milestones">("status_milestones");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubscribe = async () => {
    if (!subEmail) return;
    setSubStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: subEmail,
          requestId: r.id,
          jiraKey: r.jira?.key,
          type: subType,
        }),
      });
      if (res.ok) setSubStatus("success");
      else setSubStatus("error");
    } catch {
      setSubStatus("error");
    }
  };

  return (
    <div className="mt-6 space-y-4 animate-fade-in">
      {onBack && (
        <button
          onClick={onBack}
          className="text-sm text-[#5B2D8E] hover:underline mb-2"
        >
          ← Back to results
        </button>
      )}

      {/* Section A: Request Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-bold text-[15px] text-gray-900 leading-snug mb-3">
          {r.client && r.country ? `${r.client} | ${r.country} | ` : ""}
          #REQ-{r.id} | {r.subject}
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusPill status={r.status} />
          {r.category && (
            <span className="px-3 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {r.category}
            </span>
          )}
          <span className="text-xs text-gray-400 self-center">
            Updated{" "}
            {new Date(r.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Information as of{" "}
          {new Date(r.updatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Reference from your confirmation:{" "}
          <span className="font-semibold">#REQ-{r.id}</span>
        </p>
      </div>

      {/* Section B: Product Manager */}
      {r.productManager && (
        <div className="bg-[#F3EEFF] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#5B2D8E] text-white flex items-center justify-center text-sm font-semibold shrink-0">
            {r.productManager.initials}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5">
              Product manager for this request
            </p>
            <p className="text-[15px] font-bold text-gray-900">
              {r.productManager.name}
            </p>
          </div>
        </div>
      )}

      {/* Section C: Description */}
      {r.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What this request covers
          </p>
          <p
            className={`text-sm text-gray-700 leading-relaxed ${
              !descExpanded ? "line-clamp-3" : ""
            }`}
          >
            {r.description}
          </p>
          {r.description.length > 200 && (
            <button
              onClick={() => setDescExpanded(!descExpanded)}
              className="text-xs text-[#5B2D8E] mt-2 hover:underline"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Section D: Pizza Tracker */}
      {r.tracker.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-5">
            How we get there
          </p>
          <div className="relative pl-10">
            {r.tracker.map((step, idx) => (
              <div key={step.id} className="relative pb-8 last:pb-0">
                {/* Connecting line */}
                {idx < r.tracker.length - 1 && (
                  <div
                    className={`absolute left-[-24px] top-[32px] w-0.5 h-[calc(100%-16px)] ${
                      step.status === "complete"
                        ? "bg-stage-complete"
                        : "border-l-2 border-dashed border-gray-300"
                    }`}
                  />
                )}

                {/* Step circle */}
                <div
                  className={`absolute left-[-32px] top-[2px] w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                    step.status === "complete"
                      ? "bg-stage-complete border-stage-complete text-white"
                      : step.status === "current"
                        ? "bg-white border-stage-complete text-stage-complete animate-pulse-ring"
                        : "bg-gray-100 border-gray-300 text-gray-400"
                  }`}
                >
                  {step.status === "complete" ? "✓" : idx + 1}
                </div>

                {/* Step content */}
                <div className="ml-2">
                  <p
                    className={`text-sm font-semibold ${
                      step.status === "upcoming"
                        ? "text-gray-400"
                        : "text-gray-900"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.subtitle && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {step.subtitle}
                    </p>
                  )}
                  {step.date && step.status !== "upcoming" && (
                    <p className="text-xs font-medium text-stage-complete mt-1">
                      {new Date(step.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {step.dateRange && (
                    <p className="text-xs font-medium text-stage-complete mt-1">
                      {new Date(step.dateRange.start).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "long", year: "numeric" }
                      )}{" "}
                      →{" "}
                      {new Date(step.dateRange.end).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "long", year: "numeric" }
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 italic mt-4">
            Dates are planning targets and may change.
          </p>
        </div>
      )}

      {/* Section E: Email Subscription */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setSubOpen(!subOpen)}
          className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-lg">🔔</span>
          <span className="text-sm text-gray-700 flex-1">
            Click to subscribe for email updates about this request
          </span>
          {r.jira && (
            <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[200px]">
              {r.jira.key} · {r.subject.slice(0, 40)}...
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${subOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {subOpen && (
          <div className="px-6 pb-6 border-t border-gray-100 animate-fade-in">
            {subStatus === "success" ? (
              <div className="py-6 text-center">
                <p className="text-stage-complete font-semibold">Subscribed!</p>
                <p className="text-sm text-gray-500 mt-1">
                  You'll receive updates at {subEmail}
                </p>
              </div>
            ) : (
              <>
                <div className="pt-5 mb-4">
                  <h3 className="font-semibold text-base text-gray-900">
                    Email updates
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose what we include. We never change anything in
                    Jira—read-only notifications only.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-2">
                    Your email
                  </label>
                  <input
                    type="email"
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2D8E]/30 focus:border-[#5B2D8E]"
                  />
                </div>

                <div className="mb-5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-2">
                    Update type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <SubTypeCard
                      selected={subType === "full_activity"}
                      onClick={() => setSubType("full_activity")}
                      title="Full activity summary"
                      description="Smart summaries when status changes, new comments appear, or the description is updated."
                    />
                    <SubTypeCard
                      selected={subType === "status_milestones"}
                      onClick={() => setSubType("status_milestones")}
                      title="Status milestones only"
                      description="Email when the ticket moves among key milestones (In Progress, In Scope Review, Ready for Release, Closed)."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSubscribe}
                    disabled={!subEmail || subStatus === "loading"}
                    className="px-6 py-2.5 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg hover:bg-[#4A2574] disabled:opacity-50 transition-colors"
                  >
                    {subStatus === "loading"
                      ? "Subscribing..."
                      : "Subscribe to updates"}
                  </button>
                  <span className="text-xs text-gray-400">
                    Unsubscribe anytime from the link in each email.
                  </span>
                </div>

                {subStatus === "error" && (
                  <p className="text-sm text-red-500 mt-3">
                    Something went wrong. Please try again.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Section F: Recent Notes */}
      {r.recentNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Recent notes
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Each entry shows who commented and when, so you can follow the
            conversation.
          </p>
          <div className="space-y-5">
            {r.recentNotes.map((note) => (
              <div key={note.id}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#F3EEFF] text-[#5B2D8E] flex items-center justify-center text-xs font-semibold">
                    {note.author.initials}
                  </div>
                  <span className="text-sm font-semibold text-[#5B2D8E]">
                    {note.author.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(note.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed ml-11">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section G: Jira Link */}
      {r.jira && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
            J
          </div>
          <a
            href={r.jira.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#5B2D8E] hover:underline"
          >
            {r.jira.key}
          </a>
          <span className="px-2.5 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {r.jira.status}
          </span>
          {r.jira.assignee && (
            <span className="text-xs text-gray-400 ml-auto">
              Assigned to {r.jira.assignee}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subscription Type Card ───────────────────────────────

function SubTypeCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
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
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            selected ? "border-[#5B2D8E]" : "border-gray-300"
          }`}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-[#5B2D8E]" />
          )}
        </div>
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </button>
  );
}

// ─── Not Found State ──────────────────────────────────────

function NotFoundState({ query }: { query: string }) {
  const [email, setEmail] = useState("");
  const [confirmNum, setConfirmNum] = useState(`REQ-${query.replace(/\D/g, "")}`);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    try {
      await fetch("/api/ask-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          requestNumber: confirmNum,
        }),
      });
      setSent(true);
    } catch {
      // Still show success — we don't want to expose internal errors
      setSent(true);
    }
    setSending(false);
  };

  return (
    <div className="mt-6 space-y-4 animate-slide-up">
      {/* Warning box */}
      <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-5">
        <p className="text-sm text-amber-900 leading-relaxed">
          We could not find a request matching that number in this portal yet.
          Check the number on your confirmation email, watch for typos, or ask
          your contact. You can ask the product team to look into it using the
          form below.
        </p>
      </div>

      {/* Ask product form */}
      {sent ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-stage-complete font-semibold">Sent!</p>
          <p className="text-sm text-gray-500 mt-1">
            The product team will look into this and get back to you.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Ask product to review
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Leave your email and{" "}
            <span className="font-semibold">
              confirm the same request number
            </span>{" "}
            you searched for so we can route it correctly.
          </p>

          <p className="text-sm text-gray-900 font-medium mb-4">
            Request to confirm:{" "}
            <span className="text-[#5B2D8E]">{confirmNum}</span>
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Your email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2D8E]/30 focus:border-[#5B2D8E]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Confirm request number
              </label>
              <input
                type="text"
                value={confirmNum}
                onChange={(e) => setConfirmNum(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2D8E]/30 focus:border-[#5B2D8E]"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!email || sending}
              className="px-6 py-2.5 bg-[#5B2D8E] text-white text-sm font-medium rounded-lg hover:bg-[#4A2574] disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send to product"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status Pill Component ────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "bg-blue-50 text-blue-700 border-blue-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Resolved: "bg-green-50 text-green-700 border-green-200",
    Closed: "bg-gray-100 text-gray-600 border-gray-200",
    Scheduled: "bg-green-50 text-green-700 border-green-200",
  };
  const cls = colors[status] || "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <span
      className={`px-3 py-0.5 text-xs font-medium rounded-full border ${cls}`}
    >
      {status}
    </span>
  );
}
