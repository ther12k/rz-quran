// S07 listen/imitate player for the M1 demo lesson: letter units with an
// honest audio-unavailable state, quiz choice with server-scored answer,
// serial event queue with sequence tracking, and finish.
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, type SessionDto } from "../api.ts";
import { Button, Card, DemoBadge, ErrorNote } from "../components/ui.tsx";
import { ChildShell } from "./child-home.tsx";

function newEventId() {
  return crypto.randomUUID();
}

export function LessonPlayerPage({ onChanged }: { onChanged: () => void }) {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const lesson = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => api.lesson(lessonId), enabled: lessonId !== "" });
  const session = useQuery({
    queryKey: ["session", lessonId],
    queryFn: () => api.startSession(lessonId),
    enabled: lessonId !== "",
  });

  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<null | { correct: boolean; first: boolean }>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { star: boolean }>(null);
  const seqRef = useRef<number | null>(null);
  const pendingEvents: { event_id: string; sequence: number; client_at: string | null; type: string; unit_id?: string }[] = [];

  const units = useMemo(() => lesson.data?.units ?? [], [lesson.data]);
  const current = units[index];
  const sessionData: SessionDto | undefined = session.data;

  const nextSequence = useCallback((): number => {
    if (seqRef.current === null && sessionData) seqRef.current = sessionData.last_sequence;
    return (seqRef.current ?? 0) + 1;
  }, [sessionData]);

  const ack = useMutation({
    mutationFn: async (unitId: string) => {
      const sequence = nextSequence();
      const event = { event_id: newEventId(), sequence, client_at: null, type: "unit_acknowledged" as const, unit_id: unitId };
      pendingEvents.push(event);
      try {
        const res = await api.submitEvents(sessionData!.session_id, [event]);
        seqRef.current = sequence;
        return res;
      } catch (e) {
        if (e instanceof ApiError && e.code === "EVENT_SEQUENCE_CONFLICT") {
          // Reconcile: refetch authoritative state (docs/05 §6).
          const fresh = await api.currentSession();
          seqRef.current = fresh.session?.last_sequence ?? seqRef.current;
          const retrySeq = (seqRef.current ?? 0) + 1;
          const retry = { ...event, sequence: retrySeq };
          const res = await api.submitEvents(sessionData!.session_id, [retry]);
          seqRef.current = retrySeq;
          return res;
        }
        throw e;
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal menyimpan. Coba lagi."),
  });

  const answer = useMutation({
    mutationFn: async (optionId: string) => {
      const q = sessionData?.current_question;
      if (!q) throw new Error("no question");
      const res = await api.submitAnswer(sessionData!.session_id, {
        event_id: newEventId(),
        client_at: null,
        question_id: q.question_id,
        selected_option_id: optionId,
      });
      // Answers consume a sequence number in the session stream.
      seqRef.current = (seqRef.current ?? sessionData!.last_sequence) + 1;
      return res;
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal mengirim jawaban."),
  });

  const finish = useMutation({
    mutationFn: () => api.finishSession(sessionData!.session_id),
    onSuccess: (res) => {
      setDone({ star: res.star_awarded });
      onChanged();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal menyelesaikan latihan."),
  });

  if (lesson.isPending || session.isPending) {
    return (
      <ChildShell activeTab="belajar">
        <p className="p-6 text-muted font-bold">Sedang menyiapkan…</p>
      </ChildShell>
    );
  }
  if (lesson.isError || session.isError || !lesson.data || !sessionData) {
    return (
      <ChildShell activeTab="belajar">
        <main className="mx-auto max-w-[680px] px-4 py-6">
          <ErrorNote>Materi belum tersedia. Minta bantuan orang tua, ya.</ErrorNote>
          <div className="mt-4">
            <Link to="/anak/beranda">
              <Button variant="secondary">Kembali</Button>
            </Link>
          </div>
        </main>
      </ChildShell>
    );
  }

  const requiredUnits = units.filter((u) => u.required);
  const completedSet = new Set(sessionData.completed_unit_ids);
  const stepNumber = Math.min(index + 1, units.length);
  const isLast = index >= units.length - 1;

  function advance() {
    setFeedback(null);
    setSelectedOption(null);
    if (isLast) {
      finish.mutate();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <ChildShell activeTab="belajar">
      <main className="mx-auto max-w-[680px] px-4 pt-4">
        <header className="flex items-center gap-3">
          <Link to="/anak/beranda" className="btn-touch flex items-center justify-center rounded-full border border-border-soft bg-surface text-[18px] px-4 font-bold" aria-label="Kembali">
            ←
          </Link>
          <p className="font-extrabold text-[17px]" aria-live="polite">
            Langkah {stepNumber} dari {units.length}
          </p>
        </header>
        <div className="mt-2 h-2 rounded-full bg-surface border border-border-soft overflow-hidden" role="progressbar" aria-valuenow={sessionData.practice.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary" style={{ width: `${sessionData.practice.percent}%` }} />
        </div>

        {done ? (
          <Card className="mt-6 text-center">
            <h1 className="text-[26px] font-extrabold">Latihan selesai!</h1>
            <p className="mt-2 text-[16px] text-muted">
              Terima kasih sudah berusaha. Ini catatan latihan, bukan penilaian ketepatan bacaan.
            </p>
            <p className="mt-3 text-[18px] font-bold">
              {done.star ? (
                <>
                  <span aria-hidden="true">⭐</span> Kamu dapat satu bintang baru!
                </>
              ) : (
                "Bintang pertama sudah kamu dapat sebelumnya."
              )}
            </p>
            <div className="mt-5 grid gap-3">
              <Button
                block
                onClick={() => {
                  onChanged();
                  navigate("/anak/beranda", { replace: true });
                }}
              >
                Selesai dulu
              </Button>
            </div>
          </Card>
        ) : current ? (
          <Card className="mt-5">
            <DemoBadge />
            <p className="mt-3 text-[15px] font-bold text-muted">{current.instruction}</p>

            {current.unit_type === "letter" ? (
              <>
                <p className="arabic mt-4 text-center text-[72px] select-none" lang="ar" dir="rtl" translate="no">
                  {current.letter}
                </p>
                {/* Honest audio-unavailable state (FR-06): demo fixtures ship no audio. */}
                <p className="mt-2 rounded-2xl bg-sunny border border-[#ecd98f] px-4 py-3 text-[14px] font-semibold" role="note">
                  Audio belum tersedia. Minta bantuan orang tua, ya. Dengarkan dan ikuti. Suaramu tidak direkam.
                </p>
                <div className="mt-5">
                  <Button block onClick={() => ack.mutate(current.unit_id)} disabled={ack.isPending}>
                    {ack.isPending ? "Menyimpan…" : "Sudah berlatih"}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[13px] text-muted">Ini catatan latihan, bukan penilaian bacaan.</p>
              </>
            ) : null}

            {current.unit_type === "instruction" ? (
              <div className="mt-4">
                <Button block onClick={advance}>
                  Mulai
                </Button>
              </div>
            ) : null}

            {current.unit_type === "choice" && sessionData.current_question ? (
              <>
                <p className="mt-4 text-[20px] font-extrabold">{sessionData.current_question.prompt}</p>
                <div className="mt-4 grid gap-3" role="group" aria-label="Pilihan jawaban">
                  {sessionData.current_question.options.map((o) => {
                    const chosen = selectedOption === o.option_id;
                    const showCorrect = feedback && chosen && feedback.correct;
                    const showWrong = feedback && chosen && !feedback.correct;
                    return (
                      <button
                        key={o.option_id}
                        type="button"
                        onClick={() => !feedback && setSelectedOption(o.option_id)}
                        aria-pressed={chosen}
                        className={`btn-touch rounded-[16px] border-2 px-5 text-[28px] font-bold arabic
                          ${showCorrect ? "border-primary bg-mint" : showWrong ? "border-error bg-[#fbeaea]" : chosen ? "border-primary bg-surface" : "border-border-soft bg-surface"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {feedback ? (
                  <p className={`mt-4 font-bold text-[16px] ${feedback.correct ? "text-primary" : "text-error"}`} role="status">
                    {feedback.correct ? "Bagus, jawabanmu tepat!" : "Belum tepat. Coba dengarkan lagi, ya."}
                    {!feedback.first ? " (Jawaban pertama sudah tercatat.)" : ""}
                  </p>
                ) : null}
                <div className="mt-5">
                  {feedback ? (
                    <Button block onClick={() => { ack.mutate(current.unit_id); advance(); }} disabled={ack.isPending}>
                      Lanjut
                    </Button>
                  ) : (
                    <Button
                      block
                      disabled={!selectedOption || answer.isPending}
                      onClick={() =>
                        selectedOption &&
                        answer.mutate(selectedOption, {
                          onSuccess: (res) => setFeedback({ correct: res.correct, first: res.first_response }),
                        })
                      }
                    >
                      {answer.isPending ? "Memeriksa…" : "Periksa"}
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            {current.unit_type === "ayah" ? (
              <p className="mt-4 text-muted">Materi surat akan tersedia setelah ditinjau dan dipublikasikan.</p>
            ) : null}
          </Card>
        ) : null}

        {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}

        <p className="mt-6 text-center text-[13px] text-muted">
          {completedSet.size} dari {requiredUnits.length} langkah dilatih
        </p>
      </main>
    </ChildShell>
  );
}
