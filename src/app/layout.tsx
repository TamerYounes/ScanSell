import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockpile",
  description: "Sales & inventory tracker for your delivery team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
