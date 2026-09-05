// S16 parent dashboard (T024): real scoped data, denominators, accessible
// weekly table alternative, honest no-data states. Requires a live gate.
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { Card, DemoBadge, ErrorNote } from "../components/ui.tsx";

function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 menit";
  return `${minutes} menit`;
}

const DAY_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function ParentProgressPage() {
  const { childId = "" } = useParams();
  const progress = useQuery({
    queryKey: ["parent-progress", childId],
    queryFn: () => api.parentProgress(childId),
    enabled: childId !== "",
  });

  return (
    <main className="min-h-dvh bg-page">
      <div className="mx-auto max-w-[1120px] px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold">Progres anak</h1>
            <p className="text-[13px] text-muted">
              Zona waktu {progress.data?.timezone ?? "—"} · 7 hari terakhir · hari mengikuti zona waktu saat latihan dicatat
            </p>
          </div>
          <Link to="/orang-tua/anak" className="btn-touch inline-flex items-center px-5 rounded-full border border-border-soft bg-surface font-bold text-[15px]">
            ← Profil anak
          </Link>
        </header>

        {progress.isPending ? <p className="mt-6 text-muted font-bold">Sedang menyiapkan…</p> : null}

        {progress.isError ? (
          <div className="mt-6 max-w-lg">
            <ErrorNote>
              {progress.error instanceof Error && "status" in progress.error && (progress.error as { status: number }).status === 403
                ? "Area orang tua terkunci kembali. Silakan masuk lagi."
                : "Belum ada latihan yang tercatat."}
            </ErrorNote>
            <div className="mt-4">
              <Link to="/gerbang-orang-tua" className="text-primary font-bold underline">
                Buka kembali area orang tua
              </Link>
            </div>
          </div>
        ) : null}

        {progress.data ? (
          <div className="mt-6 grid gap-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Card>
                <p className="text-[13px] font-bold text-muted">Pelajaran selesai</p>
                <p className="mt-1 text-[30px] font-extrabold">
                  {progress.data.lessons_completed}
                  <span className="text-[16px] text-muted font-bold"> / {progress.data.lessons_total}</span>
                </p>
                <p className="text-[12px] text-muted">dari kurikulum yang ditugaskan</p>
              </Card>
              <Card>
                <p className="text-[13px] font-bold text-muted">Surat yang dilatih</p>
                <p className="mt-1 text-[30px] font-extrabold">{progress.data.distinct_surahs_practiced}</p>
                <p className="text-[12px] text-muted">modul surat pendek</p>
              </Card>
              <Card>
                <p className="text-[13px] font-bold text-muted">Ketepatan jawaban pertama</p>
                <p className="mt-1 text-[30px] font-extrabold">
                  {progress.data.quiz_accuracy_percent === null ? "—" : `${progress.data.quiz_accuracy_percent}%`}
                </p>
                <p className="text-[12px] text-muted">
                  {progress.data.quiz_first_answers === 0 ? "Belum ada kuis" : `${progress.data.quiz_correct_first_answers} dari ${progress.data.quiz_first_answers} jawaban`}
                </p>
              </Card>
              <Card>
                <p className="text-[13px] font-bold text-muted">Perkiraan waktu latihan</p>
                <p className="mt-1 text-[30px] font-extrabold">{formatMinutes(progress.data.estimated_active_ms)}</p>
                <p className="text-[12px] text-muted">perkiraan, bukan pengukuran</p>
              </Card>
            </div>

            <Card>
              <h2 className="text-[18px] font-extrabold">Aktivitas minggu ini</h2>
              <div className="mt-4 flex items-end gap-2 h-32" role="img" aria-label="Grafik batang sesi selesai per hari">
                {progress.data.daily.map((d) => {
                  const max = Math.max(1, ...progress.data!.daily.map((x) => x.completed_sessions));
                  const height = Math.round((d.completed_sessions / max) * 100);
                  return (
                    <div key={d.local_date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-xl bg-primary/85" style={{ height: `${Math.max(height, 4)}%` }} />
                      <span className="text-[11px] text-muted">
                        {DAY_NAMES[new Date(`${d.local_date}T00:00:00Z`).getUTCDay()]?.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Text/table alternative required by accessibility spec. */}
              <details className="mt-3">
                <summary className="text-[14px] font-bold text-primary cursor-pointer">Lihat data dalam tabel</summary>
                <table className="mt-2 w-full text-[14px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-bold">Hari</th>
                      <th className="py-1 font-bold">Sesi selesai</th>
                      <th className="py-1 font-bold">Perkiraan waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.data.daily.map((d) => (
                      <tr key={d.local_date} className="border-t border-border-soft">
                        <td className="py-2">{d.local_date}</td>
                        <td className="py-2">{d.completed_sessions}</td>
                        <td className="py-2">{formatMinutes(d.estimated_active_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>

            <Card>
              <h2 className="text-[18px] font-extrabold">Rincian pelajaran</h2>
              <ul className="mt-3 grid gap-3">
                {progress.data.lessons.map((l) => (
                  <li key={l.lesson_id} className="rounded-[16px] border border-border-soft px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-[16px]">{l.title}</p>
                      <span className={`text-[13px] font-bold ${l.completed ? "text-primary" : "text-muted"}`}>
                        {l.completed ? "Selesai" : `Latihan ${l.practice.percent}%`}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">
                      {l.practice.completed_units} dari {l.practice.required_units} langkah dilatih
                      {l.last_practiced_at ? ` · terakhir ${new Date(l.last_practiced_at).toLocaleDateString("id-ID")}` : ""}
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-page border border-border-soft overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${l.practice.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-muted">
                Catatan orang tua tentang hafalan dicatat terpisah dari ringkasan ini. Aplikasi tidak mengukur kelancaran
                bacaan secara otomatis.
              </p>
            </Card>

            <DemoBadge />
          </div>
        ) : null}
      </div>
    </main>
  );
}
