import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

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
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">{t("nav_po")}</h1>
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Modul Purchase Order & Material Tracking — segera hadir.
      </Card>
    </div>
  );
}
