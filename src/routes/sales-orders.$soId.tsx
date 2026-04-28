import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Bell,
  AlertTriangle,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { SOStatusBadge, StageStatusBadge, SO_STATUSES } from "@/components/StatusBadges";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/sales-orders/$soId")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <SODetail />
      </AppLayout>
    </RequireAuth>
  ),
});

const PRESET_STAGES = ["Splitter", "Persiapan Karet", "Cetak", "Finishing", "Jahit", "QC", "Packing"];

type StageRow = Database["public"]["Tables"]["workflow_stages"]["Row"];

function SODetail() {
  const { soId } = useParams({ from: "/sales-orders/$soId" });
  const { t, formatDate } = useI18n();
  const { isPPIC } = useAuth();
  const qc = useQueryClient();

  const { data: so } = useQuery({
    queryKey: ["so", soId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("id", soId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ["divisions"],
    queryFn: async () => {
      const { data } = await supabase.from("divisions").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data } = await supabase.from("machines").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: linkedPO } = useQuery({
    queryKey: ["so-po", soId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("sales_order_id", soId)
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: dbStages } = useQuery({
    queryKey: ["stages", soId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_stages")
        .select("*")
        .eq("sales_order_id", soId)
        .order("stage_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [stages, setStages] = useState<StageRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dbStages) {
      setStages(dbStages);
      setDirty(false);
    }
  }, [dbStages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex((s) => s.id === active.id);
    const newIdx = stages.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(stages, oldIdx, newIdx).map((s, i) => ({ ...s, stage_order: i }));
    setStages(next);
    setDirty(true);
  };

  const updateStage = (id: string, patch: Partial<StageRow>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const removeStage = (id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, stage_order: i })));
    setDirty(true);
  };

  const addStage = (name: string) => {
    const newRow: StageRow = {
      id: `tmp-${crypto.randomUUID()}`,
      sales_order_id: soId,
      stage_order: stages.length,
      stage_name: name,
      division_id: null,
      machine_id: null,
      estimated_duration_hours: null,
      target_start: null,
      target_end: null,
      status: "belum_mulai",
      notes: null,
      pending_ppic_review: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStages([...stages, newRow]);
    setDirty(true);
  };

  const saveWorkflow = async () => {
    // Strategy: delete all existing & re-insert. Simple & reliable for small lists.
    const { error: delErr } = await supabase.from("workflow_stages").delete().eq("sales_order_id", soId);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const payload = stages.map((s, i) => ({
      sales_order_id: soId,
      stage_order: i,
      stage_name: s.stage_name,
      division_id: s.division_id,
      machine_id: s.machine_id,
      estimated_duration_hours: s.estimated_duration_hours,
      target_start: s.target_start,
      target_end: s.target_end,
      status: s.status,
      notes: s.notes,
    }));
    if (payload.length > 0) {
      const { error } = await supabase.from("workflow_stages").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Workflow tersimpan");
    qc.invalidateQueries({ queryKey: ["stages", soId] });
  };

  const updateSOStatus = async (status: any) => {
    const { error } = await supabase.from("sales_orders").update({ status }).eq("id", soId);
    if (error) toast.error(error.message);
    else {
      toast.success("Status diperbarui");
      qc.invalidateQueries({ queryKey: ["so", soId] });
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
    }
  };

  if (!so)
    return (
      <div className="text-sm text-muted-foreground">{t("loading")}</div>
    );

  // Parse P × L from linked PO notes
  const pMatch = (linkedPO as any)?.notes?.match(/P:\s*([\d.]+)\s*mm/i);
  const lMatch = (linkedPO as any)?.notes?.match(/L:\s*([\d.]+)\s*mm/i);
  const pVal = pMatch?.[1];
  const lVal = lMatch?.[1];

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link to="/sales-orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      {/* ── Header Card ── */}
      <Card className="p-4 space-y-3">
        {/* Row 1: Nomor & status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">No. SPK / SO</div>
            <div className="text-xl font-black leading-tight">{so.so_number}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{so.client_name}</div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <SOStatusBadge status={so.status} />
            {isPPIC && (
              <Select value={so.status} onValueChange={updateSOStatus}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`so_status_${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Deadline alert */}
        {(() => {
          if (!so.due_date || so.status === "selesai") return null;
          const today = new Date(); today.setHours(0,0,0,0);
          const due = new Date(so.due_date); due.setHours(0,0,0,0);
          const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
          if (diff < 0) return (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/40 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              ⚠ {t("alert_so_late_label")} {Math.abs(diff)} {t("deadline_days_left")}!
            </div>
          );
          if (diff <= 3) return (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/30 text-xs font-semibold text-warning-foreground">
              <Bell className="h-4 w-4 shrink-0" />
              🔔 {diff === 0 ? t("deadline_today") + "!" : `${diff} ${t("deadline_days_left")}!`}
            </div>
          );
          return null;
        })()}

        {/* Row 2: P × L + info material */}
        {(pVal || lVal) && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-center gap-2">
              {pVal && (
                <div className="text-center">
                  <div className="text-[9px] text-muted-foreground font-semibold uppercase">P</div>
                  <div className="text-2xl font-black text-primary tabular-nums leading-none">{pVal}</div>
                  <div className="text-[9px] text-muted-foreground">mm</div>
                </div>
              )}
              {pVal && lVal && <div className="text-xl text-muted-foreground">×</div>}
              {lVal && (
                <div className="text-center">
                  <div className="text-[9px] text-muted-foreground font-semibold uppercase">L</div>
                  <div className="text-2xl font-black text-primary tabular-nums leading-none">{lVal}</div>
                  <div className="text-[9px] text-muted-foreground">mm</div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{(linkedPO as any)?.material_type}</div>
              <div className="text-[11px] text-muted-foreground truncate">{(linkedPO as any)?.po_number}</div>
              {(linkedPO as any)?.supplier_name && (
                <div className="text-[11px] text-muted-foreground">{(linkedPO as any).supplier_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Produk */}
        <div className="border-t pt-3">
          <div className="font-semibold text-sm">{so.product_name}</div>
          {so.product_type && (
            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{so.product_type}</div>
          )}
          {(so as any).customer_po_number && (
            <div className="text-xs text-muted-foreground mt-1">
              PO Klien: <span className="font-medium text-foreground">{(so as any).customer_po_number}</span>
            </div>
          )}
        </div>

        {/* Row 4: Qty, Due date, Tgl SPK */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t pt-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("quantity")}</div>
            <div className="font-bold text-base tabular-nums">{so.quantity}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("due_date")}</div>
            <div className="font-bold text-base">{formatDate(so.due_date)}</div>
          </div>
          {(so as any).schedule_date && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tgl. SPK</div>
              <div className="font-bold text-base">{formatDate((so as any).schedule_date)}</div>
            </div>
          )}
        </div>

        {/* Notes */}
        {so.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2 leading-relaxed">{so.notes}</p>
        )}

        {/* Konfirmasi klien */}
        {so.needs_client_confirmation && (
          <div className="p-2 rounded bg-warning/10 border border-warning/30 flex items-start gap-2 text-xs">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning-foreground">{t("needs_client_confirmation")}</div>
              {so.client_confirmation_notes && (
                <div className="text-muted-foreground">{so.client_confirmation_notes}</div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Workflow Stages Card ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-semibold">{t("workflow_setup")}</h2>
            <p className="text-xs text-muted-foreground">{stages.length} {t("workflow_stages")}</p>
          </div>
          {isPPIC && (
            <div className="flex gap-2">
              <AddStageButton onAdd={addStage} />
              {dirty && (
                <Button onClick={saveWorkflow} size="sm" className="bg-accent text-accent-foreground">
                  <Save className="h-4 w-4 mr-1" /> {t("save")}
                </Button>
              )}
            </div>
          )}
        </div>

        {stages.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Belum ada tahap. {isPPIC ? "Tambah tahap untuk memulai." : ""}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <SortableStageCard
                    key={s.id}
                    stage={s}
                    index={i}
                    divisions={divisions}
                    machines={machines}
                    canEdit={isPPIC}
                    onChange={(patch) => updateStage(s.id, patch)}
                    onRemove={() => removeStage(s.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    </div>
  );
}

function AddStageButton({ onAdd }: { onAdd: (name: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-1" /> {t("workflow_add_stage")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workflow_add_stage")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Preset</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESET_STAGES.map((p) => (
                <Button
                  key={p}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onAdd(p);
                    setOpen(false);
                  }}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Custom</Label>
            <div className="flex gap-2">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("stage_name")} />
              <Button
                onClick={() => {
                  if (custom.trim()) {
                    onAdd(custom.trim());
                    setCustom("");
                    setOpen(false);
                  }
                }}
              >
                {t("add")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableStageCard({
  stage,
  index,
  divisions,
  machines,
  canEdit,
  onChange,
  onRemove,
}: {
  stage: StageRow;
  index: number;
  divisions: any[];
  machines: any[];
  canEdit: boolean;
  onChange: (patch: Partial<StageRow>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const filteredMachines = stage.division_id
    ? machines.filter((m) => m.division_id === stage.division_id)
    : machines;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-md bg-card p-3 flex flex-col md:flex-row gap-3"
    >
      <div className="flex md:flex-col items-center md:items-start gap-2 md:w-10 md:pt-1.5">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground hover:text-foreground touch-none"
            aria-label="Drag"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2 md:col-span-2">
          <Label className="text-[10px] text-muted-foreground">{t("stage_name")}</Label>
          <Input
            value={stage.stage_name}
            onChange={(e) => onChange({ stage_name: e.target.value })}
            disabled={!canEdit}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{t("division")}</Label>
          <Select
            value={stage.division_id ?? "none"}
            onValueChange={(v) => onChange({ division_id: v === "none" ? null : v, machine_id: null })}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{t("machine")}</Label>
          <Select
            value={stage.machine_id ?? "none"}
            onValueChange={(v) => onChange({ machine_id: v === "none" ? null : v })}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {filteredMachines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{t("duration_hours")}</Label>
          <Input
            type="number"
            value={stage.estimated_duration_hours ?? ""}
            onChange={(e) =>
              onChange({ estimated_duration_hours: e.target.value ? Number(e.target.value) : null })
            }
            disabled={!canEdit}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{t("target_start")}</Label>
          <Input
            type="date"
            value={stage.target_start ?? ""}
            onChange={(e) => onChange({ target_start: e.target.value || null })}
            disabled={!canEdit}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{t("target_end")}</Label>
          <Input
            type="date"
            value={stage.target_end ?? ""}
            onChange={(e) => onChange({ target_end: e.target.value || null })}
            disabled={!canEdit}
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <Label className="text-[10px] text-muted-foreground">{t("notes")}</Label>
          <Textarea
            value={stage.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            disabled={!canEdit}
            rows={1}
            className="text-sm min-h-8"
          />
        </div>
        <div className="col-span-2 md:col-span-2 flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[10px] text-muted-foreground">{t("status")}</Label>
            <Select
              value={stage.status}
              onValueChange={(v) => onChange({ status: v as any })}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["belum_mulai","sedang_berjalan","selesai","ditunda"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`stage_status_${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex md:flex-col items-end justify-between md:w-32 gap-2 shrink-0">
        <StageStatusBadge status={stage.status} />
        {stage.pending_ppic_review && (
          <span className="text-[10px] text-warning-foreground bg-warning/20 px-2 py-0.5 rounded inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Review
          </span>
        )}
      </div>
    </div>
  );
}
