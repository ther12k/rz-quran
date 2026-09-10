// Kids runtime bridge host (GDM-008): fixed-action request/response bridge
// between the same-origin Godot web export (iframe) and the authenticated web
// app. Per docs/godot-mvp/architecture/platform-auth.md:
// - fixed action allowlist; no caller-supplied URLs/JS/HTML is evaluated
// - message envelope: {rzq_bridge:1, protocol_version:"1", request_id,
//   runtime_nonce, action, payload?}
// - 64 KiB JSON limit, origin + source-window + nonce validation
// - the game NEVER receives the cookie value or any CSRF secret: the host
//   performs all authenticated fetches itself (credentials: same-origin)
// - the bridge is NOT a security boundary: server parent/ownership checks
//   remain the only authority (QA-15 depends on this)
// This module is DOM-free; the React page wires it to real windows/fetch.

export const BRIDGE_PROTOCOL_VERSION = "1";
export const BRIDGE_MARKER = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;

export const BRIDGE_ACTIONS = [
  "bootstrap",
  "get_lesson",
  "start_session",
  "get_session",
  "submit_attempt",
  "submit_events",
  "finish_session",
  "abandon_session",
  "get_media",
  "exit",
] as const;
export type BridgeAction = (typeof BRIDGE_ACTIONS)[number];

export type BridgeRequest = {
  rzq_bridge: number;
  protocol_version: string;
  request_id: string;
  runtime_nonce: string;
  action: BridgeAction;
  payload?: Record<string, unknown>;
};

export type BridgeResponse =
  | { rzq_bridge: number; request_id: string; ok: true; data?: unknown; buffer?: ArrayBuffer }
  | { rzq_bridge: number; request_id: string; ok: false; error: { code: string; message: string } };

export type ApiCaller = (method: string, path: string, body?: unknown, idempotencyKey?: string) => Promise<unknown>;

export type BridgeHostDeps = {
  /** Absolute origin the runtime is served from (same-origin in practice). */
  allowedOrigin: string;
  /** Nonce minted by the host when it loaded the runtime iframe. */
  runtimeNonce: string;
  /** Perform an authenticated same-origin API call (cookies stay host-side). */
  api: ApiCaller;
  /** Send a response into the runtime window. */
  postToRuntime: (message: BridgeResponse, transfer?: ArrayBuffer[]) => void;
  /** Server-derived content mode comes from the lesson card's demo flag. */
  contentMode: "fixture" | "reviewed_learning";
};

export type BridgeDecision =
  | { accept: false; reason: "origin" | "source" | "shape" | "size" | "nonce" | "action" | "payload" | "protocol" }
  | { accept: true; request: BridgeRequest };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTION_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Structural payload checks mirroring packages/contracts kids_mvp.ts.
 *  Exact key allowlists: any foreign field (e.g. a caller-supplied URL)
 *  rejects. */
function payloadOk(action: BridgeAction, payload: unknown): boolean {
  if (payload === undefined) return action === "bootstrap" || action === "get_session" || action === "exit";
  if (!isRecord(payload)) return false;
  const keys = Object.keys(payload).sort();
  const onlyUuids = (names: string[]): boolean => {
    if (keys.length !== names.length || names.some((n, i) => keys[i] !== n)) return false;
    return names.every((n) => typeof payload[n] === "string" && UUID_RE.test(payload[n] as string));
  };
  switch (action) {
    case "start_session":
      return onlyUuids(["lesson_id"]);
    case "get_lesson":
      return onlyUuids(["lesson_id"]);
    case "get_session":
      return keys.length === 0;
    case "submit_attempt":
      return (
        onlyUuids(["event_id", "question_id", "session_id"]) &&
        typeof payload.selected_option_id === "string" &&
        OPTION_RE.test(payload.selected_option_id) &&
        keys.length === 4
      );
    case "submit_events": {
      // Exact-shape validation per progress event (mirror of the contract):
      // only unit_acknowledged crosses the bridge from the lesson flow.
      if (keys.length !== 2 || !Array.isArray(payload.events) || payload.events.length < 1 || payload.events.length > 20) {
        return false;
      }
      if (typeof payload.session_id !== "string" || !UUID_RE.test(payload.session_id as string)) return false;
      return (payload.events as unknown[]).every((raw) => {
        if (!isRecord(raw)) return false;
        const ek = Object.keys(raw);
        if (ek.length !== 5) return false;
        return (
          typeof raw.event_id === "string" &&
          UUID_RE.test(raw.event_id) &&
          typeof raw.sequence === "number" &&
          Number.isInteger(raw.sequence) &&
          raw.sequence >= 1 &&
          raw.client_at === null &&
          raw.type === "unit_acknowledged" &&
          typeof raw.unit_id === "string" &&
          UUID_RE.test(raw.unit_id)
        );
      });
    }
    case "get_media":
      return onlyUuids(["asset_id", "session_id"]);
    case "finish_session":
    case "abandon_session":
      return onlyUuids(["session_id"]);
    default:
      return keys.length === 0;
  }
}

