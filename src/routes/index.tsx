import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";


import {
  ShoppingCart,
  AlertTriangle,
  Activity,
  XCircle,
  Bell,
  CheckCircle2,
} from "lucide-react";

import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SOStatusBadge, SO_STATUSES } from "@/components/StatusBadges";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <Dashboard />
      </AppLayout>
    </RequireAuth>
  ),
});

function Dashboard() {
  const { t, formatDate } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const { data: sos = [] } = useQuery({
    queryKey: ["dash-sos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["dash-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_stages").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["dash-machines"],
    queryFn: async () => {
      const { data } = await supabase
        .from("machines")
        .select("*, divisions(name)")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: shiftReports = [] } = useQuery({
    queryKey: ["dash-shifts", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_reports")
        .select("*")
        .eq("report_date", today);
      return data ?? [];
    },
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["dash-pos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, expected_arrival, ordered_quantity, supplier_name, sales_order_id")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["dash-deliveries"],
    queryFn: async () => {
      const { data } = await supabase.from("material_deliveries").select("purchase_order_id, quantity_received");
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const active = sos.filter((s) => s.status !== "selesai").length;
    const late = sos.filter(
      (s) => s.status !== "selesai" && s.due_date && s.due_date < today,
    ).length;
    const reject = shiftReports.reduce((a, r) => a + Number(r.qty_reject ?? 0), 0);
    const busyMachineIds = new Set(
      shiftReports.map((r) => r.machine_id).filter(Boolean),
    );
    const idle = machines.filter((m) => !busyMachineIds.has(m.id)).length;
    return { active, late, reject, idle };
  }, [sos, shiftReports, machines, today]);

  const stagesBySO = useMemo(() => {
    const m = new Map<string, typeof stages>();
    for (const s of stages) {
      const arr = m.get(s.sales_order_id) ?? [];
      arr.push(s);
      m.set(s.sales_order_id, arr);
    }
    return m;
  }, [stages]);

  const sosByStatus = useMemo(() => {
    const m = new Map<string, typeof sos>();
    for (const s of sos) {
      const arr = m.get(s.status) ?? [];
      arr.push(s);
      m.set(s.status, arr);
    }
    return m;
  }, [sos]);

  const alerts = useMemo(() => {
    const a: { type: string; msg: string; severity: "danger" | "warning" | "info"; soId?: string; toPO?: boolean }[] = [];
    const nowMs = new Date().setHours(0, 0, 0, 0);

    // SO overdue / near deadline
    sos.forEach((s) => {
      if (s.status === "selesai" || !s.due_date) return;
      const diff = Math.round((new Date(s.due_date).setHours(0,0,0,0) - nowMs) / 86400000);
      const label = diff === 0 ? t("deadline_today") : `${diff} ${t("deadline_days_left")}`;
      if (diff < 0)
        a.push({ type: "so-late", msg: `⚠ SO ${s.so_number} — ${t("alert_so_late_label")} ${Math.abs(diff)} ${t("deadline_days_left")}`, severity: "danger", soId: s.id });
      else if (diff <= 3)
        a.push({ type: "so-warn", msg: `🔔 SO ${s.so_number} — deadline ${label}`, severity: "warning", soId: s.id });
    });

    // PO bahan — berdasarkan SO due_date (bahan harus siap 5 hari sebelum SO deadline)
    const receivedMap: Record<string, number> = {};
    for (const d of deliveries) {
      receivedMap[(d as any).purchase_order_id] = (receivedMap[(d as any).purchase_order_id] || 0) + Number((d as any).quantity_received);
    }
    pos.forEach((p: any) => {
      const received = receivedMap[p.id] || 0;
      if (received >= Number(p.ordered_quantity)) return;
      const linkedSo = sos.find((s) => s.id === p.sales_order_id) as any;
      if (!linkedSo?.due_date || linkedSo.status === "selesai") return;
      const diff = Math.round((new Date(linkedSo.due_date).setHours(0,0,0,0) - nowMs) / 86400000);
      const label = diff === 0 ? t("deadline_today") : `${diff} ${t("deadline_days_left")}`;
      if (diff < 0)
        a.push({ type: "po-late", msg: `📦 ${p.po_number} — ${t("alert_material_not_ready")}! SO ${linkedSo.so_number} ${t("alert_so_late_label")} ${Math.abs(diff)}h`, severity: "danger", toPO: true });
      else if (diff <= 5)
        a.push({ type: "po-warn", msg: `📦 ${p.po_number} — ${t("alert_material_ready_in")} ${label} (SO: ${linkedSo.so_number})`, severity: "warning", toPO: true });
    });

    // PPIC review
    stages.forEach((s) => {
      if (s.pending_ppic_review)
        a.push({ type: "review", msg: `"${s.stage_name}" — ${t("alert_pending_ppic")}`, severity: "info", soId: s.sales_order_id });
    });
    return a.slice(0, 15);
  }, [sos, pos, deliveries, stages, t]);


  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
        </div>
      </div>

      {/* ── Panel Peringatan Collapsible ── */}
      {alerts.length > 0 && (
        <Card className={`overflow-hidden border-l-4 ${
          alerts.some(a => a.severity === "danger") ? "border-l-destructive" : "border-l-warning"
        }`}>
          {/* Header bar — always visible, click to toggle */}
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            onClick={() => setAlertsOpen(o => !o)}
          >
            <Bell className={`h-4 w-4 shrink-0 ${
              alerts.some(a => a.severity === "danger") ? "text-destructive" : "text-warning"
            }`} />
            <span className="font-semibold text-sm flex-1">{t("dash_alerts")}</span>
            <span className="flex items-center gap-1.5">
              {alerts.filter(a => a.severity === "danger").length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {alerts.filter(a => a.severity === "danger").length}
                </span>
              )}
              {alerts.filter(a => a.severity === "warning").length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning-foreground border border-warning/40">
                  <Bell className="h-2.5 w-2.5" />
                  {alerts.filter(a => a.severity === "warning").length}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-1">{alertsOpen ? "▲" : "▼"}</span>
            </span>
          </button>

          {/* Expandable list */}
          {alertsOpen && (
            <div className="px-4 pb-3 border-t">
              <ul className="space-y-1.5 mt-2">
                {alerts.map((a, i) => {
                  const inner = (
                    <div className={cn(
                      "text-xs p-2.5 rounded-md flex items-start gap-2 hover:opacity-80 transition-opacity",
                      a.severity === "danger" && "bg-destructive/10 border border-destructive/20 text-destructive",
                      a.severity === "warning" && "bg-warning/10 border border-warning/20 text-warning-foreground",
                      a.severity === "info" && "bg-muted border border-border text-muted-foreground",
                    )}>
                      {a.severity === "danger" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      {a.severity === "warning" && <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      {a.severity === "info" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      <span className="font-medium">{a.msg}</span>
                    </div>
                  );
                  return (
                    <li key={i}>
                      {a.soId ? (
                        <Link to="/sales-orders/$soId" params={{ soId: a.soId }} className="block">{inner}</Link>
                      ) : a.toPO ? (
                        <Link to="/purchase-orders" className="block">{inner}</Link>
                      ) : (
                        <div className="block">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      )}



      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={ShoppingCart} label={t("dash_total_so")} value={stats.active} tone="primary" />
        <StatCard icon={AlertTriangle} label={t("dash_late_so")} value={stats.late} tone="danger" />
        <StatCard icon={Activity} label={t("dash_idle_machine")} value={stats.idle} tone="warning" />
        <StatCard icon={XCircle} label={t("dash_reject_today")} value={stats.reject} tone="info" />
      </div>

      {/* Progress board */}
      <Card className="p-4 md:p-5">
        <h2 className="font-semibold mb-4">{t("dash_progress_board")}</h2>
        {sos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SO_STATUSES.filter((s) => s !== "selesai").map((status) => {
              const items = sosByStatus.get(status) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={status}>
                  <div className="mb-2">
                    <SOStatusBadge status={status} />
                  </div>
                  <div className="space-y-2">
                    {items.map((so) => {
                      const sStages = stagesBySO.get(so.id) ?? [];
                      const done = sStages.filter((x) => x.status === "selesai").length;
                      const pct = sStages.length ? (done / sStages.length) * 100 : 0;
                      const late = so.due_date && so.due_date < today;
                      return (
                        <Link
                          key={so.id}
                          to="/sales-orders/$soId"
                          params={{ soId: so.id }}
                          className="block"
                        >
                          <div
                            className={cn(
                              "p-3 rounded-md border bg-card hover:shadow-md transition-shadow",
                              late && "border-destructive/40",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{so.so_number}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {so.client_name}
                                </div>
                                <div className="text-xs truncate">{so.product_name}</div>
                              </div>
                              {late && (
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                              )}
                            </div>
                            <div className="mt-2">
                              <Progress value={pct} className="h-1.5" />
                              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                <span>{done}/{sStages.length} {t("workflow_stages")}</span>
                                <span>{formatDate(so.due_date)}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: number;
  tone: "primary" | "danger" | "warning" | "info";
}) {
  const toneCls = {
    primary: "bg-gradient-industrial text-primary-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
  }[tone];
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn("h-11 w-11 rounded-md flex items-center justify-center shrink-0", toneCls)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </Card>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">{t("no_data")}</div>
  );
}
