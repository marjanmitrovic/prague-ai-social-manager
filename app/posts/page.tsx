import Link from "next/link";
import { Plus, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSql, hasDatabaseConfig, withDatabaseRetry } from "@/lib/db";
import { isSocialPlatform, platformLabel } from "@/lib/social/platforms";

export const dynamic = "force-dynamic";

function formatTime(value: any) {
  return value
    ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Prague" }).format(new Date(value))
    : "Bez termínu";
}

function targetLabel(platform: string) {
  return isSocialPlatform(platform) ? platformLabel(platform) : platform;
}

export default async function Posts() {
  let rows: any[] = [];
  let databaseError: string | null = null;
  if (hasDatabaseConfig()) {
    try {
      const sql = getSql();
      rows = await withDatabaseRetry(() => sql`
        SELECT
          p.id,
          p.title,
          p.status,
          p.media_type,
          p.media_urls,
          p.scheduled_at,
          c.name client_name,
          COALESCE(
            json_agg(
              json_build_object(
                'platform', pt.platform,
                'status', pt.status,
                'error', pt.error_message,
                'external_post_id', pt.external_post_id
              )
            ) FILTER (WHERE pt.id IS NOT NULL),
            '[]'
          ) targets
        FROM posts p
        JOIN clients c ON c.id = p.client_id
        LEFT JOIN post_targets pt ON pt.post_id = p.id
        GROUP BY p.id, c.name
        ORDER BY p.created_at DESC
      `);
    } catch (error) {
      console.error("Posts database error:", error);
      databaseError = "Databáze je dočasně nedostupná.";
    }
  }

  return (
    <AppShell
      title="Obsah"
      subtitle="Jeden příspěvek, samostatný stav pro každou sociální síť."
      action={<Link href="/posts/new" className="button primary"><Plus size={17} /> Nový příspěvek</Link>}
    >
      {databaseError && <div className="notice error" style={{ marginBottom: 18 }}>{databaseError}</div>}
      <div className="panel">
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Obsah</th><th>Termín</th><th>Sociální sítě</th><th>Celkový stav</th></tr></thead>
              <tbody>
                {rows.map(row => {
                  const first = Array.isArray(row.media_urls) ? row.media_urls[0] : null;
                  return (
                    <tr key={row.id}>
                      <td><div className="post-cell">{first?.url ? <img src={first.url} className="media-mini" alt="" /> : <span className="media-mini" />}<div><strong>{row.title}</strong><small>{row.client_name} · {row.media_type}</small></div></div></td>
                      <td>{formatTime(row.scheduled_at)}</td>
                      <td>
                        {(row.targets || []).map((target: any) => (
                          <span
                            key={target.platform}
                            className={`badge ${target.status}`}
                            style={{ marginRight: 6, marginBottom: 4 }}
                            title={target.error || undefined}
                          >
                            {targetLabel(String(target.platform))}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className={`badge ${row.status}`}>{row.status}</span>
                        {row.status === "failed" && (
                          <form action={`/api/posts/${row.id}/retry`} method="post" style={{ display: "inline", marginLeft: 8 }}>
                            <button className="button" title="Zkusit znovu"><RotateCcw size={14} /></button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">Žádný obsah. Vytvořte první příspěvek.</div>}
      </div>
    </AppShell>
  );
}