/** Pure validation step: decide whether an incoming message may be dispatched. */
export function validateBridgeMessage(
  deps: Pick<BridgeHostDeps, "allowedOrigin" | "runtimeNonce">,
  event: { origin: unknown; source: unknown; data: unknown },
  expectedSource: unknown,
): BridgeDecision {
  if (event.origin !== deps.allowedOrigin) return { accept: false, reason: "origin" };
  if (event.source !== expectedSource) return { accept: false, reason: "source" };
  if (!isRecord(event.data)) return { accept: false, reason: "shape" };
  if (event.data.rzq_bridge !== BRIDGE_MARKER) return { accept: false, reason: "shape" };
  if (event.data.protocol_version !== BRIDGE_PROTOCOL_VERSION) return { accept: false, reason: "protocol" };
  try {
    if (JSON.stringify(event.data).length > MAX_MESSAGE_BYTES) return { accept: false, reason: "size" };
  } catch {
    return { accept: false, reason: "shape" };
  }
  if (typeof event.data.runtime_nonce !== "string" || event.data.runtime_nonce !== deps.runtimeNonce) {
    return { accept: false, reason: "nonce" };
  }
  if (typeof event.data.request_id !== "string" || event.data.request_id.length === 0 || event.data.request_id.length > 64) {
    return { accept: false, reason: "shape" };
  }
  const action = event.data.action;
  if (typeof action !== "string" || !BRIDGE_ACTIONS.includes(action as BridgeAction)) {
    return { accept: false, reason: "action" };
  }
  const payload = event.data.payload;
  if (!payloadOk(action as BridgeAction, payload)) return { accept: false, reason: "payload" };
  return {
    accept: true,
    request: {
      rzq_bridge: BRIDGE_MARKER,
      protocol_version: BRIDGE_PROTOCOL_VERSION,
      request_id: event.data.request_id,
      runtime_nonce: deps.runtimeNonce,
      action: action as BridgeAction,
      payload: (payload ?? {}) as Record<string, unknown>,
    },
  };
}

export type BridgeHost = {
  /** Handle one pre-validated request; always answers exactly once. */
  dispatch: (request: BridgeRequest) => Promise<void>;
  /** Drop all in-flight work (iframe teardown / exit). */
  dispose: () => void;
  /** Diagnostics only. */
  inFlightCount: () => number;
};

