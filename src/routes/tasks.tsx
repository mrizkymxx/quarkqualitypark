import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StageStatusBadge } from "@/components/StatusBadges";
import { Play, Pause, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type StageStatus = Database["public"]["Enums"]["stage_status"];

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
  const qc = useQueryClient();
  const divId = profile?.division_id;
  const [filter, setFilter] = useState<"active" | "all">("active");

  const { data: stages = [] } = useQuery({
    queryKey: ["my-tasks", divId, filter],
    enabled: !!divId,
    queryFn: async () => {
      let q = supabase
        .from("workflow_stages")
        .select("*, sales_orders(so_number,client_name,product_name,due_date,quantity)")
        .eq("division_id", divId!);
      if (filter === "active") q = q.neq("status", "selesai");
      const { data } = await q.order("target_start", { ascending: true });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StageStatus }) => {
      const { error } = await supabase
        .from("workflow_stages")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success(t("saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">{t("nav_tasks")}</h1>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={filter === "active" ? "default" : "outline"}
            onClick={() => setFilter("active")}
          >
            Aktif
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            {t("all")}
          </Button>
        </div>
      </div>
      {!divId ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("no_division_assigned")}
        </Card>
      ) : stages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("no_data")}
        </Card>
      ) : (
        <div className="space-y-3">
          {stages.map((s: any) => {
            const so = s.sales_orders;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      {so?.so_number} · {so?.client_name}
                    </div>
                    <div className="font-semibold">{s.stage_name}</div>
                    <div className="text-sm">
                      {so?.product_name}{" "}
                      <span className="text-muted-foreground">
                        ({so?.quantity})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <span>
                        {t("due_date")}: {formatDate(so?.due_date)}
                      </span>
                      {s.target_start && (
                        <span>
                          {t("target_start")}: {formatDate(s.target_start)}
                        </span>
                      )}
                    </div>
                  </div>
                  <StageStatusBadge status={s.status} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {s.status === "belum_mulai" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        update.mutate({ id: s.id, status: "sedang_berjalan" })
                      }
                    >
                      <Play className="h-3.5 w-3.5 mr-1" /> Mulai
                    </Button>
                  )}
                  {s.status === "sedang_berjalan" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate({ id: s.id, status: "ditunda" })
                        }
                      >
                        <Pause className="h-3.5 w-3.5 mr-1" /> Tunda
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          update.mutate({ id: s.id, status: "selesai" })
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Selesai
                      </Button>
                    </>
                  )}
                  {s.status === "ditunda" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        update.mutate({ id: s.id, status: "sedang_berjalan" })
                      }
                    >
                      <Play className="h-3.5 w-3.5 mr-1" /> Lanjut
                    </Button>
                  )}
                  {s.status === "selesai" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({ id: s.id, status: "sedang_berjalan" })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Buka Ulang
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
