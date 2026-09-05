// S07 / S08 / S09 / S10 Comprehensive Learning Player (M2):
// - T028: Audio controller lifecycle & token cancellation
// - T030: Listen-and-imitate steps with 1x / 3x repeat options
// - T031: Short-surah & ayah practice with authentic Tanzil Arabic
// - T034: 5-question Quiz UI with instant feedback and retries
// - T035: Sound-matching 5-round game
// - T040: Soft session goals & rest suggestions
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, type SessionDto } from "../api.ts";
import { Button, Card, DemoBadge, ErrorNote } from "../components/ui.tsx";
import { ChildShell } from "./child-home.tsx";
import { audioController } from "../audio/controller.ts";

function newEventId() {
  return crypto.randomUUID();
}

export function LessonPlayerPage({ onChanged }: { onChanged: () => void }) {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => api.lesson(lessonId),
    enabled: lessonId !== "",
  });
  const session = useQuery({
    queryKey: ["session", lessonId],
    queryFn: () => api.startSession(lessonId),
    enabled: lessonId !== "",
  });

  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<null | { correct: boolean; first: boolean }>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [repeatGoal, setRepeatGoal] = useState<1 | 3>(1);
  const [repeatCount, setRepeatCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { star: boolean }>(null);
  const seqRef = useRef<number | null>(null);
  const resumedRef = useRef(false);

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
      try {
        const res = await api.submitEvents(sessionData!.session_id, [event]);
        seqRef.current = sequence;
        return res;
      } catch (e) {
        if (e instanceof ApiError && e.code === "EVENT_SEQUENCE_CONFLICT") {
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
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal menyimpan progres. Coba lagi."),
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
      seqRef.current = (seqRef.current ?? sessionData!.last_sequence) + 1;
      return res;
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal mengirim jawaban."),
  });

  const finish = useMutation({
    mutationFn: () => api.finishSession(sessionData!.session_id),
    onSuccess: (res) => {
      audioController.stop();
      setDone({ star: res.star_awarded });
      onChanged();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Gagal menyelesaikan latihan."),
  });

  // A different lesson still has an active session (one writable session per
  // child). Offer an honest resume path instead of a generic error.
  const sessionInUse = session.error instanceof ApiError && session.error.code === "SESSION_IN_USE";
  const activeSession = useQuery({
    queryKey: ["learning-current"],
    queryFn: () => api.currentSession(),
    enabled: sessionInUse,
  });
  // On first load of a resumed session, jump to the first unfinished unit.
  useEffect(() => {
    if (resumedRef.current || !sessionData || units.length === 0) return;
    resumedRef.current = true;
    const completed = new Set(sessionData.completed_unit_ids);
    const firstIncomplete = units.findIndex((u) => !completed.has(u.unit_id));
    if (firstIncomplete > 0) setIndex(firstIncomplete);
  }, [sessionData, units]);

  if (lesson.isPending || session.isPending) {
    return (
      <ChildShell activeTab="belajar">
        <p className="p-6 text-muted font-bold text-center">Sedang menyiapkan materi…</p>
      </ChildShell>
    );
  }
  if (sessionInUse) {
    const resumeLessonId = activeSession.data?.session?.lesson_id;
    return (
      <ChildShell activeTab="belajar">
        <main className="mx-auto max-w-[680px] px-4 py-6">
          <Card className="py-8 text-center">
            <span className="text-[40px]" aria-hidden="true">📖</span>
            <h1 className="mt-2 text-[20px] font-extrabold text-ink">Masih ada latihan yang belum selesai</h1>
            <p className="mt-2 text-[15px] text-muted max-w-md mx-auto">
              Selesaikan dulu latihan yang sedang berjalan, ya. Satu latihan aktif setiap saat supaya proses belajarmu tercatat dengan rapi.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              {resumeLessonId ? (
                <Button onClick={() => navigate(`/anak/belajar/${resumeLessonId}`)}>Lanjutkan Latihan</Button>
              ) : null}
              <Link to="/anak/belajar">
                <Button variant="secondary">Lihat Materi Lain</Button>
              </Link>
            </div>
          </Card>
        </main>
      </ChildShell>
    );
  }
  if (lesson.isError || session.isError || !lesson.data || !sessionData) {
    return (
      <ChildShell activeTab="belajar">
        <main className="mx-auto max-w-[680px] px-4 py-6">
          <ErrorNote>Materi belajar belum tersedia. Minta bantuan orang tua, ya.</ErrorNote>
          <div className="mt-4">
            <Link to="/anak/belajar">
              <Button variant="secondary">Lihat Materi Lain</Button>
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
    setRepeatCount(0);
    audioController.stop();
    if (isLast) {
      finish.mutate();
    } else {
      setIndex((i) => i + 1);
    }
  }

  const isSurah = lesson.data.lesson_type === "surah";
  const isQuiz = lesson.data.lesson_type === "quiz";
  const isGame = lesson.data.lesson_type === "game";

  return (
    <ChildShell activeTab="belajar">
      <main className="mx-auto max-w-[680px] px-4 pt-4">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/anak/belajar"
              onClick={() => audioController.stop()}
              className="btn-touch flex items-center justify-center rounded-full border border-border-soft bg-surface text-[18px] px-4 font-bold"
              aria-label="Kembali ke katalog"
            >
              ←
            </Link>
            <div>
              <p className="text-[13px] font-bold text-primary uppercase">
                {isSurah ? "Hafalan Surat Pendek" : isQuiz ? "Kuis Interaktif" : isGame ? "Permainan Huruf" : "Latihan Mandiri"}
              </p>
              <h1 className="text-[17px] font-extrabold text-ink truncate max-w-[240px] sm:max-w-md">
                {lesson.data.title}
              </h1>
            </div>
          </div>
          <span className="text-[13px] font-bold text-muted" aria-live="polite">
            {stepNumber} / {units.length}
          </span>
        </header>

        {/* Progress bar */}
        <div
          className="mt-3 h-2 rounded-full bg-surface border border-border-soft overflow-hidden"
          role="progressbar"
          aria-valuenow={sessionData.practice.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${sessionData.practice.percent}%` }} />
        </div>

        {done ? (
          /* Completion Screen */
          <Card className="mt-6 text-center py-8">
            <span className="text-[48px]" aria-hidden="true">🎉</span>
            <h2 className="mt-2 text-[26px] font-extrabold text-ink">Alhamdulillah, Selesai!</h2>
            <p className="mt-2 text-[15px] text-muted max-w-md mx-auto">
              Hebat! Kamu sudah menyelesaikan latihan ini. Ini catatan proses latihan, bukan sertifikasi bacaan.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint px-5 py-2 text-[16px] font-extrabold text-primary border border-border-soft">
              {done.star ? "⭐ Kamu mendapatkan 1 bintang baru!" : "⭐ Bintang pertama sudah kamu raih sebelumnya."}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Button
                onClick={() => {
                  onChanged();
                  navigate("/anak/beranda", { replace: true });
                }}
              >
                Selesai Belajar
              </Button>
              <Link to="/anak/belajar">
                <Button variant="secondary">Pilih Materi Lain</Button>
              </Link>
            </div>
          </Card>
        ) : current ? (
          /* Active Learning Step */
          <Card className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-primary">
                {isQuiz ? `Soal ${stepNumber} dari ${units.length}` : isGame ? `Babak ${stepNumber} dari ${units.length}` : `Langkah ${stepNumber}`}
              </span>
              {lesson.data.demo_only ? <DemoBadge /> : null}
            </div>

            <p className="mt-2 text-[15px] font-bold text-ink">{current.instruction}</p>

            {/* Ayah Unit (Short Surah Practice - T031) */}
            {current.unit_type === "ayah" ? (
              <div className="mt-4">
                <div className="rounded-[20px] bg-mint/50 border border-border-soft p-6 text-center">
                  <span className="inline-block rounded-full bg-surface border border-border-soft px-3 py-0.5 text-[12px] font-extrabold text-primary mb-3">
                    Ayat {current.ordinal}
                  </span>
                  <p
                    className="arabic text-[36px] sm:text-[44px] text-ink select-none font-bold leading-relaxed"
                    lang="ar"
                    dir="rtl"
                    translate="no"
                  >
                    {current.canonical_text ?? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"}
                  </p>
                </div>

                {/* Repeat count target (1x / 3x) */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-muted">Target latihan ayat ini:</span>
                  <div className="flex gap-2">
                    {([1, 3] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setRepeatGoal(count)}
                        className={`btn-touch px-3.5 py-1 rounded-xl text-[13px] font-extrabold border ${
                          repeatGoal === count ? "bg-primary text-white border-primary" : "bg-surface border-border-soft"
                        }`}
                      >
                        {count} kali
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio notice */}
                <p className="mt-3 rounded-2xl bg-sunny border border-[#ecd98f] px-4 py-2.5 text-[13px] font-semibold text-ink/80" role="note">
                  Dengarkan pelafalan murottal dari orang tua atau bimbingan, lalu tirukan dengan jelas. Suaramu tidak direkam.
                </p>

                <div className="mt-5 flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setRepeatCount((c) => c + 1)}
                  >
                    Ulangi ({repeatCount}/{repeatGoal})
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      ack.mutate(current.unit_id);
                      advance();
                    }}
                    disabled={ack.isPending}
                  >
                    {ack.isPending ? "Menyimpan…" : "Lanjut Ayat Berikutnya"}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[12px] text-muted">Catatan latihan orang tua menentukan ketepatan hafalan.</p>
              </div>
            ) : null}

            {/* Letter Unit (Hijaiyah Practice - T030) */}
            {current.unit_type === "letter" ? (
              <div className="mt-4">
                <div className="rounded-[20px] bg-mint/40 border border-border-soft py-8 text-center">
                  <p className="arabic text-[72px] sm:text-[84px] text-primary select-none" lang="ar" dir="rtl" translate="no">
                    {current.letter}
                  </p>
                </div>

                <p className="mt-3 rounded-2xl bg-sunny border border-[#ecd98f] px-4 py-2.5 text-[13px] font-semibold text-ink/80" role="note">
                  Audio belum tersedia untuk contoh demo ini. Tirukan bentuk huruf ini bersama orang tua. Suaramu tidak direkam.
                </p>

                <div className="mt-5">
                  <Button
                    block
                    onClick={() => {
                      ack.mutate(current.unit_id);
                      advance();
                    }}
                    disabled={ack.isPending}
                  >
                    {ack.isPending ? "Menyimpan…" : "Sudah Berlatih"}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[12px] text-muted">Ini catatan latihan, bukan sertifikasi bacaan.</p>
              </div>
            ) : null}

            {/* Instruction Unit */}
            {current.unit_type === "instruction" ? (
              <div className="mt-6">
                <Button block onClick={advance}>
                  Mulai
                </Button>
              </div>
            ) : null}

            {/* Choice / Quiz / Game Round Unit (T032, T034, T035) */}
            {current.unit_type === "choice" && sessionData.current_question ? (
              <div className="mt-4">
                <p className="text-[18px] font-extrabold text-ink">{sessionData.current_question.prompt}</p>

                <div className="mt-4 grid gap-2.5" role="group" aria-label="Pilihan jawaban">
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
                        className={`btn-touch rounded-2xl border-2 px-5 py-3.5 text-center font-bold transition-all ${
                          o.label.length <= 3 ? "arabic text-[32px]" : "text-[17px]"
                        } ${
                          showCorrect
                            ? "border-primary bg-mint text-primary"
                            : showWrong
                            ? "border-error bg-[#fbeaea] text-error"
                            : chosen
                            ? "border-primary bg-surface shadow-sm"
                            : "border-border-soft bg-surface hover:bg-mint/30"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>

                {feedback ? (
                  <div
                    className={`mt-4 rounded-2xl p-3.5 text-[15px] font-bold ${
                      feedback.correct ? "bg-mint text-primary" : "bg-[#fbeaea] text-error"
                    }`}
                    role="status"
                  >
                    {feedback.correct ? "🌟 Hebat, jawabanmu tepat!" : "Belum tepat, tidak apa-apa! Tetap semangat ya."}
                    {!feedback.first ? " (Catatan: nilai pertama yang disimpan.)" : ""}
                  </div>
                ) : null}

                <div className="mt-5">
                  {feedback ? (
                    <Button
                      block
                      onClick={() => {
                        ack.mutate(current.unit_id);
                        advance();
                      }}
                      disabled={ack.isPending}
                    >
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
              </div>
            ) : null}
          </Card>
        ) : null}

        {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}

        {/* Bottom footer with break affordance (T040) */}
        <div className="mt-8 text-center pb-6">
          <button
            type="button"
            onClick={() => {
              audioController.stop();
              onChanged();
              navigate("/anak/beranda");
            }}
            className="text-[14px] font-bold text-muted hover:text-ink underline"
          >
            Selesai dulu dan istirahat
          </button>
          <p className="mt-1 text-[12px] text-muted">
            Kamu bisa kembali melanjutkan kapan saja dari langkah ini.
          </p>
        </div>
      </main>
    </ChildShell>
  );
}
