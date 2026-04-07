// app/intake-status/page.tsx
import { Suspense } from "react";
import SearchClient from "./search-client";

export default function IntakeStatusPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#4225b3] px-6 py-4">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <span className="text-[#f2a2e6] text-2xl font-bold tracking-tight">
            likewize.
          </span>
          <a href="/intake-status" className="text-white hover:text-white/90 text-sm transition-colors">
            New search
          </a>
        </div>
      </header>

      {/* Search + Results */}
      <div className="max-w-[800px] mx-auto px-6 pt-8">
        <Suspense fallback={<SearchSkeleton />}>
          <SearchClient />
        </Suspense>
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-8">
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="h-12 bg-gray-100 rounded-full animate-pulse mb-4" />
      <div className="h-12 w-40 bg-gray-200 rounded-full animate-pulse" />
    </div>
  );
}
