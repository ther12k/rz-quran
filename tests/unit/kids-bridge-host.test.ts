// Bridge host logic tests (GDM-008 / QA-14 + QA-15, logic level):
// wrong origin/source/nonce/action/protocol/size/payload are rejected before
// dispatch; no cookie/CSRF value ever enters messages; stale callbacks are
// dropped after dispose; parent-gate protections are server-side (the host
// just relays the server's 403, never bypasses).
import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE_PROTOCOL_VERSION,
  createBridgeHost,
  validateBridgeMessage,
  type BridgeRequest,
} from "../../apps/web/src/kids/bridge-host";

const ORIGIN = "https://kids.example";
const NONCE = "nonce-abc-123";
const SESSION = "5e6f1a20-9b33-4a55-8c42-7d10f3c9e201";
const LESSON = "0d9a4f50-6f2f-4e1a-9c1d-52b6f0a4e101";
const QUESTION = "a1111111-2222-4c33-9d44-555555555501";
const ASSET = "00000000-0000-4000-8000-00000000d1f1";
const FAKE_WINDOW = { postMessage: () => {} };

function msg(overrides: Partial<BridgeRequest> = {}): { origin: unknown; source: unknown; data: unknown } {
  return {
    origin: ORIGIN,
    source: FAKE_WINDOW,
    data: {
      rzq_bridge: 1,
      protocol_version: BRIDGE_PROTOCOL_VERSION,
      request_id: "req-1",
      runtime_nonce: NONCE,
      action: "bootstrap",
      payload: {},
      ...overrides,
    },
  };
}

const deps = { allowedOrigin: ORIGIN, runtimeNonce: NONCE };

describe("bridge message validation (QA-14)", () => {
  it("accepts a well-formed request", () => {
    const d = validateBridgeMessage(deps, msg(), FAKE_WINDOW);
    expect(d.accept).toBe(true);
  });

  it("rejects wrong origin, wrong source window, wrong nonce", () => {
    expect(validateBridgeMessage(deps, { ...msg(), origin: "https://evil.example" }, FAKE_WINDOW)).toEqual({
      accept: false,
      reason: "origin",
    });
    expect(validateBridgeMessage(deps, msg(), { other: true })).toEqual({ accept: false, reason: "source" });
    expect(
      validateBridgeMessage(deps, msg({ runtime_nonce: "stale" }), FAKE_WINDOW),
    ).toEqual({ accept: false, reason: "nonce" });
  });

  it("rejects unknown actions, wrong protocol, malformed shape, oversized messages", () => {
    expect(validateBridgeMessage(deps, msg({ action: "eval" as never }), FAKE_WINDOW)).toEqual({
      accept: false,
      reason: "action",
    });
    expect(validateBridgeMessage(deps, msg({ protocol_version: "2" }), FAKE_WINDOW)).toEqual({
      accept: false,
      reason: "protocol",
    });
    expect(validateBridgeMessage(deps, { origin: ORIGIN, source: FAKE_WINDOW, data: "hello" }, FAKE_WINDOW)).toEqual({
      accept: false,
      reason: "shape",
    });
    expect(
      validateBridgeMessage(deps, msg({ request_id: "x".repeat(65) }), FAKE_WINDOW),
    ).toEqual({ accept: false, reason: "shape" });
    const huge = msg();
    (huge.data as Record<string, unknown>).payload = { blob: "x".repeat(70 * 1024) };
    expect(validateBridgeMessage(deps, huge, FAKE_WINDOW)).toEqual({ accept: false, reason: "size" });
  });

  it("rejects payloads with foreign fields, bad ids, or unknown option patterns", () => {
    expect(
      validateBridgeMessage(
        deps,
        msg({ action: "start_session", payload: { lesson_id: LESSON, mode: "reviewed_learning" } }),
        FAKE_WINDOW,
      ),
    ).toEqual({ accept: false, reason: "payload" });
    expect(
      validateBridgeMessage(deps, msg({ action: "submit_attempt", payload: { session_id: "nope" } }), FAKE_WINDOW),
    ).toEqual({ accept: false, reason: "payload" });
    expect(
      validateBridgeMessage(
        deps,
        msg({
          action: "submit_attempt",
          payload: { session_id: SESSION, question_id: QUESTION, selected_option_id: "../x", event_id: crypto.randomUUID() },
        }),
        FAKE_WINDOW,
      ),
    ).toEqual({ accept: false, reason: "payload" });
    // No caller-supplied URL ever passes: get_media only takes ids.
    expect(
      validateBridgeMessage(
        deps,
        msg({ action: "get_media", payload: { session_id: SESSION, asset_id: ASSET, url: "https://evil" } }),
        FAKE_WINDOW,
      ),
    ).toEqual({ accept: false, reason: "payload" });
  });
});

