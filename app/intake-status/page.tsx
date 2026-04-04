// app/intake-status/page.tsx
import { Suspense } from "react";
import SearchClient from "./search-client";

export default function IntakeStatusPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#5B2D8E] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-white text-lg font-bold tracking-tight">
            likewize.
          </span>
          <a href="/intake-status" className="text-white/80 hover:text-white text-sm transition-colors">
            New search
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-[#5B2D8E] to-[#F3EEFF] px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-white text-2xl font-bold mb-2">Product Request status</h1>
          <p className="text-white/80 text-sm leading-relaxed">
            See status, planned timing, and the latest updates for your product
            intake requests at one place.
          </p>
        </div>
      </div>

      {/* Search + Results */}
      <div className="max-w-3xl mx-auto px-6 -mt-4">
        <Suspense fallback={<SearchSkeleton />}>
          <SearchClient />
        </Suspense>
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-3" />
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse mb-4" />
      <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
