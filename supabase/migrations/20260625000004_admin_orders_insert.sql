-- Allow admin to insert orders (previously only MERCHANT and CUSTOMER were allowed)
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin: unrestricted
    public.has_role(auth.uid(), 'ADMIN')

    -- Merchant places order for a predefined customer or on behalf of anyone
    OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid())

    -- Customer places their own order
    OR (
      public.has_role(auth.uid(), 'CUSTOMER')
      AND customer_user_id = auth.uid()
      AND merchant_id = (
        SELECT p.merchant_id FROM public.products p WHERE p.id = product_id AND p.available = true
      )
    )
  );
