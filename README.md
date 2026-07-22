# Prague AI Social Manager

Univerzální AI workflow pro správu více klientů a více sociálních sítí z jednoho místa.

## Podporované sítě

- Instagram
- Facebook Pages
- LinkedIn
- X
- TikTok
- YouTube
- Threads
- Pinterest

## Hlavní workflow

1. Vyberte klienta a sociální sítě.
2. Nahrajte fotografii nebo video, případně vytvořte médium pomocí AI.
3. Napište brief a nechte AI připravit samostatnou verzi textu pro každou síť.
4. Zkontrolujte náhled a případně upravte jednotlivé varianty.
5. Nastavte datum a čas.
6. Klikněte **Naplánovat**. Každá síť dostane vlastní `post_target` a vlastní stav publikování.

Selhání jedné sítě nezastaví publikování na ostatních sítích.

## Stack

- Next.js 15
- Neon PostgreSQL
- Cloudinary
- OpenAI
- Platform-specific publishing adapters
- Scheduled publisher endpoint

## Povinná databázová migrace

Před prvním uložením příspěvku pro nové sítě spusťte v Neon SQL editoru:

```sql
-- obsah souboru migrations/002_multiplatform.sql
```

Migrace rozšíří `platform_name`, přidá stav `manual_action` a uložiště textu přizpůsobeného pro konkrétní síť.

## Připojení účtů

Instagram používá existující Meta OAuth přihlášení. Pro ostatní sítě lze v části **Sociální sítě** bezpečně vložit schválený user/page access token a identifikátor cílového účtu. Token je před uložením šifrován pomocí `APP_ENCRYPTION_KEY`.

Požadovaný identifikátor:

- Facebook: Page ID
- LinkedIn: `urn:li:person:...` nebo `urn:li:organization:...`
- X: user ID
- TikTok: open ID
- YouTube: channel ID
- Threads: Threads user ID
- Pinterest: board ID

Přístup k publikačním API může u jednotlivých poskytovatelů vyžadovat schválení aplikace nebo audit. Neověřené TikTok a YouTube projekty mohou mít omezenou viditelnost publikovaného obsahu.

## Environment

Zkopírujte `.env.example` do `.env.local` a nastavte minimálně:

```env
DATABASE_URL=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
OPENAI_API_KEY=
APP_URL=https://YOUR-DOMAIN
APP_ENCRYPTION_KEY=
CRON_SECRET=
PUBLISH_CRON_ENABLED=false
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/instagram/callback
```

Další OAuth proměnné jsou připravené v `.env.example`.

## Lokální spuštění

```bash
npm install --no-audit --no-fund
npm run dev
```

## Produkce

Deployujte na Vercel a nastavte stejné environment variables. Automatické publikování je bezpečnostně vypnuté, dokud výslovně nenastavíte:

```env
PUBLISH_CRON_ENABLED=true
```

Scheduler endpoint je `/api/cron/publish` a očekává hlavičku `Authorization: Bearer $CRON_SECRET`.
