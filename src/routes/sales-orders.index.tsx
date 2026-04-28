import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, Search, AlertTriangle, Bell } from "lucide-react";
import * as XLSX from "xlsx";
import { parsePlanningExcel, rowToSORecord, rowToPORecord } from "@/lib/parseExcel";
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

/** Compute deadline urgency for a Sales Order */
function getDeadlineInfo(dueDate: string | null, status: string) {
  if (!dueDate || status === "selesai") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0)  return { level: "overdue",  days: Math.abs(diffDays) } as const;
  if (diffDays <= 3) return { level: "warning",  days: diffDays } as const;
  return null;
}

function DeadlineBadge({ dueDate, status, t }: { dueDate: string | null; status: string; t: (k: string) => string }) {
  const info = getDeadlineInfo(dueDate, status);
  if (!info) return null;
  if (info.level === "overdue")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
        <AlertTriangle className="h-3 w-3" />
        {t("alert_so_late_label")} {info.days}h
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground border border-warning/40">
      <Bell className="h-3 w-3" />
      {info.days === 0 ? t("deadline_today") : `${info.days} ${t("deadline_days_left")}`}
    </span>
  );
}

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
      // Use centralized parser — works with both PLANNING PRODUKSI and PLANNING KE PPIC formats
      const rows = await parsePlanningExcel(file);

      if (rows.length === 0) {
        toast.error("Tidak ada data valid. Pastikan file menggunakan format PLANNING PRODUKSI.");
        return;
      }

      // Deduplicate by spk_number (last row wins)
      const soMap = new Map<string, ReturnType<typeof rowToSORecord>>();
      const spkMap = new Map<string, { spk_number: string; issue_date: string }>();

      for (const r of rows) {
        if (!r.spk_number && !r.customer_name) continue;
        const rec = rowToSORecord(r);
        if (!rec.so_number || !rec.client_name) continue;
        soMap.set(rec.so_number, rec);
        if (r.spk_number && r.schedule_date) {
          spkMap.set(r.spk_number, { spk_number: r.spk_number, issue_date: r.schedule_date });
        }
      }

      const soRecords = Array.from(soMap.values());
      const { data: insertedSOs, error: soError } = await supabase
        .from("sales_orders")
        .upsert(soRecords as any, { onConflict: "so_number" })
        .select("id, so_number");
      if (soError) throw soError;

      // ── 2. Insert POs linked to SOs ──
      let poCount = 0;
      if (insertedSOs) {
        const soIdMap = new Map(insertedSOs.map((s) => [s.so_number, s.id]));
        const rawRowMap = new Map<string, (typeof rows)[number]>();
        for (const r of rows) rawRowMap.set(r.spk_number, r);

        const poRecords: any[] = [];
        for (const so of insertedSOs) {
          const raw = rawRowMap.get(so.so_number);
          if (!raw || !raw.paper) continue;
          poRecords.push(rowToPORecord(raw, soIdMap.get(so.so_number)!));
        }

        if (poRecords.length > 0) {
          const { data: insertedPOs, error: poErr } = await supabase
            .from("purchase_orders")
            .upsert(poRecords, { onConflict: "po_number" })
            .select("id, po_number");
          if (!poErr && insertedPOs) poCount = insertedPOs.length;
          else if (poErr) console.error("Gagal upsert PO:", poErr);
        }
      }

      toast.success(`${soRecords.length} SO & ${poCount} PO diimpor.`);
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
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

        {/* ── Deadline warning banner ── */}
        {(() => {
          const urgent = sos.filter((s: any) => {
            const info = getDeadlineInfo(s.due_date, s.status);
            return info !== null;
          });
          if (urgent.length === 0) return null;
          const overdue = urgent.filter((s: any) => getDeadlineInfo(s.due_date, s.status)?.level === "overdue");
          const warning = urgent.filter((s: any) => getDeadlineInfo(s.due_date, s.status)?.level === "warning");
          return (
            <div className="mb-3 space-y-1.5">
              {overdue.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-destructive">⚠ {overdue.length} SO {t("alert_so_late_label")}!</div>
                    <div className="text-muted-foreground mt-0.5">
                      {overdue.map((s: any) => s.so_number).join(", ")}
                    </div>
                  </div>
                </div>
              )}
              {warning.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-xs">
                  <Bell className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-warning-foreground">🔔 {warning.length} SO — deadline {t("deadline_days_left")}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {warning.map((s: any) => `${s.so_number} (${getDeadlineInfo(s.due_date, s.status)?.days}h)`).join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">{t("no_data")}</div>
        ) : (

          <>
            {/* ── Mobile: kartu list ── */}
            <div className="md:hidden space-y-2">
              {filtered.map((s: any) => {
                const dlInfo = getDeadlineInfo(s.due_date, s.status);
                return (
                  <Link
                    key={s.id}
                    to="/sales-orders/$soId"
                    params={{ soId: s.id }}
                    className="block"
                  >
                    <div className={`rounded-md border bg-card p-3 hover:shadow-sm transition-shadow ${
                      dlInfo?.level === "overdue" ? "border-destructive/50 bg-destructive/5" :
                      dlInfo?.level === "warning" ? "border-warning/40" : ""
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-primary">{s.so_number}</span>
                            <DeadlineBadge dueDate={s.due_date} status={s.status} t={t} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{s.client_name}</div>
                          {(s as any).customer_po_number && (
                            <div className="text-xs text-muted-foreground">PO: {(s as any).customer_po_number}</div>
                          )}
                        </div>
                        <SOStatusBadge status={s.status} />
                      </div>
                      <div className="mt-2 text-xs font-medium truncate">{s.product_name}</div>
                      {s.product_type && (
                        <div className="text-[11px] text-muted-foreground truncate">{s.product_type}</div>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{t("quantity")}: <span className="font-medium text-foreground">{s.quantity}</span></span>
                        <span>{t("due_date")}: <span className="font-medium text-foreground">{formatDate(s.due_date)}</span></span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── Desktop: tabel ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">{t("so_number")}</th>
                    <th className="py-2 pr-3">{t("client")}</th>
                    <th className="py-2 pr-3">PO Klien</th>
                    <th className="py-2 pr-3">{t("product")}</th>
                    <th className="py-2 pr-3 text-right">{t("quantity")}</th>
                    <th className="py-2 pr-3">{t("due_date")}</th>
                    <th className="py-2 pr-3">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any) => {
                    return (
                      <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/40 cursor-pointer ${
                        getDeadlineInfo(s.due_date, s.status)?.level === "overdue" ? "bg-destructive/5" : ""
                      }`}>
                        <td className="py-2 pr-3">
                          <Link
                            to="/sales-orders/$soId"
                            params={{ soId: s.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.so_number}
                              <DeadlineBadge dueDate={s.due_date} status={s.status} t={t} />
                            </div>
                          </Link>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{s.client_name}</td>
                        <td className="py-2 pr-3">
                          {(s as any).customer_po_number ? (
                            <span className="text-xs text-muted-foreground">{(s as any).customer_po_number}</span>
                          ) : "—"}
                        </td>
                        <td className="py-2 pr-3 max-w-xs">
                          <div className="font-medium truncate">{s.product_name}</div>
                          {s.product_type && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.product_type}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s.quantity}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(s.due_date)}</td>
                        <td className="py-2 pr-3"><SOStatusBadge status={s.status} /></td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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
