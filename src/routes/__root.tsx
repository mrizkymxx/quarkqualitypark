import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Halaman Tidak Ditemukan</h2>
      <p className="text-muted-foreground mb-8">Maaf, halaman yang Anda tuju tidak tersedia atau telah dipindahkan.</p>
      <Link 
        to="/" 
        className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PPIC Karton — Sistem Perencanaan Produksi" },
      {
        name: "description",
        content:
          "Sistem PPIC untuk pabrik karton: kelola Sales Order, workflow produksi, dan laporan shift secara real-time.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
