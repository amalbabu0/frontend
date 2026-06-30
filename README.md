# ScaleMart Commerce Frontend

Vanilla Vite multi-page ecommerce frontend. Pages are separate HTML entries and share `src/main.js` plus `src/app.css`.

## Pages

```text
/index.html   Products home
/login.html   Login and signup
/cart.html    Cart and checkout actions
/orders.html  Order history and cancel action
/cache.html   Upstash cache controls
```

## Env

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For Vercel production, set `VITE_API_BASE_URL` to the deployed backend URL.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
