-- Fix: scope the orders_update RLS policy so couriers can only update:
--   1. PENDING orders (to self-assign them)
--   2. Their own ASSIGNED orders (to complete or cancel)
--
-- Previously, the courier clause was unconditional:
--   OR (public.has_role(auth.uid(), 'COURIER'))
-- which allowed any courier to modify ANY order including fields like merchant_id.

DROP POLICY IF EXISTS "orders_update" ON public.orders;

CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (
    -- Admin can update any order
    public.has_role(auth.uid(), 'ADMIN')
    -- Merchant can only update their own PENDING orders
    OR (
      public.has_role(auth.uid(), 'MERCHANT')
      AND merchant_id = auth.uid()
      AND status = 'PENDING'
    )
    -- Courier can accept a PENDING order, or act on their own ASSIGNED order.
    -- COMPLETED orders are immutable for couriers.
    OR (
      public.has_role(auth.uid(), 'COURIER')
      AND status != 'COMPLETED'
      AND (status = 'PENDING' OR assigned_courier_id = auth.uid())
    )
  );
