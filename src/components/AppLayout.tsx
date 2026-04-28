import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Workflow,
  ClipboardList,
  ClipboardCheck,
  Settings,
  LogOut,
  Factory,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof LayoutDashboard; key: string; roles?: string[] };

const NAV: NavItem[] = [
  { to: "/", icon: LayoutDashboard, key: "nav_dashboard" },
  { to: "/sales-orders", icon: ShoppingCart, key: "nav_so", roles: ["ppic", "manager"] },
  { to: "/purchase-orders", icon: Package, key: "nav_po", roles: ["ppic", "manager"] },
  { to: "/spk", icon: FileText, key: "nav_spk", roles: ["ppic", "manager"] },
  { to: "/workflow", icon: Workflow, key: "nav_workflow", roles: ["ppic", "manager"] },
  { to: "/tasks", icon: ClipboardList, key: "nav_tasks", roles: ["operator", "ppic"] },
  { to: "/shift-reports", icon: ClipboardCheck, key: "nav_shift", roles: ["operator", "ppic", "manager"] },
  { to: "/settings", icon: Settings, key: "nav_settings", roles: ["ppic"] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { profile, signOut, roles, isOperator } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV.filter(
    (n) => !n.roles || n.roles.some((r) => roles.includes(r as any)),
  );

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  // Mobile bottom nav (operator-friendly)
  const mobileBottomNav = isOperator ? visibleNav.slice(0, 4) : visibleNav.slice(0, 5);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-gradient-industrial flex items-center justify-center">
              <Factory className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm">{t("app_name")}</div>
              <div className="text-[10px] text-sidebar-foreground/60">PPIC System</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {profile?.full_name || profile?.email}
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-2"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-gradient-industrial flex items-center justify-center">
                <Factory className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">{t("app_name")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-sidebar-border grid grid-cols-5">
          {mobileBottomNav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/70",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-[60px]">{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  <span className="font-bold">{t("app_name")}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-1">
                {visibleNav.map((n) => {
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm",
                        isActive(n.to)
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "hover:bg-sidebar-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(n.key)}
                    </Link>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                className="justify-start text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t("logout")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
