import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, Search, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOStatusBadge, SO_STATUSES } from "@/components/StatusBadges";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/sales-orders/")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <SalesOrdersPage />
      </AppLayout>
    </RequireAuth>
  ),
});

function SalesOrdersPage() {
  const { t, formatDate } = useI18n();
  const { isPPIC } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);

  const { data: sos = [], isLoading } = useQuery({
    queryKey: ["sales_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return sos.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.so_number.toLowerCase().includes(q) &&
          !s.client_name.toLowerCase().includes(q) &&
          !s.product_name.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [sos, search, statusFilter]);

  const today = new Date().toISOString().slice(0, 10);

  const onExport = () => {
    const rows = filtered.map((s) => ({
      "SO Number": s.so_number,
      Client: s.client_name,
      Product: s.product_name,
      Type: s.product_type ?? "",
      Quantity: s.quantity,
      "Due Date": s.due_date ?? "",
      Status: s.status,
      Notes: s.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SO");
    XLSX.writeFile(wb, `sales-orders-${today}.xlsx`);
  };

  const onImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const records = rows
        .map((r) => ({
          so_number: String(r["SO Number"] ?? r.so_number ?? "").trim(),
          client_name: String(r["Client"] ?? r.client_name ?? "").trim(),
          product_name: String(r["Product"] ?? r.product_name ?? "").trim(),
          product_type: String(r["Type"] ?? r.product_type ?? "") || null,
          quantity: Number(r["Quantity"] ?? r.quantity ?? 0),
          due_date: r["Due Date"] || r.due_date || null,
          notes: String(r["Notes"] ?? r.notes ?? "") || null,
        }))
        .filter((r) => r.so_number && r.client_name && r.product_name);
      if (records.length === 0) {
        toast.error("Tidak ada data valid (perlu kolom SO Number, Client, Product).");
        return;
      }
      const { error } = await supabase.from("sales_orders").insert(records);
      if (error) throw error;
      toast.success(`${records.length} SO diimpor.`);
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
    } catch (e: any) {
      toast.error(e.message ?? "Gagal impor");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("so_list")}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} / {sos.length} {t("so")}
          </p>
        </div>
        {isPPIC && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> {t("so_import")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" /> {t("so_export")}
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-industrial text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1" /> {t("so_new")}
                </Button>
              </DialogTrigger>
              <NewSODialog onClose={() => setOpenNew(false)} />
            </Dialog>
          </div>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {SO_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`so_status_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">{t("no_data")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">{t("so_number")}</th>
                  <th className="py-2 pr-3">{t("client")}</th>
                  <th className="py-2 pr-3">{t("product")}</th>
                  <th className="py-2 pr-3 text-right">{t("quantity")}</th>
                  <th className="py-2 pr-3">{t("due_date")}</th>
                  <th className="py-2 pr-3">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const late = s.status !== "selesai" && s.due_date && s.due_date < today;
                  return (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="py-2 pr-3">
                        <Link
                          to="/sales-orders/$soId"
                          params={{ soId: s.id }}
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {late && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          {s.so_number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{s.client_name}</td>
                      <td className="py-2 pr-3">
                        <div>{s.product_name}</div>
                        {s.product_type && (
                          <div className="text-xs text-muted-foreground">{s.product_type}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.quantity}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(s.due_date)}</td>
                      <td className="py-2 pr-3">
                        <SOStatusBadge status={s.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NewSODialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    so_number: "",
    client_name: "",
    product_name: "",
    product_type: "",
    quantity: 0,
    due_date: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.so_number || !form.client_name || !form.product_name) {
      toast.error("Lengkapi field wajib");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("sales_orders")
      .insert({
        so_number: form.so_number,
        client_name: form.client_name,
        product_name: form.product_name,
        product_type: form.product_type || null,
        quantity: form.quantity,
        due_date: form.due_date || null,
        notes: form.notes || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("SO dibuat");
    qc.invalidateQueries({ queryKey: ["sales_orders"] });
    onClose();
    if (data) navigate({ to: "/sales-orders/$soId", params: { soId: data.id } });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("so_new")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>{t("so_number")} *</Label>
          <Input
            value={form.so_number}
            onChange={(e) => setForm({ ...form, so_number: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>{t("client")} *</Label>
          <Input
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("product")} *</Label>
          <Input
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("product_type")}</Label>
          <Input
            value={form.product_type}
            onChange={(e) => setForm({ ...form, product_type: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("quantity")}</Label>
          <Input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>{t("due_date")}</Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label>{t("notes")}</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button onClick={submit} disabled={busy} className="bg-gradient-industrial text-primary-foreground">
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
