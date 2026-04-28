import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user && pathname !== "/auth") {
      const t = setTimeout(() => navigate({ to: "/auth" }), 0);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" suppressHydrationWarning>
        <div className="text-muted-foreground text-sm" suppressHydrationWarning>Loading...</div>
      </div>

    );
  }
  if (!user) return null;
  return <>{children}</>;
}
