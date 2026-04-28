import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Package, Truck, Search, Bell, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/purchase-orders")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <Page />
      </AppLayout>
    </RequireAuth>
  ),
});

function Page() {
  const { t, formatDate } = useI18n();
  const { isPPIC, user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [deliveryFor, setDeliveryFor] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["material-deliveries"],
    queryFn: async () => {
      const { data } = await supabase.from("material_deliveries").select("*");
      return data ?? [];
    },
  });

  const { data: sos = [] } = useQuery({
    queryKey: ["sos-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, so_number, client_name, due_date, status")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const receivedMap: Record<string, number> = {};
  for (const d of deliveries) {
    receivedMap[d.purchase_order_id] =
      (receivedMap[d.purchase_order_id] || 0) + Number(d.quantity_received);
  }

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pos;
    return pos.filter((po: any) => {
      const linkedSo = sos.find((s: any) => s.id === po.sales_order_id);
      return (
        po.po_number?.toLowerCase().includes(q) ||
        po.material_type?.toLowerCase().includes(q) ||
        po.supplier_name?.toLowerCase().includes(q) ||
        linkedSo?.so_number?.toLowerCase().includes(q) ||
        linkedSo?.client_name?.toLowerCase().includes(q)
      );
    });
  }, [pos, sos, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_po")}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} / {pos.length} {t("po_list")}
          </p>
        </div>
        {isPPIC && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("po_new")}
          </Button>
        )}
      </div>

      {/* Search */}
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Cari PO, material, SO, klien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>


      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {pos.length === 0 ? t("no_data") : t("no_results")}

        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((po: any) => {
            const received = receivedMap[po.id] || 0;
            const pct = po.ordered_quantity
              ? Math.min(100, (received / Number(po.ordered_quantity)) * 100)
              : 0;
            const linkedSo = sos.find((s: any) => s.id === po.sales_order_id) as any;

            // Parse P and L from notes field
            const pMatch = po.notes?.match(/P:\s*([\d.]+)\s*mm/i);
            const lMatch = po.notes?.match(/L:\s*([\d.]+)\s*mm/i);
            const pVal = pMatch ? pMatch[1] : null;
            const lVal = lMatch ? lMatch[1] : null;

            // Deadline berdasarkan SO due_date (bahan harus siap 5 hari sebelumnya)
            const nowMs = new Date().setHours(0, 0, 0, 0);
            const soDiff = linkedSo?.due_date && linkedSo.status !== "selesai" && received < Number(po.ordered_quantity)
              ? Math.round((new Date(linkedSo.due_date).setHours(0,0,0,0) - nowMs) / 86400000)
              : null;
            const poUrgency = soDiff === null ? null
              : soDiff < 0 ? "overdue"
              : soDiff <= 5 ? "warning"
              : null;

            const statusColor =
              received === 0
                ? "text-destructive"
                : received >= Number(po.ordered_quantity)
                ? "text-success"
                : "text-warning";



            return (
              <Card key={po.id} className={`p-4 ${
                poUrgency === "overdue" ? "border-destructive/50" :
                poUrgency === "warning" ? "border-warning/40" : ""
              }`}>
                {/* Mobile: stacked layout; Desktop: row layout */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                  {/* Row 1 mobile / Left desktop: ikon + info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{po.po_number}</span>
                        {poUrgency === "overdue" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
                            <AlertTriangle className="h-3 w-3" /> {t("alert_so_late_label")} {Math.abs(soDiff!)}h
                          </span>
                        )}
                        {poUrgency === "warning" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground border border-warning/40">
                            <Bell className="h-3 w-3" /> {soDiff === 0 ? t("deadline_today") : `SO ${soDiff}h ${t("deadline_days_left")}`}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-foreground/80 mt-0.5 leading-snug">
                        {po.material_type}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {linkedSo && (
                          <Badge variant="outline" className="text-[10px]">SO: {linkedSo.so_number}</Badge>
                        )}
                        {po.supplier_name && (
                          <Badge variant="secondary" className="text-[10px]">{po.supplier_name}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2 mobile: P × L + penerimaan side by side */}
                  <div className="flex items-center justify-between gap-3 sm:gap-4">

                    {/* P × L bintang utama */}
                    {(pVal || lVal) && (
                      <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
                        {pVal && (
                          <div className="text-center">
                            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">P</div>
                            <div className="text-xl font-bold text-primary tabular-nums leading-tight">{pVal}</div>
                            <div className="text-[9px] text-muted-foreground">mm</div>
                          </div>
                        )}
                        {pVal && lVal && <div className="text-muted-foreground text-base">×</div>}
                        {lVal && (
                          <div className="text-center">
                            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">L</div>
                            <div className="text-xl font-bold text-primary tabular-nums leading-tight">{lVal}</div>
                            <div className="text-[9px] text-muted-foreground">mm</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Penerimaan + tombol */}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground">Diterima / Pesan</div>
                      <div className={`text-sm font-bold tabular-nums ${statusColor}`}>
                        {received} <span className="text-muted-foreground font-normal text-xs">/ {Number(po.ordered_quantity)}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-muted rounded mt-1 overflow-hidden">
                        <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      {isPPIC && (
                        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setDeliveryFor(po)}>
                          <Truck className="h-3 w-3 mr-1" />
                          Catat Terima
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewPODialog
          sos={sos}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["purchase-orders"] });
            setShowNew(false);
          }}
          userId={user?.id}
        />
      )}

      {deliveryFor && (
        <DeliveryDialog
          po={deliveryFor}
          onClose={() => setDeliveryFor(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["material-deliveries"] });
            setDeliveryFor(null);
          }}
          userId={user?.id}
        />
      )}
    </div>
  );
}

