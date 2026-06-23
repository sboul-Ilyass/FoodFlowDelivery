DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (public.has_role(auth.uid(), 'MERCHANT') AND merchant_id = auth.uid() AND status != 'COMPLETED')
);
