// S06 Catalog page (T026): category tabs, search input, stage groupings,
// and accessible locked/available status indicators.
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type LessonCardDto } from "../api.ts";
import { ChildShell } from "./child-home.tsx";
import { Card, DemoBadge, TextInput } from "../components/ui.tsx";

const CATEGORY_TABS = [
  { key: "all", label: "Semua" },
  { key: "listening", label: "Huruf" },
  { key: "surah", label: "Surat Pendek" },
  { key: "quiz", label: "Kuis" },
  { key: "game", label: "Main" },
] as const;

export function CatalogPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const catalog = useQuery({
    queryKey: ["catalog", search, selectedType],
    queryFn: () => {
      const url = new URL("/api/v1/catalog", window.location.origin);
      if (search) url.searchParams.set("search", search);
      if (selectedType !== "all") url.searchParams.set("lesson_type", selectedType);
      return fetch(url.toString(), { credentials: "same-origin" }).then((r) => r.json() as Promise<{ items: LessonCardDto[] }>);
    },
  });

  const items = catalog.data?.items ?? [];

  return (
    <ChildShell activeTab="belajar">
      <main className="mx-auto max-w-[680px] px-4 pt-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-extrabold text-ink">Belajar</h1>
            <p className="text-[14px] text-muted">Pilih materi belajar yang ingin kamu latih hari ini</p>
          </div>
          <Link
            to="/gerbang-orang-tua"
            className="btn-touch flex items-center px-4 rounded-full bg-surface border border-border-soft text-[14px] font-bold text-muted"
          >
            Orang tua
          </Link>
        </header>

        {/* Search bar */}
        <div className="mt-4">
          <TextInput
            type="search"
            placeholder="Cari materi belajar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-2xl"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori materi">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selectedType === tab.key}
              onClick={() => setSelectedType(tab.key)}
              className={`btn-touch whitespace-nowrap rounded-full px-5 text-[15px] font-extrabold border transition-colors ${
                selectedType === tab.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-muted border-border-soft hover:bg-mint/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Catalog items list */}
        <div className="mt-5 grid gap-4">
          {catalog.isPending ? <p className="text-muted font-bold">Sedang memuat materi…</p> : null}
          {catalog.isError ? (
            <Card>
              <p className="font-bold text-error">Tidak dapat memuat materi belajar.</p>
            </Card>
          ) : null}

          {items.length === 0 && !catalog.isPending ? (
            <Card className="text-center py-8">
              <p className="text-[17px] font-bold">Materi belum ditemukan</p>
              <p className="mt-1 text-[14px] text-muted">Coba cari dengan kata kunci lain atau pilih kategori Semua.</p>
            </Card>
          ) : null}

          {items.map((item) => {
            const isLocked = item.access === "locked";
            return (
              <Card
                key={item.lesson_id}
                className={`relative transition-all ${
                  isLocked ? "opacity-75 bg-page border-dashed" : "hover:shadow-md"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-extrabold uppercase tracking-wide text-primary">
                    {item.lesson_type === "surah"
                      ? "Surat Pendek"
                      : item.lesson_type === "quiz"
                      ? "Kuis Pemahaman"
                      : item.lesson_type === "game"
                      ? "Permainan Suara"
                      : "Mengenal Huruf"}
                  </span>
                  {item.demo_only ? <DemoBadge /> : null}
                </div>

                <h2 className="mt-1 text-[18px] font-extrabold text-ink">{item.title}</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {item.practice.completed_units} dari {item.practice.required_units} langkah dilatih · sekitar {item.estimated_minutes} menit
                </p>

                {/* Progress bar */}
                <div
                  className="mt-3 h-2.5 rounded-full bg-page border border-border-soft overflow-hidden"
                  role="progressbar"
                  aria-valuenow={item.practice.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-primary" style={{ width: `${item.practice.percent}%` }} />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-muted">
                    {item.practice.percent === 100
                      ? "Selesai dilatih ⭐"
                      : item.practice.percent > 0
                      ? `Latihan ${item.practice.percent}%`
                      : "Belum dilatih"}
                  </span>

                  {isLocked ? (
                    <span className="btn-touch flex items-center px-4 rounded-full bg-muted/20 text-[14px] font-bold text-muted">
                      🔒 Terkunci
                    </span>
                  ) : (
                    <Link
                      to={`/anak/belajar/${item.lesson_id}`}
                      className="btn-touch inline-flex items-center justify-center rounded-full bg-primary text-white px-5 text-[15px] font-bold hover:bg-primary-hover"
                    >
                      {item.practice.percent > 0 ? "Lanjut" : "Mulai"}
                    </Link>
                  )}
                </div>

                {isLocked ? (
                  <p className="mt-2 text-[12px] text-muted">
                    Selesaikan materi dasar terlebih dahulu atau minta orang tua membuka tahap ini di pengaturan.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </main>
    </ChildShell>
  );
}
