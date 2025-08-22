-- Create products, sales, and restocks tables with RLS and timestamps
-- Shared timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  current_stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_restocked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
CREATE POLICY IF NOT EXISTS "Products are viewable by owner"
ON public.products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Products are insertable by owner"
ON public.products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Products are updatable by owner"
ON public.products FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Products are deletable by owner"
ON public.products FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sales table (denormalize product_name for reporting stability)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  profit NUMERIC(10,2) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Sales viewable by owner"
ON public.sales FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Sales insertable by owner"
ON public.sales FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Sales updatable by owner"
ON public.sales FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Sales deletable by owner"
ON public.sales FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_product ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);

DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restocks table
CREATE TABLE IF NOT EXISTS public.restocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  notes TEXT,
  receipt_url TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Restocks viewable by owner"
ON public.restocks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Restocks insertable by owner"
ON public.restocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Restocks updatable by owner"
ON public.restocks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Restocks deletable by owner"
ON public.restocks FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_restocks_user ON public.restocks(user_id);
CREATE INDEX IF NOT EXISTS idx_restocks_product ON public.restocks(product_id);
CREATE INDEX IF NOT EXISTS idx_restocks_date ON public.restocks(date);

DROP TRIGGER IF EXISTS trg_restocks_updated_at ON public.restocks;
CREATE TRIGGER trg_restocks_updated_at
BEFORE UPDATE ON public.restocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();