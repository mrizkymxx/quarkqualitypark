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

  const { data: dbStages = [] } = useQuery({
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
    setStages(dbStages);
    setDirty(false);
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/sales-orders" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{t("so_number")}</div>
            <h1 className="text-2xl font-bold">{so.so_number}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {so.client_name} • {so.product_name}
              {so.product_type && ` • ${so.product_type}`}
            </div>
            <div className="text-sm mt-2">
              {t("quantity")}: <span className="font-medium">{so.quantity}</span>
              {" • "}
              {t("due_date")}: <span className="font-medium">{formatDate(so.due_date)}</span>
            </div>
            {so.notes && <p className="text-xs text-muted-foreground mt-2">{so.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <SOStatusBadge status={so.status} />
            {isPPIC && (
              <Select value={so.status} onValueChange={updateSOStatus}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`so_status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {so.needs_client_confirmation && (
          <div className="mt-3 p-2 rounded bg-warning/10 border border-warning/30 flex items-start gap-2 text-xs">
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

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-semibold text-lg">{t("workflow_setup")}</h2>
            <p className="text-xs text-muted-foreground">
              {stages.length} {t("workflow_stages")}
            </p>
          </div>
          {isPPIC && (
            <div className="flex flex-wrap gap-2">
              <AddStageButton onAdd={addStage} />
              {dirty && (
                <Button onClick={saveWorkflow} className="bg-accent text-accent-foreground">
                  <Save className="h-4 w-4 mr-1" /> {t("save")}
                </Button>
              )}
            </div>
          )}
        </div>

        {stages.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
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
