// S16 / S17 / S18 Parent Dashboard & Controls (M2):
// - T024: Real progress data with denominators, weekly chart & table
// - T037: Parent memorization observations (needs_practice, developing, parent_confirmed)
// - T040: Child comfort settings (goal minutes 5/10/15, quiet, reduced motion)
// - T072: Parent stage overrides (unlock stage 3)
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { Button, Card, DemoBadge, ErrorNote, Field } from "../components/ui.tsx";

function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 menit";
  return `${minutes} menit`;
}

const DAY_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const SURAHS = [
  { chapter: 1, name: "Al-Fatihah" },
  { chapter: 108, name: "Al-Kautsar" },
  { chapter: 112, name: "Al-Ikhlas" },
  { chapter: 113, name: "Al-Falaq" },
  { chapter: 114, name: "An-Nas" },
];

export function ParentProgressPage() {
  const { childId = "" } = useParams();
  const [tab, setTab] = useState<"progress" | "assessment" | "settings">("progress");

  const progress = useQuery({
    queryKey: ["parent-progress", childId],
    queryFn: () => api.parentProgress(childId),
    enabled: childId !== "",
  });

  const assessments = useQuery({
    queryKey: ["parent-assessments", childId],
    queryFn: () =>
      fetch(`/api/v1/parent/children/${childId}/assessments`, { credentials: "same-origin" }).then(
        (r) => r.json() as Promise<{ items: { chapter_number: number; status: string; observed_at: string }[] }>,
      ),
    enabled: childId !== "",
  });

  const settings = useQuery({
    queryKey: ["child-settings", childId],
    queryFn: () =>
      fetch(`/api/v1/parent/children/${childId}/settings`, { credentials: "same-origin" }).then(
        (r) => r.json() as Promise<{ session_goal_minutes: number; quiet_celebrations: boolean; reduced_motion: boolean }>,
      ),
    enabled: childId !== "",
  });

  // T037: Record parent memorization observation
  const recordAssessment = useMutation({
    mutationFn: (data: { chapter_number: number; status: "needs_practice" | "developing" | "parent_confirmed" }) =>
      fetch(`/api/v1/parent/children/${childId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data),
      }),
    onSuccess: () => void assessments.refetch(),
  });

  // T040: Update comfort settings
  const updateSettings = useMutation({
    mutationFn: (data: { session_goal_minutes?: number; quiet_celebrations?: boolean; reduced_motion?: boolean }) =>
      fetch(`/api/v1/parent/children/${childId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data),
      }),
    onSuccess: () => void settings.refetch(),
  });

  // T072: Unlock stage 3 override
  const unlockStage3 = useMutation({
    mutationFn: (lessonId: string) =>
      fetch(`/api/v1/parent/children/${childId}/stage-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ lesson_id: lessonId, reason: "parent_selected_start" }),
      }),
    onSuccess: () => void progress.refetch(),
  });

  const assessmentMap = new Map((assessments.data?.items ?? []).map((a) => [a.chapter_number, a]));

  return (
    <main className="min-h-dvh bg-page">
      <div className="mx-auto max-w-[1120px] px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold text-ink">Area Orang Tua</h1>
            <p className="text-[13px] text-muted">
              Kelola progres belajar, catatan hafalan, dan kenyamanan anak
            </p>
          </div>
          <Link
            to="/orang-tua/anak"
            className="btn-touch inline-flex items-center px-5 rounded-full border border-border-soft bg-surface font-bold text-[15px]"
          >
            ← Kembali ke Profil
          </Link>
        </header>

        {/* Tab navigation */}
        <div className="mt-5 flex gap-2 border-b border-border-soft pb-2" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "progress"}
            onClick={() => setTab("progress")}
            className={`btn-touch rounded-full px-5 text-[15px] font-bold ${
              tab === "progress" ? "bg-primary text-white" : "bg-surface text-muted hover:bg-mint/40"
            }`}
          >
            Progres Belajar
          </button>
          <button
            role="tab"
            aria-selected={tab === "assessment"}
            onClick={() => setTab("assessment")}
            className={`btn-touch rounded-full px-5 text-[15px] font-bold ${
              tab === "assessment" ? "bg-primary text-white" : "bg-surface text-muted hover:bg-mint/40"
            }`}
          >
            Catatan Hafalan Orang Tua
          </button>
          <button
            role="tab"
            aria-selected={tab === "settings"}
            onClick={() => setTab("settings")}
            className={`btn-touch rounded-full px-5 text-[15px] font-bold ${
              tab === "settings" ? "bg-primary text-white" : "bg-surface text-muted hover:bg-mint/40"
            }`}
          >
            Pengaturan &amp; Kenyamanan
          </button>
        </div>

        {/* TAB 1: PROGRES */}
        {tab === "progress" ? (
          <div className="mt-6">
            {progress.isPending ? <p className="text-muted font-bold">Sedang memuat data progres…</p> : null}
            {progress.isError ? (
              <Card>
                <ErrorNote>
                  {progress.error instanceof Error && "status" in progress.error && (progress.error as { status: number }).status === 403
                    ? "Area orang tua terkunci kembali. Silakan masuk lagi."
                    : "Belum ada catatan progres."}
                </ErrorNote>
                <div className="mt-3">
                  <Link to="/gerbang-orang-tua" className="text-primary font-bold underline">
                    Buka kembali gerbang orang tua
                  </Link>
                </div>
              </Card>
            ) : null}

            {progress.data ? (
              <div className="grid gap-6">
                {/* 4 Analytics cards */}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Card>
                    <p className="text-[13px] font-bold text-muted">Pelajaran selesai</p>
                    <p className="mt-1 text-[30px] font-extrabold text-ink">
                      {progress.data.lessons_completed}
                      <span className="text-[16px] text-muted font-bold"> / {progress.data.lessons_total}</span>
                    </p>
                    <p className="text-[12px] text-muted">dari kurikulum rilis saat ini</p>
                  </Card>
                  <Card>
                    <p className="text-[13px] font-bold text-muted">Surat yang dilatih</p>
                    <p className="mt-1 text-[30px] font-extrabold text-ink">{progress.data.distinct_surahs_practiced}</p>
                    <p className="text-[12px] text-muted">modul hafalan surat pendek</p>
                  </Card>
                  <Card>
                    <p className="text-[13px] font-bold text-muted">Ketepatan kuis pertama</p>
                    <p className="mt-1 text-[30px] font-extrabold text-ink">
                      {progress.data.quiz_accuracy_percent === null ? "—" : `${progress.data.quiz_accuracy_percent}%`}
                    </p>
                    <p className="text-[12px] text-muted">
                      {progress.data.quiz_first_answers === 0
                        ? "Belum ada kuis"
                        : `${progress.data.quiz_correct_first_answers} dari ${progress.data.quiz_first_answers} jawaban`}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-[13px] font-bold text-muted">Perkiraan waktu latihan</p>
                    <p className="mt-1 text-[30px] font-extrabold text-ink">{formatMinutes(progress.data.estimated_active_ms)}</p>
                    <p className="text-[12px] text-muted">estimasi aktif, bukan pengukuran</p>
                  </Card>
                </div>

                {/* Weekly chart with table fallback */}
                <Card>
                  <h2 className="text-[18px] font-extrabold text-ink">Aktivitas 7 Hari Terakhir</h2>
                  <div className="mt-4 flex items-end gap-2 h-32" role="img" aria-label="Grafik batang aktivitas harian">
                    {progress.data.daily.map((d) => {
                      const max = Math.max(1, ...progress.data!.daily.map((x) => x.completed_sessions));
                      const height = Math.round((d.completed_sessions / max) * 100);
                      return (
                        <div key={d.local_date} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-xl bg-primary/85 transition-all"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <span className="text-[11px] text-muted">
                            {DAY_NAMES[new Date(`${d.local_date}T00:00:00Z`).getUTCDay()]?.slice(0, 3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <details className="mt-4">
                    <summary className="text-[14px] font-bold text-primary cursor-pointer">
                      Lihat rincian aktivitas dalam tabel
                    </summary>
                    <table className="mt-2 w-full text-[14px]">
                      <thead>
                        <tr className="text-left text-muted border-b border-border-soft">
                          <th className="py-2 font-bold">Tanggal</th>
                          <th className="py-2 font-bold">Sesi Selesai</th>
                          <th className="py-2 font-bold">Perkiraan Waktu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.data.daily.map((d) => (
                          <tr key={d.local_date} className="border-t border-border-soft">
                            <td className="py-2">{d.local_date}</td>
                            <td className="py-2 font-semibold">{d.completed_sessions} sesi</td>
                            <td className="py-2">{formatMinutes(d.estimated_active_ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </Card>

                {/* Lesson breakdown */}
                <Card>
                  <h2 className="text-[18px] font-extrabold text-ink">Rincian Pelajaran</h2>
                  <ul className="mt-4 grid gap-3">
                    {progress.data.lessons.map((l) => (
                      <li key={l.lesson_id} className="rounded-[16px] border border-border-soft p-4 bg-surface">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-extrabold text-[16px] text-ink">{l.title}</p>
                          <span
                            className={`text-[13px] font-extrabold px-3 py-0.5 rounded-full ${
                              l.completed ? "bg-mint text-primary" : "bg-sunny text-ink/80"
                            }`}
                          >
                            {l.completed ? "Selesai ⭐" : `Latihan ${l.practice.percent}%`}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-muted">
                          {l.practice.completed_units} dari {l.practice.required_units} langkah dilatih
                          {l.last_practiced_at ? ` · Terakhir dilatih ${new Date(l.last_practiced_at).toLocaleDateString("id-ID")}` : ""}
                        </p>
                        <div className="mt-2.5 h-2 rounded-full bg-page border border-border-soft overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${l.practice.percent}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* TAB 2: CATATAN HAFALAN ORANG TUA (T037) */}
        {tab === "assessment" ? (
          <div className="mt-6 grid gap-4">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Catatan Hafalan Mandiri</h2>
              <p className="mt-1 text-[14px] text-muted">
                Aplikasi memisahkan latihan mandiri dari kemampuan hafalan sebenarnya. Hanya catatan langsung orang tua
                yang dapat menandai surat sebagai <strong>Sudah Lancar</strong>.
              </p>

              <div className="mt-5 grid gap-4">
                {SURAHS.map((surah) => {
                  const currentAssessment = assessmentMap.get(surah.chapter);
                  return (
                    <div
                      key={surah.chapter}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border-soft p-4 bg-surface"
                    >
                      <div>
                        <p className="font-extrabold text-[16px] text-ink">Surat {surah.name}</p>
                        <p className="text-[12px] text-muted">
                          Status saat ini:{" "}
                          <span className="font-bold text-primary">
                            {currentAssessment?.status === "parent_confirmed"
                              ? "Sudah Lancar (Dikonfirmasi Orang Tua)"
                              : currentAssessment?.status === "developing"
                              ? "Berkembang"
                              : "Perlu Latihan"}
                          </span>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            recordAssessment.mutate({
                              chapter_number: surah.chapter,
                              status: "needs_practice",
                            })
                          }
                          className={`btn-touch px-3 py-1 rounded-xl text-[12px] font-bold border ${
                            currentAssessment?.status === "needs_practice"
                              ? "bg-error text-white border-error"
                              : "bg-surface border-border-soft"
                          }`}
                        >
                          Perlu Latihan
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            recordAssessment.mutate({
                              chapter_number: surah.chapter,
                              status: "developing",
                            })
                          }
                          className={`btn-touch px-3 py-1 rounded-xl text-[12px] font-bold border ${
                            currentAssessment?.status === "developing"
                              ? "bg-sunny text-ink border-[#ecd98f]"
                              : "bg-surface border-border-soft"
                          }`}
                        >
                          Berkembang
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            recordAssessment.mutate({
                              chapter_number: surah.chapter,
                              status: "parent_confirmed",
                            })
                          }
                          className={`btn-touch px-3 py-1 rounded-xl text-[12px] font-bold border ${
                            currentAssessment?.status === "parent_confirmed"
                              ? "bg-primary text-white border-primary"
                              : "bg-surface border-border-soft"
                          }`}
                        >
                          Sudah Lancar ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : null}

        {/* TAB 3: PENGATURAN & KENYAMANAN (T040, T072) */}
        {tab === "settings" ? (
          <div className="mt-6 grid gap-5">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Pengaturan Belajar Anak</h2>
              <p className="mt-1 text-[14px] text-muted">Sesuaikan target waktu dan preferensi sensorik anak.</p>

              <div className="mt-5 grid gap-5">
                {/* Target session goal */}
                <div>
                  <span className="block text-[15px] font-extrabold text-ink mb-2">
                    Target Durasi Sesi (Pengingat Istirahat)
                  </span>
                  <div className="flex gap-3">
                    {([5, 10, 15] as const).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateSettings.mutate({ session_goal_minutes: mins })}
                        className={`btn-touch flex-1 rounded-2xl font-extrabold border ${
                          settings.data?.session_goal_minutes === mins
                            ? "bg-primary text-white border-primary"
                            : "bg-surface border-border-soft hover:bg-mint/20"
                        }`}
                      >
                        {mins} Menit
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    Aplikasi akan menampilkan pengingat istirahat yang ramah saat durasi tercapai.
                  </p>
                </div>

                {/* Quiet celebrations */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.data?.quiet_celebrations)}
                    onChange={(e) => updateSettings.mutate({ quiet_celebrations: e.target.checked })}
                    className="mt-1 size-5 accent-[#157F43]"
                  />
                  <div>
                    <span className="font-extrabold text-[15px] text-ink block">Perayaan Tenang</span>
                    <span className="text-[13px] text-muted block">
                      Mengurangi efek suara perayaan berlebih untuk anak yang sensitif terhadap kebisingan.
                    </span>
                  </div>
                </label>

                {/* Reduced motion */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.data?.reduced_motion)}
                    onChange={(e) => updateSettings.mutate({ reduced_motion: e.target.checked })}
                    className="mt-1 size-5 accent-[#157F43]"
                  />
                  <div>
                    <span className="font-extrabold text-[15px] text-ink block">Kurangi Animasi</span>
                    <span className="text-[13px] text-muted block">
                      Menonaktifkan animasi confetti dan transisi bergerak.
                    </span>
                  </div>
                </label>
              </div>
            </Card>

            {/* Stage Overrides */}
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Bypass Prasyarat Tahap Belajar (T072)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Bila anak sudah memiliki kemampuan dasar membaca huruf hijaiyah, orang tua dapat membuka langsung tahap
                hafalan surat pendek tanpa harus menyelesaikan modul huruf pertama.
              </p>

              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const firstSurah = progress.data?.lessons.find((l) => l.lesson_type === "surah");
                    if (firstSurah) {
                      unlockStage3.mutate(firstSurah.lesson_id);
                    }
                  }}
                  disabled={unlockStage3.isPending}
                >
                  {unlockStage3.isPending ? "Membuka…" : "Buka Tahap Surat Pendek Sekarang"}
                </Button>
                {unlockStage3.isSuccess ? (
                  <p className="mt-2 text-[13px] font-bold text-primary">
                    ✓ Tahap Surat Pendek telah dibuka untuk profil ini.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mt-8 text-center">
          <DemoBadge />
        </div>
      </div>
    </main>
  );
}
