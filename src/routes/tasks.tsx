import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StageStatusBadge } from "@/components/StatusBadges";

export const Route = createFileRoute("/tasks")({
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
  const { profile } = useAuth();
  const divId = profile?.division_id;
  const { data: stages = [] } = useQuery({
    queryKey: ["my-tasks", divId],
    enabled: !!divId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_stages")
        .select("*, sales_orders(so_number,client_name,product_name,due_date)")
        .eq("division_id", divId!)
        .neq("status", "selesai");
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">{t("nav_tasks")}</h1>
      {!divId ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Akun Anda belum ditugaskan ke divisi. Hubungi PPIC.
        </Card>
      ) : stages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("no_data")}</Card>
      ) : (
        <div className="space-y-3">
          {stages.map((s: any) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">{s.sales_orders?.so_number}</div>
                  <div className="font-semibold">{s.stage_name}</div>
                  <div className="text-sm">{s.sales_orders?.product_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("due_date")}: {formatDate(s.sales_orders?.due_date)}
                  </div>
                </div>
                <StageStatusBadge status={s.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
