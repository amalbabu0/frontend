# zaki Commerce Frontend

Vanilla Vite multi-page ecommerce frontend. Pages are separated by role directories and share `src/main.js` plus `src/app.css`.

## Role Directories

```text
/user/                              User/customer dashboard
/user/cart/                         User cart and checkout
/user/orders/                       User order history

/owner/                             Product owner/shop owner dashboard
/owner/inventory/                   Product owner inventory
/owner/cache/                       Product owner cache view

/admin/                             Admin operations dashboard
/admin/orders/                      Admin order operations
/admin/cache/                       Admin cache operations

/development/                       Development monitoring overview
/development/soc/                   SOC monitoring
/development/system/                System monitoring
/development/web-analytics/         Web analytics
/development/speed-insights/        Speed insights
/development/observability/         Observability
/development/analytics/             Analytics
```


## Access Rules

```text
Public: /, /login/
Protected by Supabase session: /user/*, /owner/*, /admin/*, /development/*
```
## Env

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_PAYMENT_URL=https://rzp.io/rzp/optional-payment-link-fallback
```

For Vercel production, set `VITE_API_BASE_URL` to the deployed backend URL. Razorpay key ID and key secret belong in the backend Vercel project; `VITE_RAZORPAY_PAYMENT_URL` is only an optional fallback payment link.

## Supabase Tables

Run `supabase/user_carts.sql` in the Supabase SQL editor to persist carts across devices for the same signed-in user.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
