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
import { Plus, FileText, Printer } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/spk")({
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
  const [printSpk, setPrintSpk] = useState<any | null>(null);

  const { data: spks = [] } = useQuery({
    queryKey: ["spk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spk")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: sos = [] } = useQuery({
    queryKey: ["sos-min-spk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, so_number, client_name, product_name, quantity, due_date")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["pos-min-spk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, material_type, sales_order_id");
      return data ?? [];
    },
  });
  const { data: links = [] } = useQuery({
    queryKey: ["spk-po-links"],
    queryFn: async () => {
      const { data } = await supabase.from("spk_purchase_orders").select("*");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_spk")}</h1>
          <p className="text-sm text-muted-foreground">{t("spk_list")}</p>
        </div>
        {isPPIC && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("spk_new")}
          </Button>
        )}
      </div>

      {spks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("no_data")}
        </Card>
      ) : (
        <div className="grid gap-3">
          {spks.map((s: any) => {
            const so = sos.find((x: any) => x.id === s.sales_order_id);
            const linkedPoIds = links
              .filter((l: any) => l.spk_id === s.id)
              .map((l: any) => l.purchase_order_id);
            const linkedPos = pos.filter((p: any) => linkedPoIds.includes(p.id));
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{s.spk_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("issue_date")}: {formatDate(s.issue_date)}
                      </div>
                      {so && (
                        <div className="text-sm mt-1">
                          <Badge variant="outline">{so.so_number}</Badge>{" "}
                          <span className="text-muted-foreground">
                            {so.client_name} · {so.product_name}
                          </span>
                        </div>
                      )}
                      {linkedPos.length > 0 && (
                        <div className="text-xs mt-1 flex flex-wrap gap-1">
                          {linkedPos.map((p: any) => (
                            <Badge key={p.id} variant="secondary">
                              {p.po_number}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrintSpk({ spk: s, so, pos: linkedPos })}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    {t("print_spk")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewSPKDialog
          sos={sos}
          pos={pos}
          userId={user?.id}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["spk"] });
            qc.invalidateQueries({ queryKey: ["spk-po-links"] });
            setShowNew(false);
          }}
        />
      )}
      {printSpk && (
        <PrintDialog data={printSpk} onClose={() => setPrintSpk(null)} />
      )}
    </div>
  );
}

function NewSPKDialog({
  sos,
  pos,
  userId,
  onClose,
  onSaved,
}: {
  sos: any[];
  pos: any[];
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    spk_number: `SPK-${Date.now().toString().slice(-6)}`,
    sales_order_id: "",
    issue_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [selectedPos, setSelectedPos] = useState<string[]>([]);
  const filteredPos = pos.filter(
    (p: any) => !form.sales_order_id || p.sales_order_id === form.sales_order_id,
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!form.sales_order_id) throw new Error("SO wajib dipilih");
      const { data: spk, error } = await supabase
        .from("spk")
        .insert({
          spk_number: form.spk_number,
          sales_order_id: form.sales_order_id,
          issue_date: form.issue_date,
          notes: form.notes || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      if (selectedPos.length > 0) {
        const { error: e2 } = await supabase
          .from("spk_purchase_orders")
          .insert(
            selectedPos.map((poId) => ({
              spk_id: spk.id,
              purchase_order_id: poId,
            })),
          );
        if (e2) throw e2;
      }
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
          <DialogTitle>{t("spk_new")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>{t("spk_number")}</Label>
            <Input
              value={form.spk_number}
              onChange={(e) => setForm({ ...form, spk_number: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("link_so")}</Label>
            <Select
              value={form.sales_order_id}
              onValueChange={(v) => {
                setForm({ ...form, sales_order_id: v });
                setSelectedPos([]);
              }}
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
          <div>
            <Label>{t("issue_date")}</Label>
            <Input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
          </div>
          {form.sales_order_id && filteredPos.length > 0 && (
            <div>
              <Label>{t("link_po")}</Label>
              <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {filteredPos.map((p: any) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPos.includes(p.id)}
                      onChange={(e) =>
                        setSelectedPos((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((x) => x !== p.id),
                        )
                      }
                    />
                    {p.po_number} — {p.material_type}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
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

function PrintDialog({
  data,
  onClose,
}: {
  data: { spk: any; so: any; pos: any[] };
  onClose: () => void;
}) {
  const { t, formatDate } = useI18n();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("print_spk")}</DialogTitle>
        </DialogHeader>
        <div className="bg-white text-black p-6 rounded border print:border-0">
          <div className="text-center border-b pb-3 mb-3">
            <div className="text-lg font-bold">SURAT PERINTAH KERJA</div>
            <div className="text-xs">PPIC Karton</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 w-1/3 font-semibold">No. SPK</td>
                <td>: {data.spk.spk_number}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Tanggal</td>
                <td>: {formatDate(data.spk.issue_date)}</td>
              </tr>
              {data.so && (
                <>
                  <tr>
                    <td className="py-1 font-semibold">No. SO</td>
                    <td>: {data.so.so_number}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold">Klien</td>
                    <td>: {data.so.client_name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold">Produk</td>
                    <td>: {data.so.product_name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold">Jumlah</td>
                    <td>: {data.so.quantity}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold">Tenggat</td>
                    <td>: {formatDate(data.so.due_date)}</td>
                  </tr>
                </>
              )}
              {data.pos.length > 0 && (
                <tr>
                  <td className="py-1 font-semibold align-top">Bahan (PO)</td>
                  <td>
                    : {data.pos.map((p: any) => p.po_number).join(", ")}
                  </td>
                </tr>
              )}
              {data.spk.notes && (
                <tr>
                  <td className="py-1 font-semibold align-top">Catatan</td>
                  <td>: {data.spk.notes}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-4 mt-8 text-center text-xs">
            <div>
              <div>PPIC</div>
              <div className="h-12" />
              <div className="border-t pt-1">(__________)</div>
            </div>
            <div>
              <div>Produksi</div>
              <div className="h-12" />
              <div className="border-t pt-1">(__________)</div>
            </div>
            <div>
              <div>Manajer</div>
              <div className="h-12" />
              <div className="border-t pt-1">(__________)</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            {t("print_spk")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
