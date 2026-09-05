// Typed API client: same-origin fetch, JSON, error envelope from docs/05.
export type Me = {
  mode: "parent" | "child" | "staff";
  email_verified: boolean;
  parent_gate_until: string | null;
  active_child_id: string | null;
  active_child_nickname: string | null;
  eligibility_status: "pending" | "approved" | "blocked";
  effective_consent: boolean;
  staff_capabilities: string[];
};

export type ApiErrorShape = {
  error: { code: string; message: string; request_id: string; details?: unknown };
};

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, shape: ApiErrorShape["error"]) {
    super(shape.message);
    this.code = shape.code;
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    credentials: "same-origin",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const shape = (json as ApiErrorShape | null)?.error ?? {
      code: "NETWORK",
      message: "Tidak dapat terhubung. Coba lagi, ya.",
      request_id: "-",
    };
    throw new ApiError(res.status, shape);
  }
  return json as T;
}

export const api = {
  me: () => request<Me>("GET", "/api/v1/me"),
  signUp: (input: { name: string; email: string; password: string }) =>
    request<{ user: { id: string } }>("POST", "/api/auth/sign-up/email", input),
  signIn: (input: { email: string; password: string }) =>
    request<{ user: { id: string } }>("POST", "/api/auth/sign-in/email", input),
  signOut: () => request<unknown>("POST", "/api/auth/sign-out"),
  unlockGate: (password: string) => request<Me>("POST", "/api/v1/parent/gate", { password }),
  recordConsent: (input: {
    action: "grant" | "withdraw";
    scope: "family" | "child";
    child_id: string | null;
    purpose: "profile_learning";
    notice_version: string;
    policy_version: string;
    assurance_token: string | null;
  }) => request<{ id: string }>("POST", "/api/v1/parent/consents", input, crypto.randomUUID()),
  listChildren: () => request<{ items: ChildDto[]; next_cursor: string | null }>("GET", "/api/v1/parent/children"),
  createChild: (input: { nickname: string; avatar_key: string; age_band: "5_7" | "8_10" }) =>
    request<ChildDto>("POST", "/api/v1/parent/children", input, crypto.randomUUID()),
  enterChildMode: (childId: string) => request<ChildDto>("POST", `/api/v1/parent/children/${childId}/enter`, {}),
  catalog: () => request<{ items: LessonCardDto[] }>("GET", "/api/v1/catalog"),
  lesson: (lessonId: string) => request<PublicLessonDto>("GET", `/api/v1/lessons/${lessonId}`),
  currentSession: () => request<{ session: SessionDto | null }>("GET", "/api/v1/learning/current"),
  startSession: (lessonId: string) =>
    request<SessionDto>("POST", "/api/v1/learning/sessions", { lesson_id: lessonId }, crypto.randomUUID()),
  submitEvents: (sessionId: string, events: unknown[]) =>
    request<{ last_sequence: number; results: { replayed: boolean }[] }>(
      "POST",
      `/api/v1/learning/sessions/${sessionId}/events`,
      { events },
    ),
  submitAnswer: (sessionId: string, input: { event_id: string; client_at: string | null; question_id: string; selected_option_id: string }) =>
    request<{ correct: boolean; first_response: boolean; replayed: boolean }>(
      "POST",
      `/api/v1/learning/sessions/${sessionId}/answers`,
      input,
    ),
  finishSession: (sessionId: string) =>
    request<{ status: string; star_awarded: boolean }>("POST", `/api/v1/learning/sessions/${sessionId}/finish`, {}, crypto.randomUUID()),
  childProgress: () => request<{ stars: number }>("GET", "/api/v1/learning/progress"),
  parentProgress: (childId: string) => request<ParentProgressDto>("GET", `/api/v1/parent/children/${childId}/progress`),
};

export type ChildDto = {
  id: string;
  nickname: string;
  avatar_key: string;
  age_band: "5_7" | "8_10";
  status: string;
  created_at: string;
};

export type LessonCardDto = {
  lesson_id: string;
  version_id: string;
  title: string;
  lesson_type: "listening" | "surah" | "quiz" | "game";
  stage_key: string;
  estimated_minutes: number;
  access: "available" | "locked";
  demo_only?: boolean;
  practice: { completed_units: number; required_units: number; percent: number };
};

export type PublicUnitDto = {
  unit_id: string;
  ordinal: number;
  unit_type: "instruction" | "letter" | "ayah" | "choice";
  required: boolean;
  instruction: string;
  letter: string | null;
  verse_ref: unknown;
  canonical_text: string | null;
  audio_asset_id: string | null;
};

export type PublicLessonDto = {
  lesson_id: string;
  version_id: string;
  title: string;
  lesson_type: string;
  demo_only: boolean;
  units: PublicUnitDto[];
  attributions: { source_title: string; source_version: string; attribution: string; reciter_name: string | null }[];
};

export type SessionDto = {
  session_id: string;
  lesson_id: string;
  version_id: string;
  status: string;
  last_sequence: number;
  completed_unit_ids: string[];
  current_question: { question_id: string; unit_id: string; prompt: string; options: { option_id: string; label: string }[] } | null;
  practice: { completed_units: number; required_units: number; percent: number };
  estimated_active_ms: number;
  expires_at: string;
};

export type ParentProgressDto = {
  child_id: string;
  interval_days: number;
  timezone: string;
  lessons_completed: number;
  lessons_total: number;
  distinct_surahs_practiced: number;
  quiz_first_answers: number;
  quiz_correct_first_answers: number;
  quiz_accuracy_percent: number | null;
  estimated_active_ms: number;
  daily: { local_date: string; estimated_active_ms: number; completed_sessions: number }[];
  lessons: {
    lesson_id: string;
    title: string;
    lesson_type: string;
    completed: boolean;
    practice: { completed_units: number; required_units: number; percent: number };
    last_practiced_at: string | null;
  }[];
};
