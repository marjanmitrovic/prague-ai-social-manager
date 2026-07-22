"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  LoaderCircle,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  Video as VideoIcon,
  WandSparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  PLATFORM_DEFINITIONS,
  SOCIAL_PLATFORMS,
  SocialPlatform,
} from "@/lib/social/platforms";

type Client = { id: string; name: string; requires_approval: boolean };
type Asset = {
  url: string;
  localUrl?: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  uploadStatus: "uploading" | "uploaded" | "error";
  errorMessage?: string;
  originalFilename?: string;
  bytes?: number;
};

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "linkedin", "x", "tiktok", "threads", "pinterest"];

export default function NewPost() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [caption, setCaption] = useState("");
  const [platformCaptions, setPlatformCaptions] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("18:00");
  const [media, setMedia] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiMediaLoading, setAiMediaLoading] = useState<"image" | "video" | null>(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(DEFAULT_PLATFORMS);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("instagram");

  useEffect(() => {
    fetch("/api/clients", { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        setClients(j.data || []);
        if (j.data?.[0]) setClientId(j.data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!platforms.includes(activePlatform) && platforms[0]) setActivePlatform(platforms[0]);
  }, [platforms, activePlatform]);

  const first = media[0];
  const mediaType = useMemo(
    () => (media.length > 1 ? "carousel" : first?.resourceType === "video" ? "reel" : "photo"),
    [media, first]
  );
  const activeCaption = platformCaptions[activePlatform] || caption;

  function togglePlatform(platform: SocialPlatform, checked: boolean) {
    setPlatforms(current => checked
      ? [...new Set([...current, platform])]
      : current.filter(item => item !== platform));
    if (checked) setActivePlatform(platform);
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloud || !preset) {
      setMessage("Cloudinary není nastavené.");
      return;
    }

    const pending = files.map((file, i) => ({
      url: "",
      localUrl: URL.createObjectURL(file),
      publicId: `local-${Date.now()}-${i}`,
      resourceType: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
      uploadStatus: "uploading" as const,
      originalFilename: file.name,
      bytes: file.size,
      file,
    }));
    setMedia(current => [...current, ...pending]);

    for (const pendingAsset of pending) {
      try {
        const form = new FormData();
        form.append("file", pendingAsset.file);
        form.append("upload_preset", preset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Upload selhal");
        setMedia(current => current.map(item => item.publicId === pendingAsset.publicId ? {
          ...item,
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          uploadStatus: "uploaded",
          errorMessage: undefined,
        } : item));
      } catch (error) {
        setMedia(current => current.map(item => item.publicId === pendingAsset.publicId ? {
          ...item,
          uploadStatus: "error",
          errorMessage: error instanceof Error ? error.message : "Upload selhal",
        } : item));
      }
    }
  }

  async function generate() {
    if (!brief.trim()) {
      setMessage("Nejdříve napište krátký brief.");
      return;
    }
    if (!platforms.length) {
      setMessage("Vyberte alespoň jednu sociální síť.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, language: "cs", tone: "friendly gastro", platforms }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCaption(result.caption || "");
      setPlatformCaptions(result.variants || {});
      if (result.warning) setMessage(result.warning);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI chyba");
    } finally {
      setLoading(false);
    }
  }

  async function generateMedia(kind: "image" | "video") {
    if (!brief.trim()) {
      setMessage("Nejdříve napište krátký brief.");
      return;
    }
    setAiMediaLoading(kind);
    setAiProgress(0);
    setMessage(kind === "video" ? "AI video se připravuje. Tato stránka musí zůstat otevřená." : "AI obrázek se generuje…");

    try {
      const start = await fetch("/api/ai/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, kind, language: "cs" }),
      });
      const started = await start.json();
      if (!start.ok) throw new Error(started.error || "AI generation failed");

      if (kind === "image") {
        setMedia(current => [...current.filter(item => item.resourceType !== "image" || current.length > 1), started.asset]);
        setMessage("AI obrázek byl vytvořen a uložen na Cloudinary.");
        return;
      }

      const jobId = started.jobId;
      if (!jobId) throw new Error("OpenAI nevrátil video job ID");
      for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(10000);
        const statusResponse = await fetch(`/api/ai/media?id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const status = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(status.error || "Kontrola videa selhala");
        setAiProgress(Number(status.progress || 0));
        setMessage(`AI video se generuje… ${Math.round(Number(status.progress || 0))}%`);
        if (status.status === "completed" && status.asset) {
          setMedia([status.asset]);
          setMessage("AI video bylo vytvořeno, uloženo na Cloudinary a je připravené k naplánování.");
          return;
        }
      }
      throw new Error("Generování videa trvá příliš dlouho. Zkuste to znovu později.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI generation failed");
    } finally {
      setAiMediaLoading(null);
    }
  }

  async function save(status: "draft" | "scheduled") {
    setMessage("");
    if (!clientId || !title.trim() || !caption.trim()) {
      setMessage("Vyberte klienta a vyplňte název i text.");
      return;
    }
    if (!platforms.length) {
      setMessage("Vyberte alespoň jednu sociální síť.");
      return;
    }
    if (!media.length || media.some(item => item.uploadStatus !== "uploaded")) {
      setMessage("Počkejte na dokončení uploadu médií.");
      return;
    }
    if (platforms.includes("youtube") && !media.some(item => item.resourceType === "video")) {
      setMessage("Pro YouTube nahrajte nebo vytvořte video.");
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    setSaving(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          title,
          brief,
          caption,
          platform_captions: platformCaptions,
          media_type: mediaType,
          media_urls: media.map(({ url, publicId, resourceType, originalFilename, bytes }) => ({
            url,
            publicId,
            resourceType,
            originalFilename,
            bytes,
          })),
          scheduled_at: scheduledAt,
          status,
          platforms,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Uložení selhalo");
      setMessage(status === "draft" ? "Koncept byl uložen." : "Příspěvek byl naplánován pro vybrané sítě.");
      if (status === "scheduled") setTimeout(() => (location.href = "/posts"), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Nový příspěvek" subtitle="Jeden obsah, automaticky přizpůsobený pro všechny vybrané sociální sítě.">
      <div className="form-shell">
        <div className="panel form-card">
          <div className="section-heading">
            <div>
              <h2>Univerzální composer</h2>
              <p>Vytvořte obsah jednou, upravte varianty a odešlete je do společného scheduleru.</p>
            </div>
            <span className="badge scheduled">{mediaType}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Klient</label>
              <select value={clientId} onChange={event => setClientId(event.target.value)}>
                <option value="">Vyberte klienta</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Interní název</label>
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Např. letní menu – červenec" />
            </div>

            <div className="field full">
              <label>Sociální sítě</label>
              <div className="platforms">
                {SOCIAL_PLATFORMS.map(platform => {
                  const definition = PLATFORM_DEFINITIONS[platform];
                  return (
                    <label className="platform-pill" key={platform}>
                      <input
                        type="checkbox"
                        checked={platforms.includes(platform)}
                        onChange={event => togglePlatform(platform, event.target.checked)}
                      />
                      <span title={`${definition.label} · limit ${definition.maxCaptionLength} znaků`}>
                        <strong>{definition.shortLabel}</strong> {definition.label}
                      </span>
                    </label>
                  );
                })}
              </div>
              <small>Pro YouTube je nutné video. Každá síť dostane vlastní text a samostatný stav publikování.</small>
            </div>

            <div className="field full">
              <label>Brief pro AI</label>
              <textarea
                value={brief}
                onChange={event => setBrief(event.target.value)}
                placeholder="Popište nabídku, produkt, cílovou skupinu, důležitá fakta a požadovaný styl…"
              />
              <div className="platforms">
                <button type="button" className="button" onClick={generate} disabled={loading || !!aiMediaLoading}>
                  {loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} AI texty pro všechny sítě
                </button>
                <button type="button" className="button" onClick={() => generateMedia("image")} disabled={loading || !!aiMediaLoading}>
                  {aiMediaLoading === "image" ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />} AI obrázek
                </button>
                <button type="button" className="button primary" onClick={() => generateMedia("video")} disabled={loading || !!aiMediaLoading}>
                  {aiMediaLoading === "video" ? <LoaderCircle className="spin" size={16} /> : <VideoIcon size={16} />} AI video
                </button>
              </div>
              {aiMediaLoading === "video" && <small>Průběh: {Math.round(aiProgress)} % · generování může trvat několik minut.</small>}
            </div>

            <div className="field full">
              <label>Média</label>
              <button type="button" className="upload-zone" onClick={() => inputRef.current?.click()}>
                <UploadCloud size={25} />
                <span>
                  <strong>Nahrát fotografie nebo video</strong>
                  <small>JPG, PNG, WEBP, MP4 · stejné médium lze použít pro více sítí</small>
                </span>
              </button>
              <input ref={inputRef} type="file" hidden multiple accept="image/*,video/*" onChange={upload} />
              {media.length > 0 && (
                <div className="media-list">
                  {media.map(asset => (
                    <div className="media-row" key={asset.publicId}>
                      {asset.resourceType === "video"
                        ? <video src={asset.localUrl || asset.url} />
                        : <img src={asset.localUrl || asset.url} alt="" />}
                      <div>
                        <strong>{asset.originalFilename || asset.publicId}</strong>
                        <small>{asset.uploadStatus}{asset.errorMessage ? ` · ${asset.errorMessage}` : ""}</small>
                      </div>
                      <button className="button danger" type="button" onClick={() => setMedia(current => current.filter(item => item.publicId !== asset.publicId))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="field full">
              <label>Základní text</label>
              <textarea
                value={caption}
                onChange={event => setCaption(event.target.value)}
                placeholder="Společné sdělení použité také jako záloha pro všechny sítě"
              />
            </div>

            {platforms.length > 0 && (
              <div className="field full">
                <label>Text pro konkrétní síť</label>
                <div className="platforms" style={{ marginBottom: 8 }}>
                  {platforms.map(platform => (
                    <button
                      type="button"
                      key={platform}
                      className={`button ${activePlatform === platform ? "primary" : ""}`}
                      onClick={() => setActivePlatform(platform)}
                    >
                      {PLATFORM_DEFINITIONS[platform].label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={activeCaption}
                  maxLength={PLATFORM_DEFINITIONS[activePlatform].maxCaptionLength}
                  onChange={event => setPlatformCaptions(current => ({ ...current, [activePlatform]: event.target.value }))}
                />
                <small>
                  {activeCaption.length} / {PLATFORM_DEFINITIONS[activePlatform].maxCaptionLength} znaků · prázdná varianta použije základní text
                </small>
              </div>
            )}

            <div className="field">
              <label>Datum</label>
              <input type="date" value={date} onChange={event => setDate(event.target.value)} />
            </div>
            <div className="field">
              <label>Čas (Praha)</label>
              <input type="time" value={time} onChange={event => setTime(event.target.value)} />
            </div>

            {message && (
              <div className={`field full notice ${message.includes("byl") || message.includes("připraven") || message.includes("naplánován") ? "success" : "error"}`}>
                {message}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="button" type="button" disabled={saving || !!aiMediaLoading} onClick={() => save("draft")}>
              <Save size={16} /> Uložit koncept
            </button>
            <button className="button primary" type="button" disabled={saving || !!aiMediaLoading} onClick={() => save("scheduled")}>
              <ImagePlus size={16} /> Naplánovat pro {platforms.length} sítí
            </button>
          </div>
        </div>

        <div className="panel preview-card">
          <div className="section-heading">
            <div>
              <h2>Náhled</h2>
              <p>{PLATFORM_DEFINITIONS[activePlatform].label} · orientační vzhled obsahu</p>
            </div>
          </div>
          <div className="platforms" style={{ justifyContent: "center", marginBottom: 14 }}>
            {platforms.map(platform => (
              <button
                type="button"
                key={platform}
                className={`button ${activePlatform === platform ? "primary" : ""}`}
                onClick={() => setActivePlatform(platform)}
                style={{ padding: "7px 9px" }}
              >
                {PLATFORM_DEFINITIONS[platform].shortLabel}
              </button>
            ))}
          </div>
          <div className="phone">
            <div className="phone-head">{PLATFORM_DEFINITIONS[activePlatform].label}</div>
            <div className="phone-media">
              {first
                ? first.resourceType === "video"
                  ? <video src={first.localUrl || first.url} controls />
                  : <img src={first.localUrl || first.url} alt="" />
                : <ImagePlus size={42} />}
            </div>
            <div className="phone-body">
              <div className="phone-user">
                <span className="avatar">AI</span>
                <strong>{clients.find(client => client.id === clientId)?.name || "Váš klient"}</strong>
              </div>
              <div className="phone-caption">{activeCaption || "Text příspěvku se zobrazí zde."}</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
