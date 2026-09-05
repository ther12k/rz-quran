import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { api, ApiError, type Me } from "./api.ts";
import { LandingPage } from "./pages/landing.tsx";
import { AuthPage } from "./pages/auth.tsx";
import { OnboardingPage } from "./pages/onboarding.tsx";
import { ChildHomePage } from "./pages/child-home.tsx";
import { CatalogPage } from "./pages/catalog.tsx";
import { LessonPlayerPage } from "./pages/lesson-player.tsx";
import { GatePage } from "./pages/gate.tsx";
import { ParentProgressPage } from "./pages/parent-progress.tsx";
import { AdminWorkspacePage } from "./pages/admin.tsx";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } },
});

function useMe() {
  return useQuery<Me, ApiError>({ queryKey: ["me"], queryFn: api.me });
}

function ModeRouter() {
  const me = useMe();
  const qc = useQueryClient();
  const location = useLocation();
  const path = location.pathname;

  const refreshMe = () => {
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.refetchQueries({ queryKey: ["me"] });
  };

  if (me.isPending) {
    return (
      <div className="min-h-dvh grid place-items-center bg-page text-muted font-bold" role="status">
        Sedang menyiapkan…
      </div>
    );
  }
  if (me.isError) {
    if (me.error.status === 401) {
      if (path === "/masuk" || path === "/daftar") {
        return <AuthPage stage="signin" onDone={refreshMe} />;
      }
      if (path === "/" || path.startsWith("/privasi") || path.startsWith("/sumber")) {
        return <LandingPage signedOut />;
      }
      return <Navigate to="/masuk" replace />;
    }
    return (
      <div className="min-h-dvh grid place-items-center bg-page p-6 text-center">
        <p className="font-bold">Tidak dapat terhubung ke server.</p>
        <p className="text-muted">Pastikan API berjalan, lalu muat ulang.</p>
      </div>
    );
  }

  const data = me.data;

  // Public pages.
  if (path === "/" || path.startsWith("/privasi") || path.startsWith("/sumber")) {
    return <LandingPage signedIn={Boolean(data)} />;
  }

  if (!data.email_verified) {
    if (path.startsWith("/verifikasi")) return <AuthPage stage="verify-pending" />;
    return <Navigate to="/verifikasi" replace />;
  }

  // Parent gate is reachable from child mode (to exit to parent area)
  // or parent mode (when gate has expired).
  if (path.startsWith("/gerbang-orang-tua")) {
    return <GatePage onUnlocked={refreshMe} />;
  }

  if (data.mode === "child") {
    // Child mode: only child routes render. Parent URLs never render here.
    if (path.startsWith("/anak/")) {
      return (
        <Routes>
          <Route path="/anak/beranda" element={<ChildHomePage onExit={refreshMe} />} />
          <Route path="/anak/belajar" element={<CatalogPage />} />
          <Route path="/anak/belajar/:lessonId" element={<LessonPlayerPage onChanged={refreshMe} />} />
          <Route path="/anak/*" element={<Navigate to="/anak/beranda" replace />} />
        </Routes>
      );
    }
    return <Navigate to="/anak/beranda" replace />;
  }

  // Parent mode: requires active gate.
  if (path.startsWith("/orang-tua/")) {
    if (!data.parent_gate_until || new Date(data.parent_gate_until).getTime() <= Date.now()) {
      return <Navigate to="/gerbang-orang-tua" replace />;
    }
    if (path.startsWith("/orang-tua/anak/") && path.endsWith("/progres")) {
      return (
        <Routes>
          <Route path="/orang-tua/anak/:childId/progres" element={<ParentProgressPage />} />
        </Routes>
      );
    }
    if (!data.effective_consent) {
      return <OnboardingPage stage="consent" onDone={refreshMe} />;
    }
    return <OnboardingPage stage="children" onDone={refreshMe} />;
  }

  // Staff Admin Area
  if (path.startsWith("/admin")) {
    return <AdminWorkspacePage />;
  }

  if (path.startsWith("/masuk") || path.startsWith("/daftar")) {
    return <AuthPage stage="signin" onDone={refreshMe} />;
  }

  // Signed-in parent default: continue onboarding or manage.
  return <Navigate to={data.effective_consent ? "/orang-tua/anak" : "/orang-tua/mulai"} replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ModeRouter />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// T056: installable shell. Service worker caches ONLY the static shell;
// /api/* and media are never intercepted (FR-16).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure is non-fatal; the app remains fully usable online.
    });
  });
}
