// S02 adult sign-in/sign-up and verification-pending state (T011/T012).
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, ApiError } from "../api.ts";
import { Button, Card, ErrorNote, Field, TextInput } from "../components/ui.tsx";

export function AuthPage({ stage, onDone }: { stage: "signin" | "verify-pending"; onDone?: () => void }) {
  const params = useSearchParams()[0];
  const mode = params.get("mode") === "daftar" || location.pathname.startsWith("/daftar") ? "daftar" : "masuk";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(stage === "verify-pending");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "daftar") {
        await api.signUp({ name: name.trim() || "Orang Tua", email: email.trim(), password });
        setPendingVerification(true);
      } else {
        await api.signIn({ email: email.trim(), password });
        onDone?.();
        navigate("/orang-tua/mulai", { replace: true });
      }
    } catch (err) {
      // Generic copy: never reveal whether an unrelated account exists.
      setError(err instanceof ApiError && err.status !== 401 ? err.message : "Email atau kata sandi belum tepat.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingVerification) {
    return (
      <main className="min-h-dvh grid place-items-center bg-page p-4">
        <Card className="max-w-md w-full">
          <h1 className="text-[24px] font-extrabold">Periksa email kamu</h1>
          <p className="mt-2 text-muted text-[15px]">
            Kami mengirim tautan verifikasi. Buka tautan itu, lalu masuk lagi. Tautan berlaku 1 jam.
          </p>
          <p className="mt-2 text-[13px] text-muted">
            Di lingkungan lokal, tautan juga dicatat di log server (stub yang jujur, bukan klaim pengiriman).
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Button block onClick={() => navigate("/masuk")}>
              Saya sudah verifikasi — masuk
            </Button>
            <Button variant="ghost" block onClick={() => setPendingVerification(false)}>
              Ganti alamat email
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-page p-4">
      <Card className="max-w-md w-full">
        <h1 className="text-[26px] font-extrabold">{mode === "daftar" ? "Buat akun orang tua" : "Masuk"}</h1>
        <p className="mt-1 text-muted text-[15px]">
          Akun orang tua diperlukan untuk mengelola profil anak. Anak tidak membuat akun sendiri.
        </p>
        <form className="mt-5 grid gap-4" onSubmit={submit}>
          {mode === "daftar" ? (
            <Field label="Nama">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </Field>
          ) : null}
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Kata sandi" hint={mode === "daftar" ? "Minimal 10 karakter." : undefined}>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "daftar" ? "new-password" : "current-password"}
              minLength={mode === "daftar" ? 10 : undefined}
              required
            />
          </Field>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button block type="submit" disabled={busy}>
            {busy ? "Sebentar…" : mode === "daftar" ? "Daftar" : "Masuk"}
          </Button>
        </form>
        <p className="mt-4 text-[15px] text-muted">
          {mode === "daftar" ? (
            <>
              Sudah punya akun?{" "}
              <Link to="/masuk" className="text-primary font-bold">
                Masuk
              </Link>
            </>
          ) : (
            <>
              Baru pertama kali?{" "}
              <Link to="/daftar" className="text-primary font-bold">
                Buat akun
              </Link>
            </>
          )}
        </p>
      </Card>
    </main>
  );
}
