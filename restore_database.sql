-- ============================================================
-- Swift Delivery Route — Full Database Restore Script
-- Run this in Supabase > SQL Editor
-- ============================================================

-- ── 1. ENUMS ─────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'MERCHANT', 'COURIER');
CREATE TYPE public.order_status AS ENUM ('PENDING', 'ASSIGNED', 'COMPLETED');

-- ── 2. TABLES ────────────────────────────────────────────────

-- Profiles (mirrors auth.users)
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Restaurant
CREATE TABLE public.restaurant (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  address TEXT NOT NULL
);
GRANT SELECT ON public.restaurant TO authenticated;
GRANT ALL ON public.restaurant TO service_role;
ALTER TABLE public.restaurant ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE TABLE public.customers (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  address TEXT NOT NULL,
  code    TEXT NOT NULL UNIQUE
);
GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Travel times (simulated map)
CREATE TABLE public.travel_times (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location  TEXT NOT NULL,
  to_location    TEXT NOT NULL,
  travel_minutes INTEGER NOT NULL,
  UNIQUE(from_location, to_location)
);
GRANT SELECT ON public.travel_times TO authenticated;
GRANT ALL ON public.travel_times TO service_role;
ALTER TABLE public.travel_times ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TABLE public.orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES public.customers(id),
  due_time            TIMESTAMPTZ NOT NULL,
  status              public.order_status NOT NULL DEFAULT 'PENDING',
  assigned_courier_id UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ── 3. FUNCTIONS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger: auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. REVOKE PUBLIC ACCESS ON SENSITIVE FUNCTIONS ───────────
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM PUBLIC, anon, authenticated;

-- ── 5. ROW LEVEL SECURITY POLICIES ──────────────────────────

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

-- restaurant
CREATE POLICY "restaurant_read_all" ON public.restaurant FOR SELECT TO authenticated USING (true);

-- customers
CREATE POLICY "customers_read_all" ON public.customers FOR SELECT TO authenticated USING (true);

-- travel_times
CREATE POLICY "travel_times_read_all" ON public.travel_times FOR SELECT TO authenticated USING (true);

-- orders
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
  OR public.has_role(auth.uid(), 'COURIER')
);
CREATE POLICY "orders_insert_merchant" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid());
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid() AND status = 'PENDING')
  OR public.has_role(auth.uid(), 'COURIER')
);
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid() AND status = 'PENDING')
);

-- ── 6. SEED DATA ─────────────────────────────────────────────

INSERT INTO public.restaurant (name, address)
VALUES ('Main Restaurant', '1 Central Plaza');

INSERT INTO public.customers (name, address, code) VALUES
  ('Customer 1', '10 Oak Street',      'C1'),
  ('Customer 2', '22 Maple Avenue',    'C2'),
  ('Customer 3', '5 Pine Road',        'C3'),
  ('Customer 4', '88 Birch Lane',      'C4'),
  ('Customer 5', '14 Elm Boulevard',   'C5'),
  ('Customer 6', '33 Cedar Court',     'C6'),
  ('Customer 7', '47 Walnut Drive',    'C7'),
  ('Customer 8', '92 Cherry Way',      'C8');

INSERT INTO public.travel_times (from_location, to_location, travel_minutes) VALUES
-- From restaurant
('R','C1',12),('R','C2',18),('R','C3',9), ('R','C4',22),('R','C5',15),('R','C6',20),('R','C7',11),('R','C8',25),
-- To restaurant
('C1','R',12),('C2','R',18),('C3','R',9), ('C4','R',22),('C5','R',15),('C6','R',20),('C7','R',11),('C8','R',25),
-- Between customers
('C1','C2',7), ('C1','C3',6), ('C1','C4',14),('C1','C5',10),('C1','C6',13),('C1','C7',8), ('C1','C8',19),
('C2','C1',7), ('C2','C3',11),('C2','C4',9), ('C2','C5',12),('C2','C6',8), ('C2','C7',14),('C2','C8',16),
('C3','C1',6), ('C3','C2',11),('C3','C4',17),('C3','C5',8), ('C3','C6',14),('C3','C7',7), ('C3','C8',20),
('C4','C1',14),('C4','C2',9), ('C4','C3',17),('C4','C5',13),('C4','C6',6), ('C4','C7',15),('C4','C8',10),
('C5','C1',10),('C5','C2',12),('C5','C3',8), ('C5','C4',13),('C5','C6',9), ('C5','C7',11),('C5','C8',14),
('C6','C1',13),('C6','C2',8), ('C6','C3',14),('C6','C4',6), ('C6','C5',9), ('C6','C7',12),('C6','C8',11),
('C7','C1',8), ('C7','C2',14),('C7','C3',7), ('C7','C4',15),('C7','C5',11),('C7','C6',12),('C7','C8',13),
('C8','C1',19),('C8','C2',16),('C8','C3',20),('C8','C4',10),('C8','C5',14),('C8','C6',11),('C8','C7',13);
