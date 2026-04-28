-- Add customer_po_number and schedule_date to sales_orders
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  ADD COLUMN IF NOT EXISTS schedule_date DATE;
