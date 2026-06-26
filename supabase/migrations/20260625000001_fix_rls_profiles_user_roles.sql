-- Fix profiles RLS: all authenticated users can read any profile
-- (restaurant names/addresses are public-facing info in a delivery app)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Fix user_roles RLS: also allow reading MERCHANT entries
-- so customers can discover which users are restaurants
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'ADMIN')
    OR role = 'MERCHANT'
  );
