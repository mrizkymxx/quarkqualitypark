import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Factory } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      const t = setTimeout(() => navigate({ to: "/" }), 0);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) toast.error(res.error);
  };

  if (!mounted) return null;

  return (
    <div suppressHydrationWarning className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary">
      <header className="flex justify-between items-center px-4 md:px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-gradient-industrial flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold">{t("app_name")}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 md:p-8 shadow-industrial">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{t("signin_title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("signin_sub")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="em">{t("email")}</Label>
              <Input
                id="em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">{t("password")}</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-industrial text-primary-foreground"
              disabled={loading}
            >
              {loading ? "..." : t("login")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
