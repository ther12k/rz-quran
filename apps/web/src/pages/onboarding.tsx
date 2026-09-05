// S03/S04 parent onboarding: consent-state capture then child profiles.
// The demo consent step is clearly labeled; production policy blocks real
// enrollment until approved (T015, docs/11 D02/D03).
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api.ts";
import { Button, Card, DemoBadge, ErrorNote, Field, TextInput } from "../components/ui.tsx";

const AVATARS = [
  { key: "cat_green", label: "Kucing" },
  { key: "star_yellow", label: "Bintang" },
  { key: "moon_blue", label: "Bulan" },
  { key: "leaf_mint", label: "Daun" },
];

function ConsentStep({ onDone }: { onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grant = useMutation({
    mutationFn: () =>
      api.recordConsent({
        action: "grant",
        scope: "family",
        child_id: null,
        purpose: "profile_learning",
        notice_version: "demo-notice-1",
        policy_version: "demo-policy-1",
        assurance_token: "demo-local-assurance",
      }),
    onSuccess: async () => {
      // Invalidate and immediately fetch fresh context
      await api.me();
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal mencatat persetujuan."),
  });

  return (
    <Card>
      <h2 className="text-[22px] font-extrabold">Persetujuan sebelum membuat profil anak</h2>
      <DemoBadge />
      <div className="mt-4 grid gap-3 text-[15px]">
        <p>
          Aplikasi menyimpan <strong>nama panggilan</strong>, pilihan avatar, dan kelompok usia anak, serta catatan
          aktivitas belajar (pelajaran yang diselesaikan, jawaban kuis, perkiraan waktu latihan).
        </p>
        <p>Data ini hanya untuk menampilkan progres ke kamu sebagai orang tua. Tidak ada foto, tanggal lahir persis, atau alamat.</p>
        <p>
          Kamu bisa menarik persetujuan kapan saja; setelah ditarik, anak tidak bisa belajar sampai persetujuan baru
          dicatat. Permintaan hapus data tersedia di area orang tua.
        </p>
        <p className="text-[13px] text-muted">
          Pemberitahuan versi demo-notice-1 · kebijakan demo-policy-1. Pada produksi, langkah ini memakai alur
          persetujuan yang disetujui hukum — tanda tangan di sini <em>tidak</em> berlaku sebagai persetujuan produksi.
        </p>
      </div>
      <label className="mt-5 flex items-start gap-3 text-[15px] font-semibold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 size-6 accent-[#157F43]"
          required
        />
        <span>Saya mengerti data apa yang disimpan dan setuju melanjutkan (simulasi demo).</span>
      </label>
      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
      <div className="mt-5">
        <Button block disabled={!checked || grant.isPending} onClick={() => grant.mutate()}>
          {grant.isPending ? "Menyimpan…" : "Setuju dan lanjut"}
        </Button>
      </div>
    </Card>
  );
}

function ChildrenStep({ onDone }: { onDone: () => void }) {
  const children = useQuery({ queryKey: ["children"], queryFn: api.listChildren });
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]!.key);
  const [ageBand, setAgeBand] = useState<"5_7" | "8_10">("5_7");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.createChild({ nickname: nickname.trim(), avatar_key: avatar, age_band: ageBand }),
    onSuccess: () => {
      setNickname("");
      void children.refetch();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal membuat profil."),
  });
  const enter = useMutation({
    mutationFn: (childId: string) => api.enterChildMode(childId),
    onSuccess: onDone,
  });

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="text-[22px] font-extrabold">Profil anak</h2>
        <p className="text-muted text-[15px] mt-1">Maksimal tiga profil aktif. Satu profil aktif per perangkat.</p>
        {children.isPending ? <p className="mt-3 text-muted">Memuat…</p> : null}
        {children.data && children.data.items.length === 0 ? (
          <p className="mt-3 text-[15px]">Belum ada profil. Buat profil pertama di bawah.</p>
        ) : null}
        <ul className="mt-4 grid gap-3">
          {(children.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border-soft bg-mint/60 px-4 py-3">
              <span className="font-bold text-[17px]">
                {c.nickname} <span className="text-[13px] font-semibold text-muted">· {c.age_band === "5_7" ? "usia 5–7" : "usia 8–10"}</span>
              </span>
              <span className="flex gap-2">
                <Link
                  to={`/orang-tua/anak/${c.id}/progres`}
                  className="btn-touch inline-flex items-center px-4 rounded-full border border-border-soft bg-surface text-[15px] font-bold text-primary"
                >
                  Progres
                </Link>
                <Button onClick={() => enter.mutate(c.id)} disabled={enter.isPending}>
                  Belajar sekarang
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-[18px] font-extrabold">Buat profil baru</h3>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <Field label="Nama panggilan" hint="1–30 karakter. Tanpa nama lengkap.">
            <TextInput value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} minLength={1} required />
          </Field>
          <fieldset>
            <legend className="block text-[15px] font-bold mb-1">Avatar</legend>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAvatar(a.key)}
                  aria-pressed={avatar === a.key}
                  className={`btn-touch rounded-2xl px-5 font-bold border ${avatar === a.key ? "bg-primary text-white border-primary" : "bg-surface border-border-soft"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="block text-[15px] font-bold mb-1">Kelompok usia</legend>
            <div className="flex gap-2">
              {(["5_7", "8_10"] as const).map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setAgeBand(band)}
                  aria-pressed={ageBand === band}
                  className={`btn-touch flex-1 rounded-2xl px-5 font-bold border ${ageBand === band ? "bg-primary text-white border-primary" : "bg-surface border-border-soft"}`}
                >
                  {band === "5_7" ? "5–7 tahun" : "8–10 tahun"}
                </button>
              ))}
            </div>
          </fieldset>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button block type="submit" disabled={create.isPending || nickname.trim().length === 0}>
            {create.isPending ? "Menyimpan…" : "Simpan profil"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-[14px] text-muted">
        Ingin melihat progres?{" "}
        <Link to="/gerbang-orang-tua" className="text-primary font-bold">
          Buka area orang tua
        </Link>
      </p>
    </div>
  );
}

export function OnboardingPage({ stage, onDone }: { stage: "consent" | "children"; onDone: () => void }) {
  return (
    <main className="min-h-dvh bg-page py-6">
      <div className="mx-auto max-w-[560px] px-4">
        <h1 className="text-[26px] font-extrabold mb-4">Menyiapkan belajar anak</h1>
        {stage === "consent" ? <ConsentStep onDone={onDone} /> : <ChildrenStep onDone={onDone} />}
      </div>
    </main>
  );
}