function NewPODialog({
  sos,
  onClose,
  onSaved,
  userId,
}: {
  sos: any[];
  onClose: () => void;
  onSaved: () => void;
  userId?: string;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    po_number: `PO-${Date.now().toString().slice(-6)}`,
    supplier_name: "",
    material_type: "Kertas Liner",
    ordered_quantity: 0,
    expected_arrival: "",
    is_stock_po: false,
    sales_order_id: "",
    notes: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        po_number: form.po_number,
        supplier_name: form.supplier_name || null,
        material_type: form.material_type,
        ordered_quantity: Number(form.ordered_quantity) || 0,
        expected_arrival: form.expected_arrival || null,
        is_stock_po: form.is_stock_po,
        sales_order_id: form.is_stock_po ? null : form.sales_order_id || null,
        notes: form.notes || null,
        created_by: userId,
      };
      const { error } = await supabase.from("purchase_orders").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("po_new")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>{t("po_number")}</Label>
            <Input
              value={form.po_number}
              onChange={(e) => setForm({ ...form, po_number: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("supplier")}</Label>
            <Input
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("material_type")}</Label>
            <Input
              value={form.material_type}
              onChange={(e) => setForm({ ...form, material_type: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("ordered_qty")}</Label>
            <Input
              type="number"
              value={form.ordered_quantity}
              onChange={(e) =>
                setForm({ ...form, ordered_quantity: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>{t("expected_arrival")}</Label>
            <Input
              type="date"
              value={form.expected_arrival}
              onChange={(e) =>
                setForm({ ...form, expected_arrival: e.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Checkbox
              id="stock"
              checked={form.is_stock_po}
              onCheckedChange={(c) =>
                setForm({ ...form, is_stock_po: !!c, sales_order_id: "" })
              }
            />
            <Label htmlFor="stock">{t("is_stock_po")}</Label>
          </div>
          {!form.is_stock_po && (
            <div className="sm:col-span-2">
              <Label>{t("link_so")}</Label>
              <Select
                value={form.sales_order_id}
                onValueChange={(v) => setForm({ ...form, sales_order_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {sos.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.so_number} — {s.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
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
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryDialog({
  po,
  onClose,
  onSaved,
  userId,
}: {
  po: any;
  onClose: () => void;
  onSaved: () => void;
  userId?: string;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    delivery_date: new Date().toISOString().slice(0, 10),
    quantity_received: 0,
    condition_notes: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("material_deliveries").insert({
        purchase_order_id: po.id,
        delivery_date: form.delivery_date,
        quantity_received: Number(form.quantity_received) || 0,
        condition_notes: form.condition_notes || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("add_delivery")} — {po.po_number}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>{t("delivery_date")}</Label>
            <Input
              type="date"
              value={form.delivery_date}
              onChange={(e) =>
                setForm({ ...form, delivery_date: e.target.value })
              }
            />
          </div>
          <div>
            <Label>{t("received_qty")}</Label>
            <Input
              type="number"
              value={form.quantity_received}
              onChange={(e) =>
                setForm({ ...form, quantity_received: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>{t("condition_notes")}</Label>
            <Textarea
              value={form.condition_notes}
              onChange={(e) =>
                setForm({ ...form, condition_notes: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
