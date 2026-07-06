# Prague AI Social Manager — redesigned

Jednoduchý produkční workflow pro gastro klienty:

1. Nahrajte fotografii nebo video.
2. Nechte AI připravit text.
3. Zvolte datum a čas.
4. Klikněte **Naplánovat a publikovat**.

## Stack
- Next.js 15
- Neon PostgreSQL
- Cloudinary
- Instagram API with Instagram Login
- Vercel Cron

## Environment
Zkopírujte `.env.example` do `.env.local` a nastavte minimálně:

```env
DATABASE_URL=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
OPENAI_API_KEY=
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/instagram/callback
META_GRAPH_API_VERSION=v24.0
APP_URL=https://YOUR-DOMAIN
APP_ENCRYPTION_KEY=
CRON_SECRET=
```

## Lokální spuštění
```bash
npm install --no-audit --no-fund
npm run dev
```

## Produkce
Deploy na Vercel. Nastavte stejné environment variables a stabilní `APP_URL`.
Cron je definován v `vercel.json` a kontroluje naplánované příspěvky každých 5 minut.
