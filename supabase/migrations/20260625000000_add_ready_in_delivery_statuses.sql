-- ============================================================
-- Add READY, IN_DELIVERY, DELIVERED to order_status enum
-- Update orders_update RLS to reflect new status flow:
--   Customer places order  → PENDING
--   Merchant marks ready   → READY
--   Courier picks up       → IN_DELIVERY
--   Courier delivers       → DELIVERED
-- ============================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'IN_DELIVERY';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'DELIVERED';

-- Re-create the orders_update policy to match the new flow
DROP POLICY IF EXISTS "orders_update" ON public.orders;

CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (
    -- Admin: unrestricted
    public.has_role(auth.uid(), 'ADMIN')

    -- Merchant: can only act on their own PENDING orders (→ READY)
    OR (
      public.has_role(auth.uid(), 'MERCHANT')
      AND merchant_id = auth.uid()
      AND status = 'PENDING'
    )

    -- Courier: can claim any READY order, or act on their own IN_DELIVERY order
    OR (
      public.has_role(auth.uid(), 'COURIER')
      AND (
        status = 'READY'
        OR (status = 'IN_DELIVERY' AND assigned_courier_id = auth.uid())
      )
    )
  );
