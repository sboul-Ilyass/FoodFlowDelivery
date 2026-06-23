## Client Setup Instructions

To run this application locally for testing:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Simply rename the `.env.example` file in the root directory of the project to `.env` (it already contains the valid Supabase database, server, and port credentials pre-configured for you).

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Log in using the default demo accounts**:
   * **Administrator**: `admin@example.com` / `admin123`
   * **Merchant**: `merchant@example.com` / `merchant123`
   * **Courier**: `courier@example.com` / `courier123`

   *(These accounts are automatically seeded into the database on first run if it is empty).*

---

## Web Architecture

### Technology Stack

- **React 19 + TypeScript** — Component model and static type checking.
- **TanStack Start** — Full-stack React framework with SSR and server-side RPC handlers.
- **TanStack Router** — Type-safe, file-based routing.
- **TanStack Query** — Asynchronous state management and caching.
- **Tailwind CSS v4** — Utility-first styling.
- **Supabase** — PostgreSQL database and Auth services.
- **Vite 8** — Development server and bundling tool.

### Project Structure

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

---

## Features

- **Authentication** — Secure email/password login with role-based redirection.
- **Role-based access control** — Three roles (Administrator, Merchant, Courier) with protected routes.
- **Merchant order creation** — Pick from 8 predefined customer destinations, set a due time.
- **Courier order management** — Browse pending orders, accept multiple, mark completed.
- **Route optimization** — Nearest-neighbor algorithm over a predefined travel-time matrix.
- **Administrator management** — CRUD on users (merchants/couriers/admins), assign couriers to orders, edit/delete orders, dashboard metrics.
- **Modern responsive UI** — Sidebar navigation, dashboard cards, status badges, modal forms, confirmation dialogs.

---

## Database Setup

The database schema is provided as a SQL migration. On Lovable Cloud, migrations are applied automatically. For a standalone Supabase project, run the SQL in `supabase/migrations/` against your database:

- `app_role` enum (ADMIN / MERCHANT / COURIER)
- `order_status` enum (PENDING / ASSIGNED / COMPLETED)
- Tables: `profiles`, `user_roles`, `restaurant`, `customers`, `travel_times`, `orders`
- RLS policies + a `has_role()` security-definer function
- Trigger to auto-create a profile on user signup
- Seed data: 1 restaurant, 8 customers, full travel-time matrix

### Demo accounts

The system automatically seeds the following three default users on first run if the database is empty:

| Role          | Email                 | Password    |
|---------------|-----------------------|-------------|
| Administrator | admin@example.com     | admin123    |
| Merchant      | merchant@example.com  | merchant123 |
| Courier       | courier@example.com   | courier123  |

---

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

---

## Route Optimization

The courier dashboard runs a **nearest-neighbor algorithm** over the predefined travel-time matrix stored in the `travel_times` table. Starting from the restaurant (code `R`), it repeatedly visits the closest un-visited customer until all accepted orders are scheduled. It displays the ordered sequence plus the total estimated travel time. The result is not mathematically optimal, but is sufficient for this assignment.

---

## Screens

- **Login** — email/password form with quick-fill demo credentials.
- **Merchant Dashboard** — stats (total / pending / completed), orders table, Create Order button.
- **Order Creation** — customer-select dropdown + datetime picker.
- **Courier Dashboard** — available pending orders, accepted orders, optimized route + total minutes.
- **Admin Dashboard** — aggregate metrics across users and orders.
- **Admin Orders** — full orders table with inline courier-assignment and delete.
- **Admin Users** — CRUD on merchant / courier / admin accounts with modal forms.
