
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TinyLink",
  description: "Create & manage short links with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="brand">
            <span className="logo">TinyLink</span>
            <p className="subtitle">Create & manage short links with ease.</p>
          </div>
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/healthz" target="_blank" rel="noreferrer">Health</Link>
          </nav>
        </header>
        {children}
        <footer className="app-footer">
          <small>© {new Date().getFullYear()} TinyLink. Built with Next.js + Postgres.</small>
        </footer>
      </body>
    </html>
  );
}
