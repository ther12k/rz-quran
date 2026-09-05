// S05 child home: greeting, one primary continue action, small category
// grid, honest empty states. Five-tab bottom navigation (ADR-09).
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { Button, DemoBadge } from "../components/ui.tsx";

const CATEGORIES = [
  { label: "Mendengar", to: "/anak/beranda", tint: "bg-mint" },
  { label: "Hafalan", to: "/anak/beranda", tint: "bg-lavender" },
  { label: "Huruf", to: "/anak/beranda", tint: "bg-sky" },
  { label: "Main", to: "/anak/beranda", tint: "bg-sunny" },
];

export function ChildShell({ children, activeTab }: { children: React.ReactNode; activeTab: "beranda" | "belajar" | "main" | "prestasi" | "profil" }) {
  const tabs = [
    { key: "beranda", label: "Beranda", to: "/anak/beranda" },
    { key: "belajar", label: "Belajar", to: "/anak/beranda" },
    { key: "main", label: "Main", to: "/anak/beranda" },
    { key: "prestasi", label: "Prestasi", to: "/anak/beranda" },
    { key: "profil", label: "Profil", to: "/anak/beranda" },
  ] as const;
  return (
    <div className="min-h-dvh bg-page pb-[88px] safe-bottom">
      {children}
      <nav
        aria-label="Navigasi anak"
        className="fixed bottom-0 inset-x-0 z-10 bg-surface border-t border-border-soft md:max-w-none"
      >
        <ul className="mx-auto max-w-[520px] grid grid-cols-5">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                to={t.to}
                aria-current={activeTab === t.key ? "page" : undefined}
                className={`btn-touch flex flex-col items-center justify-center gap-0.5 text-[12px] font-bold rounded-none
                  ${activeTab === t.key ? "text-primary" : "text-muted"}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function ChildHomePage({ onExit }: { onExit: () => void }) {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });
  const progress = useQuery({ queryKey: ["child-progress"], queryFn: api.childProgress });

  const nickname = me.data?.active_child_nickname ?? "Anak";
  const lesson = catalog.data?.items[0];
  const stars = progress.data?.stars ?? 0;

  return (
    <ChildShell activeTab="beranda">
      <main className="mx-auto max-w-[680px] px-4 pt-5">
        <header className="flex items-center justify-between gap-3">
          <p className="text-[20px] font-extrabold truncate">Assalamu'alaikum, {nickname}!</p>
          <Link
            to="/gerbang-orang-tua"
            className="btn-touch flex items-center px-4 rounded-full bg-surface border border-border-soft text-[14px] font-bold text-muted"
          >
            Orang tua
          </Link>
        </header>
        <p className="mt-1 text-[14px] text-muted">Sedikit demi sedikit, yuk!</p>

        <section aria-labelledby="lanjut-h" className="mt-5">
          <h2 id="lanjut-h" className="sr-only">
            Lanjut belajar
          </h2>
          {catalog.isPending ? <p className="text-muted font-semibold">Sedang menyiapkan…</p> : null}
          {catalog.isError ? <p className="text-muted font-semibold">Materi belum tersedia. Minta bantuan orang tua, ya.</p> : null}
          {lesson ? (
            <div className="rounded-[24px] bg-mint border border-border-soft p-5">
              <DemoBadge />
              <p className="mt-3 text-[13px] font-bold text-muted uppercase tracking-wide">Lanjut belajar</p>
              <p className="mt-1 text-[19px] font-extrabold leading-snug">{lesson.title}</p>
              <p className="mt-1 text-[15px] text-ink/80">
                {lesson.practice.completed_units} dari {lesson.practice.required_units} langkah dilatih · sekitar{" "}
                {lesson.estimated_minutes} menit
              </p>
              <div
                className="mt-3 h-3 rounded-full bg-surface border border-border-soft overflow-hidden"
                role="progressbar"
                aria-valuenow={lesson.practice.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progres latihan ${lesson.practice.percent} persen`}
              >
                <div className="h-full bg-primary transition-all" style={{ width: `${lesson.practice.percent}%` }} />
              </div>
              <div className="mt-4">
                <Link to={`/anak/belajar/${lesson.lesson_id}`}>
                  <Button block>{lesson.practice.percent > 0 ? "Lanjut belajar" : "Ayo mulai belajar"}</Button>
                </Link>
              </div>
            </div>
          ) : null}
          {catalog.data && catalog.data.items.length === 0 ? (
            <div className="rounded-[24px] bg-surface border border-border-soft p-5">
              <p className="font-bold">Materi belum tersedia.</p>
              <p className="text-muted text-[15px] mt-1">Minta bantuan orang tua, ya.</p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="kategori-h" className="mt-6">
          <h2 id="kategori-h" className="text-[17px] font-extrabold">
            Pilih kegiatan
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => (
              <li key={c.label}>
                <Link
                  to={c.to}
                  className={`btn-touch flex items-center justify-center rounded-[16px] ${c.tint} border border-border-soft font-extrabold text-[16px]`}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="prestasi-h" className="mt-6">
          <h2 id="prestasi-h" className="text-[17px] font-extrabold">
            Prestasi
          </h2>
          {stars === 0 ? (
            <p className="mt-2 text-muted text-[15px]">Belum ada bintang. Selesaikan satu latihan untuk bintang pertama!</p>
          ) : (
            <p className="mt-2 text-[17px] font-bold">
              <span aria-hidden="true">⭐</span> {stars} bintang latihan
            </p>
          )}
        </section>

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={onExit}>
            Selesai dulu
          </Button>
          <p className="mt-1 text-[13px] text-muted">Sudah waktunya istirahat sebentar? Tidak apa-apa.</p>
        </div>
      </main>
    </ChildShell>
  );
}
