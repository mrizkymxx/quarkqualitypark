import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculator, RotateCcw, Ruler } from "lucide-react";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/kalkulator")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <Page />
      </AppLayout>
    </RequireAuth>
  ),
});

type Result = {
  dimensiBox: string;
  panjangBahan: number;
  lebarBahan: number;
  creasing: number;
  tinggi: number;
};

function hitung(P: number, L: number, T: number): Result {
  // Input dalam mm (formula asli menggunakan cm, dikonversi: *10 → +30/+2/+1)
  const panjangBahan = Math.floor((P + L) * 2 + 30);  // ((P+L)*2 + 3cm) dalam mm
  const lebarBahan   = Math.floor(L + T + 2);           // (L+T+0.2cm) dalam mm
  const creasing     = Math.floor(L / 2 + 1);           // (L/2+0.1cm) dalam mm
  return {
    dimensiBox: `${Math.floor(P)} × ${Math.floor(L)} × ${Math.floor(T)}`,
    panjangBahan,
    lebarBahan,
    creasing,
    tinggi: Math.floor(T),
  };
}

function Page() {
  const { t } = useI18n();
  const [P, setP] = useState("");
  const [L, setL] = useState("");
  const [T, setT] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const onHitung = (e: React.FormEvent) => {
    e.preventDefault();
    const pNum = parseFloat(P);
    const lNum = parseFloat(L);
    const tNum = parseFloat(T);
    if (!pNum || !lNum || !tNum || pNum <= 0 || lNum <= 0 || tNum <= 0) {
      setError(t("calc_error"));
      setResult(null);
      return;
    }
    setError("");
    setResult(hitung(pNum, lNum, tNum));
  };

  const onReset = () => {
    setP(""); setL(""); setT("");
    setResult(null); setError("");
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" />
          {t("calc_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("calc_subtitle")}</p>
      </div>

      {/* Input Card */}
      <Card className="p-5">
        <form onSubmit={onHitung} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["p", "l", "t"] as const).map((key) => {
              const val = key === "p" ? P : key === "l" ? L : T;
              const setter = key === "p" ? setP : key === "l" ? setL : setT;
              const label = key === "p" ? t("calc_panjang") : key === "l" ? t("calc_lebar") : t("calc_tinggi");
              const id = `inp-${key}`;
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={id}
                      type="number"
                      min="1"
                      step="0.1"
                      placeholder="0"
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      className="pr-10 text-center font-mono text-base"
                      required
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              <Calculator className="h-4 w-4 mr-1.5" /> {t("calc_hitung")}
            </Button>
            <Button type="button" variant="outline" onClick={onReset} title={t("calc_reset")}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>

      {/* Result Card */}
      {result && (
        <Card className="p-5 space-y-4">
          {/* Dimensi box */}
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{t("calc_dimensi")}:</span>
            <span className="font-bold text-sm">{result.dimensiBox} mm</span>
          </div>

          {/* Ukuran sheet — bintang utama */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              {t("calc_sheet")}
            </div>
            <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 justify-center">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase">{t("calc_panjang")}</div>
                <div className="text-4xl font-black text-primary tabular-nums leading-none">{result.panjangBahan}</div>
                <div className="text-[10px] text-muted-foreground">mm</div>
              </div>
              <div className="text-2xl text-muted-foreground font-light">×</div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase">{t("calc_lebar")}</div>
                <div className="text-4xl font-black text-primary tabular-nums leading-none">{result.lebarBahan}</div>
                <div className="text-[10px] text-muted-foreground">mm</div>
              </div>
            </div>
          </div>

          {/* Creasing */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              {t("calc_creasing")}
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[result.creasing, result.tinggi, result.creasing].map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="bg-muted rounded-lg px-4 py-2 text-center min-w-[64px]">
                    <div className="text-xl font-bold tabular-nums">{val}</div>
                    <div className="text-[10px] text-muted-foreground">mm</div>
                  </div>
                  {i < 2 && <div className="text-muted-foreground text-lg font-light">|</div>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-2">{t("calc_creasing_note")}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
