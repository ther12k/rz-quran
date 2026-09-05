// S19 / S20 Staff Content Admin & Editorial Workspace (T051):
// - Source & rights registry
// - Asset quarantine list
// - Lesson drafts & mandatory second-person review
// - Instant recall switch
// - Audit log viewer
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, DemoBadge, ErrorNote, Field, TextInput } from "../components/ui.tsx";

export function AdminWorkspacePage() {
  const [activeTab, setActiveTab] = useState<"sources" | "assets" | "drafts" | "recall" | "audit">("drafts");

  const sources = useQuery({
    queryKey: ["admin-sources"],
    queryFn: () => fetch("/api/v1/admin/sources", { credentials: "same-origin" }).then((r) => r.json() as Promise<{ items: any[] }>),
  });

  const assets = useQuery({
    queryKey: ["admin-assets"],
    queryFn: () => fetch("/api/v1/admin/assets", { credentials: "same-origin" }).then((r) => r.json() as Promise<{ items: any[] }>),
  });

  const auditEvents = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetch("/api/v1/admin/audit-events", { credentials: "same-origin" }).then((r) => r.json() as Promise<{ items: any[] }>),
  });

  const [recallLessonId, setRecallLessonId] = useState("");
  const [recallReason, setRecallReason] = useState("");
  const recallMutation = useMutation({
    mutationFn: (data: { lesson_id: string; reason: string }) =>
      fetch(`/api/v1/admin/lessons/${data.lesson_id}/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: data.reason }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setRecallLessonId("");
      setRecallReason("");
      alert("Materi berhasil ditarik segera (recalled). Sesi aktif yang menggunakan materi ini dibatalkan.");
    },
  });

  return (
    <main className="min-h-dvh bg-page">
      <div className="mx-auto max-w-[1120px] px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] font-extrabold text-ink">Ruang Editorial &amp; Kurikulum</h1>
              <span className="rounded-full bg-mint px-3 py-0.5 text-[12px] font-extrabold text-primary border border-border-soft">
                Staf Terverifikasi
              </span>
            </div>
            <p className="text-[13px] text-muted">
              Persetujuan berjenjang, pelacakan hak cipta, karantina aset, dan penarikan materi seketika.
            </p>
          </div>
          <Link to="/" className="btn-touch inline-flex items-center px-4 rounded-full border border-border-soft bg-surface text-[14px] font-bold text-muted">
            ← Beranda Utama
          </Link>
        </header>

        {/* Tab navigation */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist">
          {[
            { key: "drafts", label: "Draft & Review Dua Orang" },
            { key: "sources", label: "Sumber & Hak Cipta" },
            { key: "assets", label: "Karantina Aset" },
            { key: "recall", label: "Penarikan Seketika (Recall)" },
            { key: "audit", label: "Jejak Audit (Audit Trail)" },
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`btn-touch whitespace-nowrap rounded-full px-5 text-[14px] font-extrabold border ${
                activeTab === tab.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-muted border-border-soft hover:bg-mint/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: DRAFTS & MANDATORY 2ND PERSON REVIEW */}
        {activeTab === "drafts" ? (
          <div className="mt-6 grid gap-5">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Peninjauan Materi Berjenjang (T045)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Syarat mutlak publikasi: Wajib ditinjau oleh reviewer syariah/pedagogi yang <strong>berbeda</strong> dari penulis draft.
                Sistem secara otomatis menolak peninjauan oleh orang yang sama (self-review blocked).
              </p>

              <div className="mt-4 rounded-2xl bg-mint/50 border border-border-soft p-4">
                <h3 className="font-extrabold text-[15px] text-primary">Invarian Validasi Syariah</h3>
                <ul className="mt-2 list-disc list-inside text-[13px] text-ink/80 space-y-1">
                  <li>Teks Al-Qur'an bersumber langsung dari korpus bertashih (Tanzil Simple).</li>
                  <li>Tanda harakat dan penomoran ayat diverifikasi terhadap cetakan resmi Lajnah Kemenag RI.</li>
                  <li>Pelafalan audio hijaiyah dan murottal telah diverifikasi bebas dari distorsi.</li>
                  <li>Kunci jawaban kuis tersimpan di server dan tidak disertakan dalam paket aplikasi anak.</li>
                </ul>
              </div>
            </Card>
          </div>
        ) : null}

        {/* TAB: SOURCES & RIGHTS REGISTRY */}
        {activeTab === "sources" ? (
          <div className="mt-6 grid gap-4">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Registri Sumber &amp; Lisensi (T041)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Daftar sumber resmi yang terdaftar dan diverifikasi hak penggunaannya.
              </p>

              <div className="mt-4 grid gap-3">
                {(sources.data?.items ?? []).map((s) => (
                  <div key={s.id} className="rounded-2xl border border-border-soft p-4 bg-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-extrabold text-[16px] text-ink">{s.title}</h3>
                      <span className={`text-[12px] font-extrabold px-3 py-0.5 rounded-full ${
                        s.rights_status === "approved" ? "bg-mint text-primary" : "bg-sunny text-ink/80"
                      }`}>
                        Hak Cipta: {s.rights_status}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">Versi {s.source_version} · Jenis: {s.source_kind}</p>
                    <p className="mt-2 text-[13px] text-ink/80">Atribusi: {s.attribution || "—"}</p>
                    <p className="mt-1 text-[12px] text-muted font-mono">Lisensi: {s.license_reference || "—"}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {/* TAB: ASSET QUARANTINE */}
        {activeTab === "assets" ? (
          <div className="mt-6 grid gap-4">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Karantina Aset Media (T042, T043)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Semua aset media baru masuk ke status <strong>quarantine</strong> dan hanya dapat diputar anak setelah
                verifikasi checksum SHA-256 dan persetujuan hak cipta selesai.
              </p>

              <div className="mt-4 grid gap-3">
                {(assets.data?.items ?? []).length === 0 ? (
                  <p className="text-[14px] text-muted">Belum ada aset media dalam karantina.</p>
                ) : null}
                {(assets.data?.items ?? []).map((a) => (
                  <div key={a.id} className="rounded-2xl border border-border-soft p-4 bg-surface flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[15px]">{a.object_key}</p>
                      <p className="text-[12px] text-muted font-mono">{a.mime_type} · {a.size_bytes} bytes</p>
                    </div>
                    <span className={`text-[12px] font-extrabold px-3 py-0.5 rounded-full ${
                      a.status === "verified" ? "bg-mint text-primary" : "bg-sunny text-ink/80"
                    }`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {/* TAB: INSTANT RECALL (T047) */}
        {activeTab === "recall" ? (
          <div className="mt-6 grid gap-4">
            <Card>
              <h2 className="text-[19px] font-extrabold text-error">Penarikan Materi Seketika (Instant Recall - T047)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Bila ditemukan kesalahan teks Arab, pelafalan audio, atau instruksi, materi versi ini dapat ditarik
                segera. Semua sesi anak yang sedang aktif dengan versi ini akan langsung dibatalkan dengan aman.
              </p>

              <form
                className="mt-5 grid gap-4 max-w-lg"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (recallLessonId) {
                    recallMutation.mutate({ lesson_id: recallLessonId, reason: recallReason });
                  }
                }}
              >
                <Field label="ID Pelajaran (UUID)" hint="Masukkan UUID materi pelajaran yang akan ditarik">
                  <TextInput
                    value={recallLessonId}
                    onChange={(e) => setRecallLessonId(e.target.value)}
                    placeholder="Contoh: 00000000-0000-4000-8000-00000000d010"
                    required
                  />
                </Field>
                <Field label="Alasan Penarikan">
                  <TextInput
                    value={recallReason}
                    onChange={(e) => setRecallReason(e.target.value)}
                    placeholder="Contoh: Koreksi tanda waqaf pada ayat 3"
                    required
                  />
                </Field>
                <Button variant="danger" block type="submit" disabled={recallMutation.isPending || !recallLessonId}>
                  {recallMutation.isPending ? "Menarik materi…" : "Tarik Materi Sekarang"}
                </Button>
              </form>
            </Card>
          </div>
        ) : null}

        {/* TAB: AUDIT LOG (T050) */}
        {activeTab === "audit" ? (
          <div className="mt-6 grid gap-4">
            <Card>
              <h2 className="text-[19px] font-extrabold text-ink">Jejak Audit Editorial (T050)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Catatan kekal setiap tindakan kurikulum, publikasi, peninjauan, dan penarikan materi.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-muted border-b border-border-soft">
                      <th className="py-2 font-bold">Waktu</th>
                      <th className="py-2 font-bold">Aktor</th>
                      <th className="py-2 font-bold">Aksi</th>
                      <th className="py-2 font-bold">Objek</th>
                      <th className="py-2 font-bold">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditEvents.data?.items ?? []).map((ev) => (
                      <tr key={ev.id} className="border-t border-border-soft">
                        <td className="py-2 text-muted">{new Date(ev.created_at).toLocaleString("id-ID")}</td>
                        <td className="py-2 font-mono text-[12px]">{ev.actor_reference.slice(0, 12)}…</td>
                        <td className="py-2 font-bold">{ev.action}</td>
                        <td className="py-2">{ev.object_type}</td>
                        <td className="py-2 font-bold text-primary">{ev.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
