// S15 parent gate: neutral "Minta bantuan orang tua" reauthentication.
// No arithmetic puzzles; gate is a UX/security control, not consent proof.
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api.ts";
import { Button, Card, ErrorNote, Field, TextInput } from "../components/ui.tsx";

export function GatePage({ onUnlocked }: { onUnlocked: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unlock = useMutation({
    mutationFn: () => api.unlockGate(password),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res);
      onUnlocked();
      navigate("/orang-tua/anak", { replace: true });
    },
    onError: () => setError("Belum berhasil. Periksa kata sandi dan coba lagi."),
  });

  return (
    <main className="min-h-dvh grid place-items-center bg-page p-4">
      <Card className="max-w-md w-full">
        <h1 className="text-[24px] font-extrabold">Minta bantuan orang tua</h1>
        <p className="mt-2 text-muted text-[15px]">Masukkan kata sandi untuk membuka area orang tua.</p>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            unlock.mutate();
          }}
        >
          <Field label="Kata sandi orang tua">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button block type="submit" disabled={unlock.isPending || password.length === 0}>
            {unlock.isPending ? "Memeriksa…" : "Buka area orang tua"}
          </Button>
        </form>
        <p className="mt-4 text-[13px] text-muted">
          Bukan pengganti proses persetujuan yang diperlukan. Lupa kata sandi? Gunakan tautan pemulihan di halaman masuk.
        </p>
      </Card>
    </main>
  );
}
