// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Request Status",
  description:
    "See status, planned timing, and the latest updates for your product intake requests.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fafaf8] text-[#1a1a18]">{children}</body>
    </html>
  );
}