describe("bridge dispatch (QA-15)", () => {
  it("relays server outcomes and never injects cookie/CSRF material", async () => {
    const api = vi.fn(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/v1/me")
        return { active_child_nickname: "Aisyah", active_child_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" };
      if (method === "GET" && path === "/api/v1/catalog")
        return { items: [{ lesson_id: LESSON, access: "available", demo_only: true }] };
      if (method === "GET" && path === "/api/v1/learning/current") return { session: null };
      throw new Error("unexpected " + method + " " + path);
    });
    const post = vi.fn();
    const host = createBridgeHost({ ...deps, api, postToRuntime: post });
    const d = validateBridgeMessage(deps, msg(), FAKE_WINDOW);
    expect(d.accept).toBe(true);
    await host.dispatch((d as { accept: true }).request);

    expect(post).toHaveBeenCalledTimes(1);
    const sent = post.mock.calls[0][0] as { ok: boolean; data: Record<string, unknown> };
    expect(sent.ok).toBe(true);
    expect(sent.data.content_mode).toBe("fixture");
    // Serialized bridge traffic contains no secret material.
    expect(JSON.stringify(sent).toLowerCase().includes("cookie")).toBe(false);
    expect(JSON.stringify(sent).toLowerCase().includes("csrf")).toBe(false);
  });

  it("server parent-gate failures relay as errors — no host-side bypass", async () => {
    const api = vi.fn(async () => {
      const err = new Error("Area ini hanya untuk orang tua.") as Error & { code?: string };
      err.code = "PARENT_GATE_REQUIRED";
      throw err;
    });
    const post = vi.fn();
    const host = createBridgeHost({ ...deps, api, postToRuntime: post });
    const d = validateBridgeMessage(
      deps,
      msg({ action: "finish_session", payload: { session_id: SESSION } }),
      FAKE_WINDOW,
    );
    await host.dispatch((d as { accept: true }).request);
    expect(post).toHaveBeenCalledTimes(1);
    const sent = post.mock.calls[0][0] as { ok: boolean; error: { code: string } };
    expect(sent.ok).toBe(false);
    expect(sent.error.code).toBe("PARENT_GATE_REQUIRED");
  });

  it("media bytes are transferred as a buffer; oversized bytes fail closed", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]).buffer;
    const api = vi.fn();
    const post = vi.fn();
    const host = createBridgeHost({ ...deps, api, postToRuntime: post });
    const globalFetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "audio/wav" }),
      arrayBuffer: async () => bytes,
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = globalFetch as typeof fetch;
    try {
      const d = validateBridgeMessage(
        deps,
        msg({ action: "get_media", payload: { session_id: SESSION, asset_id: ASSET } }),
        FAKE_WINDOW,
      );
      await host.dispatch((d as { accept: true }).request);
      expect(post).toHaveBeenCalledTimes(1);
      const sent = post.mock.calls[0][0] as { ok: boolean; buffer: ArrayBuffer };
      const transfer = post.mock.calls[0][1] as ArrayBuffer[];
      expect(sent.ok).toBe(true);
      expect(new Uint8Array(sent.buffer)).toEqual(new Uint8Array(bytes));
      expect(transfer).toEqual([sent.buffer]);

      const bigHost = createBridgeHost({ ...deps, api, postToRuntime: vi.fn() });
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(4 * 1024 * 1024),
      })) as typeof fetch;
      const post2 = vi.fn();
      const big = createBridgeHost({ ...deps, api, postToRuntime: post2 });
      void bigHost;
      const d2 = validateBridgeMessage(
        deps,
        msg({ action: "get_media", payload: { session_id: SESSION, asset_id: ASSET } }),
        FAKE_WINDOW,
      );
      await big.dispatch((d2 as { accept: true }).request);
      const sent2 = post2.mock.calls[0][0] as { ok: boolean; error: { code: string } };
      expect(sent2.ok).toBe(false);
      expect(sent2.error.code).toBe("MEDIA_UNAVAILABLE");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("dispose drops in-flight callbacks: no late messages reach the runtime", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const api = vi.fn(async () => {
      await gate;
      return { session: null };
    });
    const post = vi.fn();
    const host = createBridgeHost({ ...deps, api, postToRuntime: post });
    const d = validateBridgeMessage(deps, msg(), FAKE_WINDOW);
    const pending = host.dispatch((d as { accept: true }).request);
    expect(host.inFlightCount()).toBe(1);
    host.dispose();
    expect(host.inFlightCount()).toBe(0);
    release();
    await pending;
    expect(post).not.toHaveBeenCalled();
  });
});
