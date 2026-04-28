import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
    const a: { type: string; msg: string; severity: "danger" | "warning" | "info" }[] = [];
    sos.forEach((s) => {
      if (s.status !== "selesai" && s.due_date && s.due_date < today) {
        a.push({
          type: "late",
          msg: `${s.so_number} • ${s.client_name} terlambat`,
          severity: "danger",
        });
      }
    });
    stages.forEach((s) => {
      if (s.pending_ppic_review) {
        a.push({
          type: "review",
          msg: `Tahap "${s.stage_name}" menunggu konfirmasi PPIC`,
          severity: "warning",
        });
      }
    });
    return a.slice(0, 8);
  }, [sos, stages, today]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("nav_dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
        </div>
      </div>

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

      {/* Activity + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> {t("dash_machine_activity")}
          </h2>
          {machines.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2">{t("machine")}</th>
                    <th className="pb-2">{t("division")}</th>
                    <th className="pb-2">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m: any) => {
                    const busy = shiftReports.find((r) => r.machine_id === m.id);
                    return (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{m.name}</td>
                        <td className="py-2 text-muted-foreground">
                          {m.divisions?.name ?? "—"}
                        </td>
                        <td className="py-2">
                          {busy ? (
                            <span className="inline-flex items-center gap-1 text-success text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Aktif • {busy.operator_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive text-xs">
                              <XCircle className="h-3 w-3" /> Idle
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4" /> {t("dash_alerts")}
          </h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_data")}</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs p-2 rounded border-l-2",
                    a.severity === "danger" && "border-destructive bg-destructive/5",
                    a.severity === "warning" && "border-warning bg-warning/5",
                    a.severity === "info" && "border-info bg-info/5",
                  )}
                >
                  {a.msg}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
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
