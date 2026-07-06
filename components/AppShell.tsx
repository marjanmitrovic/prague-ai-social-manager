"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, Instagram, LayoutDashboard, Plus, Settings, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Přehled", icon: LayoutDashboard },
  { href: "/posts", label: "Obsah", icon: CalendarClock },
  { href: "/clients", label: "Klienti", icon: Building2 },
  { href: "/settings", label: "Nastavení", icon: Settings },
];

export function AppShell({ children, title, subtitle, action }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span><strong>Prague AI</strong><small>Social Manager</small></span>
        </Link>
        <nav className="nav-list">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`}><Icon size={18} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-status">
          <span className="status-dot" />
          <div><strong>Automatizace aktivní</strong><small>Neon · Cloudinary · Meta</small></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">Prague AI Growth Agency</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
          <div className="topbar-actions">{action ?? <Link className="button primary" href="/posts/new"><Plus size={17}/> Nový příspěvek</Link>}</div>
        </header>
        <section className="page-content">{children}</section>
      </main>
    </div>
  );
}

export function PlatformIcon({ platform }: { platform: string }) {
  return platform === "instagram" ? <Instagram size={16}/> : <BarChart3 size={16}/>;
}
