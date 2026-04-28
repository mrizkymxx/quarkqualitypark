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
import { Plus, Package, Truck } from "lucide-react";
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
        .select("id, so_number, client_name")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const receivedMap: Record<string, number> = {};
  for (const d of deliveries) {
    receivedMap[d.purchase_order_id] =
      (receivedMap[d.purchase_order_id] || 0) + Number(d.quantity_received);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_po")}</h1>
          <p className="text-sm text-muted-foreground">{t("po_list")}</p>
        </div>
        {isPPIC && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("po_new")}
          </Button>
        )}
      </div>

      {pos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("no_data")}
        </Card>
      ) : (
        <div className="grid gap-3">
          {pos.map((po: any) => {
            const received = receivedMap[po.id] || 0;
            const pct = po.ordered_quantity
              ? Math.min(100, (received / Number(po.ordered_quantity)) * 100)
              : 0;
            const linkedSo = sos.find((s: any) => s.id === po.sales_order_id);
            return (
              <Card key={po.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{po.po_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {po.supplier_name || "—"} · {po.material_type}
                      </div>
                      <div className="text-xs mt-1 flex flex-wrap gap-2">
                        {po.is_stock_po ? (
                          <Badge variant="secondary">{t("is_stock_po")}</Badge>
                        ) : linkedSo ? (
                          <Badge variant="outline">SO: {linkedSo.so_number}</Badge>
                        ) : null}
                        {po.expected_arrival && (
                          <span className="text-muted-foreground">
                            {t("expected_arrival")}: {formatDate(po.expected_arrival)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums">
                      {received} / {Number(po.ordered_quantity)}
                    </div>
                    <div className="w-32 h-1.5 bg-muted rounded mt-1 overflow-hidden">
                      <div
                        className="h-full bg-success"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isPPIC && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setDeliveryFor(po)}
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        {t("add_delivery")}
                      </Button>
                    )}
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
