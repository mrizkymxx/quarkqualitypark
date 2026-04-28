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
import { Plus, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/shift-reports")({
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
  const { profile, isPPIC, isOperator, user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["shift-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_reports")
        .select("*, workflow_stages(stage_name, sales_orders(so_number, product_name))")
        .order("report_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const canCreate = isOperator || isPPIC;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_shift")}</h1>
          <p className="text-sm text-muted-foreground">{t("shift_report")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("shift_new")}
          </Button>
        )}
      </div>

      {reports.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("no_data")}
        </Card>
      ) : (
        <div className="grid gap-3">
          {reports.map((r: any) => (
            <Card
              key={r.id}
              className="p-4 cursor-pointer hover:bg-muted/30"
              onClick={() => isPPIC && setEditing(r)}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-md bg-info/15 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-5 w-5 text-info" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {r.workflow_stages?.sales_orders?.so_number || "—"}
                      <span className="text-muted-foreground font-normal">
                        {" · "}
                        {r.workflow_stages?.stage_name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.report_date)} · {t(`shift_${r.shift}`)} ·{" "}
                      {r.operator_name}
                      {r.machine_name ? ` · ${r.machine_name}` : ""}
                    </div>
                    <div className="text-sm mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {t("qty_processed")}: {Number(r.qty_processed)}
                      </Badge>
                      {Number(r.qty_reject) > 0 && (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 border">
                          {t("qty_reject")}: {Number(r.qty_reject)}
                        </Badge>
                      )}
                      <CompletionBadge completion={r.completion} />
                    </div>
                    {r.issues && (
                      <div className="text-xs mt-1 text-warning-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {r.issues}
                      </div>
                    )}
                    {r.ppic_correction_notes && (
                      <div className="text-xs mt-1 text-muted-foreground italic">
                        {t("ppic_correction")}: {r.ppic_correction_notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewShiftDialog
          operatorName={profile?.full_name || profile?.email || "Operator"}
          operatorId={user?.id}
          divisionId={profile?.division_id || null}
          isPPIC={isPPIC}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["shift-reports"] });
            setShowNew(false);
          }}
        />
      )}
      {editing && isPPIC && (
        <EditShiftDialog
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["shift-reports"] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CompletionBadge({ completion }: { completion: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    in_progress: "bg-info/15 text-info border-info/30",
    selesai_shift: "bg-success/15 text-success border-success/30",
    tahap_selesai: "bg-primary/10 text-primary border-primary/30",
  };
  return (
    <Badge variant="outline" className={`${map[completion]} border`}>
      {t(`comp_${completion}`)}
    </Badge>
  );
}

function NewShiftDialog({
  operatorName,
  operatorId,
  divisionId,
  isPPIC,
  onClose,
  onSaved,
}: {
  operatorName: string;
  operatorId?: string;
  divisionId: string | null;
  isPPIC: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    workflow_stage_id: "",
    machine_id: "",
    report_date: new Date().toISOString().slice(0, 10),
    shift: "pagi" as "pagi" | "siang" | "malam",
    qty_processed: 0,
    qty_reject: 0,
    reject_reason: "",
    issues: "",
    completion: "in_progress" as "in_progress" | "selesai_shift" | "tahap_selesai",
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["stages-for-shift", divisionId, isPPIC],
    queryFn: async () => {
      let q = supabase
        .from("workflow_stages")
        .select("id, stage_name, division_id, sales_orders(so_number, product_name)")
        .neq("status", "selesai");
      if (!isPPIC && divisionId) q = q.eq("division_id", divisionId);
      const { data } = await q.limit(100);
      return data ?? [];
    },
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines-for-shift", divisionId, isPPIC],
    queryFn: async () => {
      let q = supabase.from("machines").select("id, name, division_id").eq("is_active", true);
      if (!isPPIC && divisionId) q = q.eq("division_id", divisionId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.workflow_stage_id) throw new Error("Tahap workflow wajib dipilih");
      const machine = machines.find((m: any) => m.id === form.machine_id);
      const { error } = await supabase.from("shift_reports").insert({
        workflow_stage_id: form.workflow_stage_id,
        machine_id: form.machine_id || null,
        machine_name: machine?.name || null,
        report_date: form.report_date,
        shift: form.shift as "pagi" | "malam",
        operator_user_id: operatorId,
        operator_name: operatorName,
        qty_processed: Number(form.qty_processed) || 0,
        qty_reject: Number(form.qty_reject) || 0,
        reject_reason: form.reject_reason || null,
        issues: form.issues || null,
        completion: form.completion as "in_progress" | "selesai_shift" | "tahap_selesai",
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("shift_new")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>{t("workflow_stage")}</Label>
            <Select
              value={form.workflow_stage_id}
              onValueChange={(v) => setForm({ ...form, workflow_stage_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sales_orders?.so_number || "?"} · {s.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("date")}</Label>
            <Input
              type="date"
              value={form.report_date}
              onChange={(e) => setForm({ ...form, report_date: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("shift")}</Label>
            <Select
              value={form.shift}
              onValueChange={(v: any) => setForm({ ...form, shift: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pagi">{t("shift_pagi")}</SelectItem>
                <SelectItem value="malam">{t("shift_malam")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>{t("machine")}</Label>
            <Select
              value={form.machine_id}
              onValueChange={(v) => setForm({ ...form, machine_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("qty_processed")}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={form.qty_processed}
              onChange={(e) =>
                setForm({ ...form, qty_processed: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>{t("qty_reject")}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={form.qty_reject}
              onChange={(e) =>
                setForm({ ...form, qty_reject: Number(e.target.value) })
              }
            />
          </div>
          {Number(form.qty_reject) > 0 && (
            <div className="sm:col-span-2">
              <Label>{t("reject_reason")}</Label>
              <Input
                value={form.reject_reason}
                onChange={(e) =>
                  setForm({ ...form, reject_reason: e.target.value })
                }
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>{t("issues")}</Label>
            <Textarea
              value={form.issues}
              onChange={(e) => setForm({ ...form, issues: e.target.value })}
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("completion")}</Label>
            <Select
              value={form.completion}
              onValueChange={(v: any) => setForm({ ...form, completion: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">{t("comp_in_progress")}</SelectItem>
                <SelectItem value="done">{t("comp_selesai_shift")}</SelectItem>
                <SelectItem value="blocked">{t("comp_tahap_selesai")}</SelectItem>
              </SelectContent>
            </Select>
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

function EditShiftDialog({
  report,
  onClose,
  onSaved,
}: {
  report: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [notes, setNotes] = useState(report.ppic_correction_notes || "");
  const [qty, setQty] = useState(Number(report.qty_processed));
  const [reject, setReject] = useState(Number(report.qty_reject));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shift_reports")
        .update({
          qty_processed: qty,
          qty_reject: reject,
          ppic_correction_notes: notes || null,
        })
        .eq("id", report.id);
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
          <DialogTitle>{t("ppic_correction")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("qty_processed")}</Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>{t("qty_reject")}</Label>
            <Input
              type="number"
              value={reject}
              onChange={(e) => setReject(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label>{t("ppic_correction")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
