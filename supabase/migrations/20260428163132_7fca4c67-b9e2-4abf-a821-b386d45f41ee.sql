
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('ppic', 'operator', 'manager');
CREATE TYPE public.so_status AS ENUM ('menunggu_konfirmasi','dikonfirmasi','menunggu_bahan','siap_produksi','dalam_produksi','selesai');
CREATE TYPE public.stage_status AS ENUM ('belum_mulai','sedang_berjalan','selesai','ditunda');
CREATE TYPE public.shift_type AS ENUM ('pagi','malam');
CREATE TYPE public.shift_completion AS ENUM ('in_progress','selesai_shift','tahap_selesai');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  division_id UUID,
  preferred_language TEXT NOT NULL DEFAULT 'id',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.current_user_division()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT division_id FROM public.profiles WHERE id = auth.uid() $$;

-- ============ MASTER DATA ============
CREATE TABLE public.divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  division_id UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_division_fk FOREIGN KEY (division_id) REFERENCES public.divisions(id) ON DELETE SET NULL;

-- ============ SALES ORDERS ============
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_type TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  notes TEXT,
  status so_status NOT NULL DEFAULT 'menunggu_konfirmasi',
  needs_client_confirmation BOOLEAN NOT NULL DEFAULT false,
  client_confirmation_notes TEXT,
  client_confirmation_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  is_stock_po BOOLEAN NOT NULL DEFAULT false,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  material_type TEXT NOT NULL,
  ordered_quantity NUMERIC NOT NULL DEFAULT 0,
  expected_arrival DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.material_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  condition_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.material_deliveries ENABLE ROW LEVEL SECURITY;

-- ============ SPK ============
CREATE TABLE public.spk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spk_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spk ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.spk_purchase_orders (
  spk_id UUID NOT NULL REFERENCES public.spk(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  PRIMARY KEY (spk_id, purchase_order_id)
);
ALTER TABLE public.spk_purchase_orders ENABLE ROW LEVEL SECURITY;

-- ============ WORKFLOW ============
CREATE TABLE public.workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  stage_order INT NOT NULL DEFAULT 0,
  stage_name TEXT NOT NULL,
  division_id UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  estimated_duration_hours NUMERIC,
  target_start DATE,
  target_end DATE,
  status stage_status NOT NULL DEFAULT 'belum_mulai',
  notes TEXT,
  pending_ppic_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.workflow_stages (sales_order_id, stage_order);

CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

-- ============ SHIFT REPORTS ============
CREATE TABLE public.shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift shift_type NOT NULL,
  operator_user_id UUID REFERENCES auth.users(id),
  operator_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  machine_name TEXT,
  qty_processed NUMERIC NOT NULL DEFAULT 0,
  qty_reject NUMERIC NOT NULL DEFAULT 0,
  reject_reason TEXT,
  issues TEXT,
  completion shift_completion NOT NULL DEFAULT 'in_progress',
  ppic_correction_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- ============ ACTIVITY LOG ============
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_so_updated BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_updated BEFORE UPDATE ON public.workflow_stages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- Profiles: user reads own; PPIC reads/manages all
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'ppic') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'ppic'));
CREATE POLICY "profiles_ppic_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'ppic') OR id = auth.uid());

-- user_roles: PPIC manages; users read own
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ppic'));
CREATE POLICY "roles_ppic_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- Master data: all authenticated read; PPIC manages
CREATE POLICY "div_read" ON public.divisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "div_ppic" ON public.divisions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "mac_read" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "mac_ppic" ON public.machines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "sup_read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup_ppic" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- Sales Orders: all authenticated read; PPIC manages
CREATE POLICY "so_read" ON public.sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "so_ppic" ON public.sales_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- POs / Deliveries / SPK
CREATE POLICY "po_read" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "po_ppic" ON public.purchase_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "md_read" ON public.material_deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "md_ppic" ON public.material_deliveries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "spk_read" ON public.spk FOR SELECT TO authenticated USING (true);
CREATE POLICY "spk_ppic" ON public.spk FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "spk_po_read" ON public.spk_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "spk_po_ppic" ON public.spk_purchase_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- Workflow stages: all read; PPIC full; operator can update status of their division's stages
CREATE POLICY "ws_read" ON public.workflow_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_ppic" ON public.workflow_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));
CREATE POLICY "ws_operator_update" ON public.workflow_stages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'operator') AND division_id = public.current_user_division()) WITH CHECK (public.has_role(auth.uid(),'operator') AND division_id = public.current_user_division());

-- Workflow templates
CREATE POLICY "wt_read" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wt_ppic" ON public.workflow_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- Shift reports: read all; operator can insert for their division stages; PPIC manages
CREATE POLICY "sr_read" ON public.shift_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "sr_operator_insert" ON public.shift_reports FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'operator') AND
  EXISTS (SELECT 1 FROM public.workflow_stages ws WHERE ws.id = workflow_stage_id AND ws.division_id = public.current_user_division())
);
CREATE POLICY "sr_ppic_all" ON public.shift_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(),'ppic')) WITH CHECK (public.has_role(auth.uid(),'ppic'));

-- Activity log
CREATE POLICY "log_read" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ppic') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "log_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============ SEED DEFAULT DIVISIONS ============
INSERT INTO public.divisions (name, description) VALUES
  ('Splitter','Divisi Splitter'),
  ('Cetak','Divisi Cetak / Printing'),
  ('Finishing','Divisi Finishing / Packing'),
  ('Jahit','Divisi Jahit'),
  ('QC','Quality Control'),
  ('Gudang','Gudang / Warehouse')
ON CONFLICT (name) DO NOTHING;
