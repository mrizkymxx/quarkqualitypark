import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { SOStatusBadge } from "@/components/StatusBadges";
import { Workflow as WfIcon } from "lucide-react";

export const Route = createFileRoute("/workflow")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <Page />
      </AppLayout>
    </RequireAuth>
  ),
});

function Page() {
  const { t } = useI18n();
  const { data: sos = [] } = useQuery({
    queryKey: ["wf-sos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("*")
        .neq("status", "selesai")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("nav_workflow")}</h1>
        <p className="text-sm text-muted-foreground">Pilih SO untuk mengatur workflow produksi.</p>
      </div>
      {sos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("no_data")}</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sos.map((s) => (
            <Link key={s.id} to="/sales-orders/$soId" params={{ soId: s.id }}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{s.so_number}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.client_name}</div>
                    <div className="text-sm truncate">{s.product_name}</div>
                  </div>
                  <WfIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-2"><SOStatusBadge status={s.status} /></div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