export function createBridgeHost(deps: BridgeHostDeps): BridgeHost {
  let disposed = false;
  const inFlight = new Set<string>();
  const { api, postToRuntime } = deps;

  function disposeHost() {
    disposed = true;
    inFlight.clear();
  }

  const uuid = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-fallback`;

  function ok(requestId: string, data?: unknown, buffer?: ArrayBuffer) {
    inFlight.delete(requestId);
    if (disposed) return;
    const res = { rzq_bridge: BRIDGE_MARKER, request_id: requestId, ok: true, data, buffer } as BridgeResponse;
    postToRuntime(res, buffer ? [buffer] : undefined);
  }

  function fail(requestId: string, code: string, message: string) {
    inFlight.delete(requestId);
    if (disposed) return;
    postToRuntime({ rzq_bridge: BRIDGE_MARKER, request_id: requestId, ok: false, error: { code, message } });
  }

  async function dispatch(request: BridgeRequest): Promise<void> {
    if (disposed) return;
    const id = request.request_id;
    inFlight.add(id);
    try {
      switch (request.action) {
        case "bootstrap": {
          // Client-composed bootstrap per GDM-004: me + catalog + current.
          const me = (await api("GET", "/api/v1/me")) as { active_child_nickname: string | null; active_child_id: string | null };
          const catalog = (await api("GET", "/api/v1/catalog")) as {
            items: Array<{ lesson_id: string; demo_only: boolean } & Record<string, unknown>>;
          };
          const current = (await api("GET", "/api/v1/learning/current")) as { session: unknown };
          const lesson = catalog.items.find((i) => i.access === "available") ?? null;
          ok(id, {
            contract_version: "1",
            content_mode: lesson?.demo_only ? "fixture" : deps.contentMode,
            profile: { id: me.active_child_id, nickname: me.active_child_nickname },
            lesson,
            active_session: current.session,
            server_time: new Date().toISOString(),
          });
          return;
        }
        case "start_session":
          ok(id, await api("POST", "/api/v1/learning/sessions", { lesson_id: request.payload!.lesson_id }, uuid()));
          return;
        case "get_lesson":
          ok(id, await api("GET", `/api/v1/lessons/${request.payload!.lesson_id}`));
          return;
        case "get_session":
          ok(id, await api("GET", `/api/v1/learning/sessions/${request.payload!.session_id}`));
          return;
        case "submit_attempt": {
          const p = request.payload!;
          ok(
            id,
            await api("POST", `/api/v1/learning/sessions/${p.session_id}/answers`, {
              event_id: p.event_id,
              client_at: null,
              question_id: p.question_id,
              selected_option_id: p.selected_option_id,
            }),
          );
          return;
        }
        case "submit_events":
          ok(id, await api("POST", `/api/v1/learning/sessions/${request.payload!.session_id}/events`, { events: request.payload!.events }));
          return;
        case "finish_session":
          ok(id, await api("POST", `/api/v1/learning/sessions/${request.payload!.session_id}/finish`, {}, uuid()));
          return;
        case "abandon_session":
          ok(
            id,
            await api("POST", `/api/v1/learning/sessions/${request.payload!.session_id}/abandon`, {}, uuid()),
          );
          return;
        case "get_media": {
          // Playback URL is server-issued and same-origin by contract; the host
          // fetches the bytes itself so no token/URL ever reaches the runtime.
          const p = request.payload!;
          const info = (await api(
            "GET",
            `/api/v1/media/stream/${p.asset_id}?session_id=${p.session_id}`,
          )) as unknown;
          // The gateway returns raw bytes, not JSON. api() would have failed on
          // JSON.parse; fetch bytes directly instead.
          void info;
          const res = await fetch(`/api/v1/media/stream/${p.asset_id}?session_id=${p.session_id}`, {
            credentials: "same-origin",
          });
          if (!res.ok) {
            const text = await res.text();
            let code = "MEDIA_UNAVAILABLE";
            try {
              code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? code;
            } catch {
              /* binary or empty */
            }
            fail(id, code, "Audio tidak dapat diambil.");
            return;
          }
          const buffer = await res.arrayBuffer();
          if (buffer.byteLength > 3 * 1024 * 1024) {
            fail(id, "MEDIA_UNAVAILABLE", "Audio melebihi batas.");
            return;
          }
          ok(id, { mime_type: res.headers.get("content-type") ?? "audio/wav", byte_length: buffer.byteLength }, buffer);
          return;
        }
        case "exit":
          ok(id, { exiting: true });
          disposeHost();
          return;
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? "INTERNAL_ERROR";
      fail(id, code === "NETWORK" ? "NETWORK" : code, (err as Error).message ?? "Kesalahan tak terduga.");
    }
  }

  return {
    dispatch,
    dispose: disposeHost,
    inFlightCount() {
      return inFlight.size;
    },
  };
}
