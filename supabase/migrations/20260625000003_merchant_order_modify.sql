-- ============================================================
-- Allow merchants to update AND delete PENDING or READY orders
-- (previously USING only covered PENDING; DELETE referenced
--  the obsolete 'COMPLETED' status)
-- ============================================================

-- UPDATE: merchants can target PENDING or READY rows and
-- leave them in PENDING or READY after the update.
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (
    -- Admin: unrestricted
    public.has_role(auth.uid(), 'ADMIN')

    -- Merchant: PENDING or READY (can mark ready, revert, or edit due_time)
    OR (
      public.has_role(auth.uid(), 'MERCHANT')
      AND merchant_id = auth.uid()
      AND status IN ('PENDING', 'READY')
    )

    -- Courier: claim READY orders, or act on own IN_DELIVERY orders
    OR (
      public.has_role(auth.uid(), 'COURIER')
      AND (
        status = 'READY'
        OR (status = 'IN_DELIVERY' AND assigned_courier_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    -- Admin: unrestricted
    public.has_role(auth.uid(), 'ADMIN')

    -- Merchant: resulting row must still be PENDING or READY (no skipping ahead)
    OR (
      public.has_role(auth.uid(), 'MERCHANT')
      AND merchant_id = auth.uid()
      AND status IN ('PENDING', 'READY')
    )

    -- Courier: can claim (IN_DELIVERY), deliver (DELIVERED), or drop (READY + no courier)
    OR (
      public.has_role(auth.uid(), 'COURIER')
      AND (
        (status = 'IN_DELIVERY' AND assigned_courier_id = auth.uid())
        OR status = 'DELIVERED'
        OR (status = 'READY' AND assigned_courier_id IS NULL)
      )
    )
  );

-- DELETE: merchants can cancel PENDING or READY orders only
-- (replaces old policy that referenced obsolete 'COMPLETED' status)
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR (
      public.has_role(auth.uid(), 'MERCHANT')
      AND merchant_id = auth.uid()
      AND status IN ('PENDING', 'READY')
    )
    OR (
      public.has_role(auth.uid(), 'CUSTOMER')
      AND customer_user_id = auth.uid()
      AND status IN ('PENDING', 'READY')
    )
  );
