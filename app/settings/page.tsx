import { KeyRound, Link2, Network, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSql, hasDatabaseConfig, withDatabaseRetry } from "@/lib/db";
import { PLATFORM_DEFINITIONS, SOCIAL_PLATFORMS, SocialPlatform } from "@/lib/social/platforms";

export const dynamic = "force-dynamic";

const identifierLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram user ID",
  facebook: "Facebook Page ID",
  linkedin: "LinkedIn author URN",
  x: "X user ID",
  tiktok: "TikTok open ID",
  youtube: "YouTube channel ID",
  threads: "Threads user ID",
  pinterest: "Pinterest board ID",
};

export default async function Settings() {
  let clients: any[] = [];
  let databaseError: string | null = null;

  if (hasDatabaseConfig()) {
    try {
      const sql = getSql();
      clients = await withDatabaseRetry(() => sql`
        SELECT
          c.id,
          c.name,
          COALESCE(
            json_agg(
              json_build_object(
                'platform', sa.platform,
                'account_name', sa.account_name,
                'external_account_id', sa.external_account_id,
                'connection_status', sa.connection_status,
                'token_expires_at', sa.token_expires_at
              )
            ) FILTER (WHERE sa.platform IS NOT NULL),
            '[]'::json
          ) accounts
        FROM clients c
        LEFT JOIN social_accounts sa ON sa.client_id = c.id
        GROUP BY c.id, c.name
        ORDER BY c.name
      `);
    } catch (error) {
      console.error("Settings database error:", error);
      databaseError = "Databáze je dočasně nedostupná.";
    }
  }

  return (
    <AppShell title="Sociální sítě" subtitle="Připojte všechny kanály klienta a spravujte je z jednoho místa.">
      {databaseError && <div className="notice error" style={{ marginBottom: 18 }}>{databaseError}</div>}

      <div className="grid" style={{ gap: 20 }}>
        {clients.map(client => {
          const accounts = new Map<string, any>((client.accounts || []).map((account: any) => [account.platform, account]));
          return (
            <div className="panel" key={client.id}>
              <div className="panel-header">
                <div>
                  <h2>{client.name}</h2>
                  <p>{accounts.size} z {SOCIAL_PLATFORMS.length} sítí je připojeno</p>
                </div>
                <span className="metric-icon"><Network size={17} /></span>
              </div>

              <div className="client-grid" style={{ padding: 18 }}>
                {SOCIAL_PLATFORMS.map(platform => {
                  const definition = PLATFORM_DEFINITIONS[platform];
                  const account = accounts.get(platform);
                  const connected = account?.connection_status === "connected";
                  return (
                    <div className="panel client-card" key={platform} style={{ boxShadow: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <span className="metric-icon" style={{ fontWeight: 900, fontSize: 11 }}>{definition.shortLabel}</span>
                        <span className={`badge ${connected ? "published" : "draft"}`}>{connected ? "Připojeno" : "Nepřipojeno"}</span>
                      </div>
                      <h3>{definition.label}</h3>
                      <p>{connected ? `${account.account_name} · ${account.external_account_id}` : "Připojte účet pro automatické publikování."}</p>

                      <div style={{ marginTop: 14 }}>
                        {platform === "instagram" ? (
                          connected
                            ? <span className="notice success" style={{ display: "block" }}>Instagram OAuth je aktivní.</span>
                            : <a className="button primary" href={`/api/auth/instagram/start?clientId=${client.id}`}><Link2 size={15} /> Připojit Instagram</a>
                        ) : (
                          <details>
                            <summary className="button" style={{ listStyle: "none" }}><KeyRound size={15} /> {connected ? "Aktualizovat token" : "Připojit API účet"}</summary>
                            <form action="/api/social-accounts/manual" method="post" style={{ display: "grid", gap: 9, marginTop: 12 }}>
                              <input type="hidden" name="client_id" value={client.id} />
                              <input type="hidden" name="platform" value={platform} />
                              <input name="account_name" defaultValue={account?.account_name || ""} placeholder="Název účtu" required />
                              <input name="external_account_id" defaultValue={account?.external_account_id || ""} placeholder={identifierLabels[platform]} required />
                              <input name="access_token" type="password" placeholder="User/Page access token" required minLength={10} />
                              <button className="button primary" type="submit"><ShieldCheck size={15} /> Bezpečně uložit</button>
                            </form>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!clients.length && !databaseError && <div className="panel empty">Nejdříve vytvořte klienta.</div>}

        <div className="panel form-card">
          <div className="section-heading">
            <div>
              <h2>Jak připojení funguje</h2>
              <p>Tokeny jsou před uložením šifrovány pomocí APP_ENCRYPTION_KEY.</p>
            </div>
          </div>
          <div className="activity-list" style={{ padding: 0 }}>
            <div className="activity-item"><span className="status-dot" /><div><p>Instagram</p><small>Používá stávající Meta OAuth přihlášení.</small></div></div>
            <div className="activity-item"><span className="status-dot" /><div><p>Ostatní sítě</p><small>Aktuálně lze bezpečně vložit schválený uživatelský nebo page token. Samostatné OAuth průvodce lze doplnit bez změny composeru.</small></div></div>
            <div className="activity-item"><span className="status-dot" /><div><p>Nezávislé publikování</p><small>Selhání jedné sítě nezastaví publikování na ostatních sítích.</small></div></div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
