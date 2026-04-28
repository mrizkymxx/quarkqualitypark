import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type SOStatus = Database["public"]["Enums"]["so_status"];
type StageStatus = Database["public"]["Enums"]["stage_status"];

const SO_COLORS: Record<SOStatus, string> = {
  menunggu_konfirmasi: "bg-muted text-muted-foreground",
  dikonfirmasi: "bg-info/15 text-info border-info/30",
  menunggu_bahan: "bg-warning/15 text-warning-foreground border-warning/40",
  siap_produksi: "bg-primary/10 text-primary border-primary/30",
  dalam_produksi: "bg-accent/15 text-accent-foreground border-accent/40",
  selesai: "bg-success/15 text-success border-success/30",
};

const STAGE_COLORS: Record<StageStatus, string> = {
  belum_mulai: "bg-muted text-muted-foreground",
  sedang_berjalan: "bg-info/15 text-info border-info/30",
  selesai: "bg-success/15 text-success border-success/30",
  ditunda: "bg-warning/15 text-warning-foreground border-warning/40",
};

export function SOStatusBadge({ status }: { status: SOStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={`${SO_COLORS[status]} border font-medium`}>
      {t(`so_status_${status}`)}
    </Badge>
  );
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={`${STAGE_COLORS[status]} border font-medium`}>
      {t(`stage_status_${status}`)}
    </Badge>
  );
}

export const SO_STATUSES: SOStatus[] = [
  "menunggu_konfirmasi",
  "dikonfirmasi",
  "menunggu_bahan",
  "siap_produksi",
  "dalam_produksi",
  "selesai",
];
