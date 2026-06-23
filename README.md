# Online Food Delivery System

A modern, role-based web application for managing food delivery operations between merchants and couriers, with an administrator overseeing the workflow. Built as an academic assignment.

## Project Description

This system coordinates delivery operations for a single restaurant. Merchants create delivery orders for predefined customer addresses; couriers accept one or more orders and receive an optimized delivery route based on a simulated travel-time map; administrators manage users and orders. There is no customer-facing interface — customers are represented as 8 predefined addresses.

## Features

- **Authentication** — Secure email/password login with role-based redirection.
- **Role-based access control** — Three roles (Administrator, Merchant, Courier) with protected routes.
- **Merchant order creation** — Pick from 8 predefined customer destinations, set a due time.
- **Courier order management** — Browse pending orders, accept multiple, mark completed.
- **Route optimization** — Nearest-neighbor algorithm over a predefined travel-time matrix.
- **Administrator management** — CRUD on users (merchants/couriers/admins), assign couriers to orders, edit/delete orders, dashboard metrics.
- **Modern responsive UI** — Sidebar navigation, dashboard cards, status badges, modal forms, confirmation dialogs.

## Technology Stack

- React 19 + TypeScript
- TanStack Start (full-stack React with SSR / server functions)
- TanStack Router (file-based, type-safe routing)
- TanStack Query (data fetching & cache)
- Tailwind CSS v4 (semantic tokens, dark-ready)
- shadcn/ui components
- Supabase (PostgreSQL + Auth) — provided via Lovable Cloud
- Vite 8 build tool

## Project Structure

```
src/
├── components/       # Reusable UI (AppShell, shadcn/ui primitives)
├── hooks/            # React hooks
├── integrations/
│   └── supabase/     # Auto-generated Supabase clients & types
├── lib/              # Utilities and server functions
│   ├── admin.functions.ts    # Admin server functions (createUser, assign, ...)
│   ├── seed.functions.ts     # Demo-account seeding
│   ├── routeOptimizer.ts     # Nearest-neighbor algorithm
│   └── useAuth.ts            # Client auth hook
├── routes/           # File-based routes
│   ├── _authenticated/       # Protected subtree (role-gated)
│   │   ├── admin.*           # Administrator pages
│   │   ├── merchant.*        # Merchant pages
│   │   └── courier.*         # Courier pages
│   ├── auth.tsx              # Login page
│   └── index.tsx             # Role-aware redirect
├── styles.css        # Design system (semantic tokens)
└── router.tsx        # Router bootstrap
```

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd <project>

# 2. Install dependencies
bun install        # or: npm install

# 3. Configure environment variables (see .env.example)
cp .env.example .env
# edit .env with your Supabase project credentials

# 4. Start the dev server
bun run dev        # or: npm run dev

# 5. Production build
bun run build      # or: npm run build

# 6. Preview production build
bun run preview    # or: npm run preview
```

## Database Setup

The database schema is provided as a SQL migration. On Lovable Cloud, migrations are applied automatically. For a standalone Supabase project, run the SQL in `supabase/migrations/` against your database:

- `app_role` enum (ADMIN / MERCHANT / COURIER)
- `order_status` enum (PENDING / ASSIGNED / COMPLETED)
- Tables: `profiles`, `user_roles`, `restaurant`, `customers`, `travel_times`, `orders`
- RLS policies + a `has_role()` security-definer function
- Trigger to auto-create a profile on user signup
- Seed data: 1 restaurant, 8 customers, full travel-time matrix

### Demo accounts

A one-click **Initialize demo accounts** button on the login page creates the three default users via the server-side admin API:

| Role          | Email                 | Password    |
|---------------|-----------------------|-------------|
| Administrator | admin@example.com     | admin123    |
| Merchant      | merchant@example.com  | merchant123 |
| Courier       | courier@example.com   | courier123  |

## Application Workflow

```
Merchant logs in
      ↓
Creates an order (destination + due time)
      ↓
Order status = PENDING
      ↓
Admin assigns a courier  OR  Courier accepts directly
      ↓
Courier dashboard runs route optimization
      ↓
Courier completes deliveries
      ↓
Order status = COMPLETED
```

## Route Optimization

The courier dashboard runs a **nearest-neighbor algorithm** over the predefined travel-time matrix stored in the `travel_times` table. Starting from the restaurant (code `R`), it repeatedly visits the closest un-visited customer until all accepted orders are scheduled. It displays the ordered sequence plus the total estimated travel time. The result is not mathematically optimal, but is sufficient for this assignment.

## Screens

- **Login** — email/password form with quick-fill demo credentials.
- **Merchant Dashboard** — stats (total / pending / completed), orders table, Create Order button.
- **Order Creation** — customer-select dropdown + datetime picker.
- **Courier Dashboard** — available pending orders, accepted orders, optimized route + total minutes.
- **Admin Dashboard** — aggregate metrics across users and orders.
- **Admin Orders** — full orders table with inline courier-assignment and delete.
- **Admin Users** — CRUD on merchant / courier / admin accounts with modal forms.

## Deployment

This project is built on Lovable Cloud and can be published directly from the Lovable interface. For a standalone deployment:

1. Configure Supabase environment variables in your hosting provider.
2. Run `bun run build`.
3. Deploy the `dist/` output (or use Cloudflare Workers via the included Nitro config).

## Assumptions

- Customer accounts are not implemented; customers are represented as 8 predefined addresses.
- A single restaurant is predefined.
- Travel times are simulated via a static `travel_times` table — no live map API.
- Orders carry only destination + due time; no menu items, prices, or payment data.
- Email confirmation is disabled for demo accounts to streamline first-run sign-in.

## Limitations

- No online payments.
- No customer-facing ordering interface.
- No live GPS tracking.
- No Google Maps integration.
- No push notifications.
- No food menu, shopping cart, or inventory management.

## Future Improvements

- Real map integration (Google Maps / Mapbox) with live geocoding.
- Real-time courier tracking via Supabase Realtime.
- Customer mobile application.
- Delivery notifications (email / push).
- Analytics dashboard with delivery KPIs.

## License

MIT — see `LICENSE`.
