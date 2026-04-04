// app/intake-status/page.tsx
// The main stakeholder-facing page

import { Suspense } from "react";
import { IntakeStatusClient } from "./client";

export const metadata = {
  title: "Product Request status · Likewize",
};

export default function IntakeStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-400">
          Loading...
        </div>
      }
    >
      <IntakeStatusClient />
    </Suspense>
  );
}
