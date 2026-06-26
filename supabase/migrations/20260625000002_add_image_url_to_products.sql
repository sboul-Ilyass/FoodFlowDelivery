-- Add image_url to products table
-- This column is referenced in customer.restaurant.$merchantId.tsx
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
