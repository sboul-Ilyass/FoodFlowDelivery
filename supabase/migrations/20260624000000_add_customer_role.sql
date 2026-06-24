-- ============================================================
-- Add CUSTOMER role, products table, and extend orders
-- ============================================================

-- 1. Extend the role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'CUSTOMER';

-- 2. Add address field to profiles (customers store their delivery address here)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- ============================================================
-- 3. Products — merchants create products that customers order
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT           NOT NULL,
  description TEXT,
  price       NUMERIC(10,2)  NOT NULL CHECK (price >= 0),
  available   BOOLEAN        NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Admin sees everything; merchant sees own; customer & courier see available products
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
    OR ((public.has_role(auth.uid(), 'CUSTOMER') OR public.has_role(auth.uid(), 'COURIER'))
        AND available = true)
  );

CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid());

CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
    OR public.has_role(auth.uid(), 'ADMIN')
  );

CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
    OR public.has_role(auth.uid(), 'ADMIN')
  );

-- ============================================================
-- 4. Extend orders for customer-placed orders
-- ============================================================

-- customer_id (predefined destination) becomes optional — customer orders use delivery_address instead
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_id        UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS customer_user_id  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivery_address  TEXT;

-- ============================================================
-- 5. Update orders RLS
-- ============================================================

-- SELECT: customers see only their own orders
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
    OR public.has_role(auth.uid(), 'COURIER')
    OR (public.has_role(auth.uid(), 'CUSTOMER') AND customer_user_id = auth.uid())
  );

-- INSERT: merchant places on behalf of predefined customer; customer places own order.
-- For customer inserts, enforce that merchant_id matches the product's actual merchant.
DROP POLICY IF EXISTS "orders_insert_merchant" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())
    OR (
      public.has_role(auth.uid(), 'CUSTOMER')
      AND customer_user_id = auth.uid()
      AND merchant_id = (
        SELECT p.merchant_id FROM public.products p WHERE p.id = product_id AND p.available = true
      )
    )
  );

-- ============================================================
-- 6. Seed sample products (runs after demo merchant exists via seed.functions.ts)
--    We use a DO block so it only inserts when no products exist yet.
-- ============================================================
DO $$
DECLARE
  v_merchant_id UUID;
BEGIN
  -- Find the demo merchant by email via profiles
  SELECT p.id INTO v_merchant_id
  FROM public.profiles p
  WHERE p.email = 'merchant@example.com'
  LIMIT 1;

  IF v_merchant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    INSERT INTO public.products (merchant_id, name, description, price, available) VALUES
      (v_merchant_id, 'Margherita Pizza',   'Classic tomato & mozzarella',              12.90, true),
      (v_merchant_id, 'Veggie Burger',      'Grilled veggie patty with fresh toppings', 10.50, true),
      (v_merchant_id, 'Caesar Salad',       'Romaine, croutons, parmesan, caesar dressing', 9.00, true),
      (v_merchant_id, 'Beef Tacos (x3)',    'Seasoned beef, pico de gallo, lime crema', 11.00, true),
      (v_merchant_id, 'Chocolate Fondant',  'Warm chocolate cake with vanilla ice cream', 7.50, true);
  END IF;
END;
$$;
