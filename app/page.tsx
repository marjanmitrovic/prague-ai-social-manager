import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileEdit, Plus, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSql, hasDatabaseConfig, withDatabaseRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

function statusClass(status: string){return `badge ${status}`}
function formatPrague(value: string | Date | null){if(!value)return "Bez termínu";return new Intl.DateTimeFormat("cs-CZ",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Prague"}).format(new Date(value))}

export default async function Dashboard(){
  let posts:any[]=[];
  let counts={scheduled:0,published:0,draft:0,failed:0};
  let databaseError:string|null=null;

  if(hasDatabaseConfig()){
    try {
      const sql=getSql();
      const result=await withDatabaseRetry(async()=>{
        const latestPosts=await sql`SELECT p.id,p.title,p.status,p.scheduled_at,p.media_urls,c.name client_name FROM posts p JOIN clients c ON c.id=p.client_id ORDER BY p.created_at DESC LIMIT 8`;
        const statusRows=await sql`SELECT status,COUNT(*)::int count FROM posts GROUP BY status`;
        return {latestPosts,statusRows};
      });
      posts=result.latestPosts;
      for(const r of result.statusRows){
        if(r.status in counts){
          counts[r.status as keyof typeof counts]=Number(r.count);
        }
      }
    } catch(error) {
      console.error("Dashboard database error:",error);
      databaseError="Databáze je dočasně nedostupná. Zkuste stránku obnovit.";
    }
  }
  return <AppShell title="Přehled" subtitle="Vše důležité na jednom místě — bez zbytečných kroků.">
    {databaseError&&<div className="notice error" style={{marginBottom:18}}><AlertTriangle size={18}/><div><strong>Databáze není momentálně dostupná</strong><p>{databaseError}</p></div></div>}
    <div className="grid metrics">
      <div className="metric-card"><div className="metric-top"><span>Naplánováno</span><span className="metric-icon"><CalendarClock size={17}/></span></div><div className="metric-value">{counts.scheduled}</div><div className="metric-note">čeká na automatické publikování</div></div>
      <div className="metric-card"><div className="metric-top"><span>Publikováno</span><span className="metric-icon"><CheckCircle2 size={17}/></span></div><div className="metric-value">{counts.published}</div><div className="metric-note">úspěšně dokončené příspěvky</div></div>
      <div className="metric-card"><div className="metric-top"><span>Koncepty</span><span className="metric-icon"><FileEdit size={17}/></span></div><div className="metric-value">{counts.draft}</div><div className="metric-note">rozpracovaný obsah</div></div>
      <div className="metric-card"><div className="metric-top"><span>Vyžaduje pozornost</span><span className="metric-icon"><AlertTriangle size={17}/></span></div><div className="metric-value">{counts.failed}</div><div className="metric-note">chyby k opravě</div></div>
    </div>
    <div className="grid dashboard-grid">
      <div className="panel"><div className="panel-header"><div><h2>Poslední obsah</h2><p>Stav publikování napříč klienty</p></div><Link className="button" href="/posts">Zobrazit vše</Link></div>
      {posts.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Příspěvek</th><th>Termín</th><th>Stav</th></tr></thead><tbody>{posts.map(p=>{const media=Array.isArray(p.media_urls)?p.media_urls[0]:null;return <tr key={p.id}><td><div className="post-cell">{media?.url?<img className="media-mini" src={media.url} alt=""/>:<span className="media-mini"/>}<div><strong>{p.title}</strong><small>{p.client_name}</small></div></div></td><td>{formatPrague(p.scheduled_at)}</td><td><span className={statusClass(p.status)}>{p.status}</span></td></tr>})}</tbody></table></div>:<div className="empty">Zatím zde není žádný obsah.</div>}</div>
      <div className="panel"><div className="panel-header"><div><h2>Rychlý postup</h2><p>Celý proces v jednom toku</p></div></div><div className="activity-list">
        <div className="activity-item"><span className="status-dot"/><div><p>1. Nahrajte fotografii nebo video</p><small>Cloudinary se postará o veřejný odkaz.</small></div></div>
        <div className="activity-item"><span className="status-dot"/><div><p>2. Nechte AI připravit text</p><small>Text můžete před publikováním upravit.</small></div></div>
        <div className="activity-item"><span className="status-dot"/><div><p>3. Zvolte čas a publikujte</p><small>Scheduler vše odešle automaticky.</small></div></div>
        <Link href="/posts/new" className="button primary" style={{marginTop:14,width:"100%"}}><Plus size={17}/> Vytvořit příspěvek</Link>
      </div></div>
    </div>
  </AppShell>
}
