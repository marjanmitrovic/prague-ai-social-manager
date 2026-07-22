import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileEdit, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSql, hasDatabaseConfig, withDatabaseRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

function statusClass(status: string) { return `badge ${status}`; }
function formatPrague(value: string | Date | null) {
  if (!value) return "Bez termínu";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Prague" }).format(new Date(value));
}

export default async function Dashboard() {
  let posts: any[] = [];
  let counts = { scheduled: 0, published: 0, draft: 0, failed: 0, manual_action: 0 };
  let databaseError: string | null = null;

  if (hasDatabaseConfig()) {
    try {
      const sql = getSql();
      const result = await withDatabaseRetry(async () => {
        const latestPosts = await sql`
          SELECT p.id, p.title, p.status, p.scheduled_at, p.media_urls, c.name client_name
          FROM posts p
          JOIN clients c ON c.id = p.client_id
          ORDER BY p.created_at DESC
          LIMIT 8
        `;
        const statusRows = await sql`SELECT status, COUNT(*)::int count FROM posts GROUP BY status`;
        return { latestPosts, statusRows };
      });
      posts = result.latestPosts;
      for (const row of result.statusRows) {
        if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
      }
    } catch (error) {
      console.error("Dashboard database error:", error);
      databaseError = "Databáze je dočasně nedostupná. Zkuste stránku obnovit.";
    }
  }

  const attention = counts.failed + counts.manual_action;

  return (
    <AppShell title="Přehled" subtitle="Obsah a publikování napříč všemi sociálními sítěmi.">
      {databaseError && <div className="notice error" style={{ marginBottom: 18 }}><AlertTriangle size={18} /><div><strong>Databáze není momentálně dostupná</strong><p>{databaseError}</p></div></div>}
      <div className="grid metrics">
        <div className="metric-card"><div className="metric-top"><span>Naplánováno</span><span className="metric-icon"><CalendarClock size={17} /></span></div><div className="metric-value">{counts.scheduled}</div><div className="metric-note">cíle čekající na automatické publikování</div></div>
        <div className="metric-card"><div className="metric-top"><span>Publikováno</span><span className="metric-icon"><CheckCircle2 size={17} /></span></div><div className="metric-value">{counts.published}</div><div className="metric-note">dokončené příspěvky napříč sítěmi</div></div>
        <div className="metric-card"><div className="metric-top"><span>Koncepty</span><span className="metric-icon"><FileEdit size={17} /></span></div><div className="metric-value">{counts.draft}</div><div className="metric-note">rozpracovaný obsah</div></div>
        <div className="metric-card"><div className="metric-top"><span>Vyžaduje pozornost</span><span className="metric-icon"><AlertTriangle size={17} /></span></div><div className="metric-value">{attention}</div><div className="metric-note">chyby nebo nepřipojené cílové účty</div></div>
      </div>

      <div className="grid dashboard-grid">
        <div className="panel">
          <div className="panel-header"><div><h2>Poslední obsah</h2><p>Stav publikování napříč klienty</p></div><Link className="button" href="/posts">Zobrazit vše</Link></div>
          {posts.length ? (
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Příspěvek</th><th>Termín</th><th>Stav</th></tr></thead><tbody>
              {posts.map(post => {
                const media = Array.isArray(post.media_urls) ? post.media_urls[0] : null;
                return <tr key={post.id}><td><div className="post-cell">{media?.url ? <img className="media-mini" src={media.url} alt="" /> : <span className="media-mini" />}<div><strong>{post.title}</strong><small>{post.client_name}</small></div></div></td><td>{formatPrague(post.scheduled_at)}</td><td><span className={statusClass(post.status)}>{post.status}</span></td></tr>;
              })}
            </tbody></table></div>
          ) : <div className="empty">Zatím zde není žádný obsah.</div>}
        </div>

        <div className="panel">
          <div className="panel-header"><div><h2>Jeden společný tok</h2><p>Od briefu po všechny sociální sítě</p></div></div>
          <div className="activity-list">
            <div className="activity-item"><span className="status-dot" /><div><p>1. Vyberte klienta a sítě</p><small>Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Threads a Pinterest.</small></div></div>
            <div className="activity-item"><span className="status-dot" /><div><p>2. AI připraví varianty</p><small>Každá síť dostane text odpovídající svému formátu.</small></div></div>
            <div className="activity-item"><span className="status-dot" /><div><p>3. Naplánujte jedním kliknutím</p><small>Každý cíl se publikuje a sleduje nezávisle.</small></div></div>
            <Link href="/posts/new" className="button primary" style={{ marginTop: 14, width: "100%" }}><Plus size={17} /> Vytvořit příspěvek</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
