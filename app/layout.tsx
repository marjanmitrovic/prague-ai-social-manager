import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prague AI Social Manager",
  description: "AI assisted social media workflow for gastro clients"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
