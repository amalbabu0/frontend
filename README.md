# ScaleMart Commerce Frontend

Vanilla Vite multi-page ecommerce frontend. Pages are separated by role directories and share `src/main.js` plus `src/app.css`.

## Role Directories

```text
/user/index.html                    User/customer dashboard
/user/cart.html                     User cart and checkout
/user/orders.html                   User order history

/owner/index.html                   Product owner/shop owner dashboard
/owner/inventory.html               Product owner inventory
/owner/cache.html                   Product owner cache view

/admin/index.html                   Admin operations dashboard
/admin/orders.html                  Admin order operations
/admin/cache.html                   Admin cache operations

/development/index.html             Development monitoring overview
/development/soc.html               SOC monitoring
/development/system.html            System monitoring
/development/web-analytics.html     Web analytics
/development/speed-insights.html    Speed insights
/development/observability.html     Observability
/development/analytics.html         Analytics
```


## Access Rules

```text
Public: /index.html, /login.html
Protected by Supabase session: /user/*, /owner/*, /admin/*, /development/*
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