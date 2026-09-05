// S01 public landing: the user's central message plus all eight benefits.
// Honest scope: demo label, no memorization guarantee, no sign-up pressure.
import { Link } from "react-router";
import { Button, DemoBadge } from "../components/ui.tsx";

const FEATURES = [
  { title: "Belajar Mendengar & Meniru", description: "Pelafalan yang jelas membantu anak membaca dengan lebih percaya diri.", tint: "bg-mint" },
  { title: "Hafalan Al-Qur'an", description: "Belajar menghafal sedikit demi sedikit dengan lebih mudah.", tint: "bg-lavender" },
  { title: "Surat Pendek", description: "Mulai menghafal surat yang sering dibaca dalam salat.", tint: "bg-sky" },
  { title: "Kuis Interaktif", description: "Menguji pemahaman anak dengan cara yang menyenangkan.", tint: "bg-sunny" },
  { title: "Permainan Huruf Hijaiyah", description: "Belajar terasa seperti bermain sehingga anak tidak cepat bosan.", tint: "bg-mint" },
  { title: "Pantau Progres Anak", description: "Lihat perkembangan belajar anak kapan saja.", tint: "bg-lavender" },
  { title: "Aman untuk Anak", description: "Tanpa iklan dan tanpa konten yang mengganggu proses belajar.", tint: "bg-sky" },
  { title: "Belajar Bertahap", description: "Mulai dari mengenal huruf hingga membaca Al-Qur'an secara bertahap.", tint: "bg-sunny" },
];

export function LandingPage({ signedIn = false, signedOut = false }: { signedIn?: boolean; signedOut?: boolean }) {
  return (
    <main className="min-h-dvh bg-page">
      <div className="mx-auto max-w-[1120px] px-4 md:px-8">
        <header className="flex items-center justify-between py-5">
          <span className="text-[20px] font-extrabold text-primary">RZ Qur'an Kids</span>
          <nav className="flex items-center gap-3 text-[15px] font-bold">
            <Link to="/privasi" className="hidden sm:inline text-muted hover:text-ink px-2 py-3 rounded-xl">
              Privasi
            </Link>
            <Link to="/sumber" className="hidden sm:inline text-muted hover:text-ink px-2 py-3 rounded-xl">
              Sumber
            </Link>
            <Link to={signedIn ? "/orang-tua/mulai" : "/masuk"} className="text-primary hover:bg-mint px-4 py-3 rounded-xl">
              {signedIn ? "Lanjut" : "Masuk"}
            </Link>
          </nav>
        </header>

        <section className="grid gap-8 py-8 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <DemoBadge />
            <h1 className="mt-4 text-[30px] leading-tight font-extrabold md:text-[40px]">
              Semua yang Dibutuhkan Anak untuk Belajar Al-Qur'an
            </h1>
            <p className="mt-4 text-[17px] text-muted md:text-[19px]">
              Dirancang agar anak belajar lebih mudah, lebih menyenangkan, dan tidak cepat bosan.
            </p>
            <p className="mt-3 text-[14px] text-muted">
              Versi ini masih pengembangan dengan materi contoh non-produksi. Belum ada klaim hafalan otomatis —
              penilaian selalu dicatat oleh orang tua.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/daftar" className="sm:w-auto w-full">
                <Button block>Mulai bersama orang tua</Button>
              </Link>
              <Link to="#cara-belajar" className="sm:w-auto w-full">
                <Button variant="secondary" block>
                  Lihat cara belajar
                </Button>
              </Link>
            </div>
          </div>
          <div className="rounded-[24px] bg-mint border border-border-soft p-8 text-center" aria-hidden="true">
            <div className="arabic text-[64px] text-primary select-none">ب</div>
            <div className="arabic text-[40px] text-ink/70 select-none">أ</div>
            <p className="mt-3 text-[13px] text-muted">
              Ilustrasi huruf hijaiyah (bukan teks Al-Qur'an)
            </p>
          </div>
        </section>

        <section id="cara-belajar" className="py-8" aria-labelledby="fitur-h">
          <h2 id="fitur-h" className="text-[24px] font-extrabold">
            Cara anak belajar
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className={`rounded-[24px] ${f.tint} border border-border-soft p-5`}>
                <h3 className="text-[17px] font-extrabold">{f.title}</h3>
                <p className="mt-2 text-[15px] text-ink/80">{f.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="py-10 text-[13px] text-muted flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/privasi" className="underline">
            Kebijakan data &amp; privasi
          </Link>
          <Link to="/sumber" className="underline">
            Sumber materi
          </Link>
          <span>Tanpa iklan · Tanpa pelacak · Suara anak tidak direkam</span>
        </footer>
      </div>
    </main>
  );
}
