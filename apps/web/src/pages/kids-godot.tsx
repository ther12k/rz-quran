// Kids Godot runtime host page (GDM-008). Embeds the same-origin web export
// and bridges fixed actions to authenticated API calls. The runtime never sees
// cookies/CSRF; the bridge is availability plumbing, not a security boundary —
// the server keeps enforcing every authorization check.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { apiRequest } from "../api.ts";
import {
  createBridgeHost,
  validateBridgeMessage,
  type BridgeResponse,
} from "../kids/bridge-host.ts";

export default function KidsGodotRuntimePage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<ReturnType<typeof createBridgeHost> | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Minted once per page load; the runtime must echo it on every request.
  const runtimeNonce = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    [],
  );
  const runtimeUrl = `/kids-runtime/index.html?rzq_nonce=${encodeURIComponent(runtimeNonce)}`;

  const exitToChildHome = useCallback(() => {
    hostRef.current?.dispose();
    navigate("/anak/beranda");
  }, [navigate]);

  useEffect(() => {
    const host = createBridgeHost({
      allowedOrigin: window.location.origin,
      runtimeNonce,
      api: apiRequest,
      contentMode: "fixture",
      postToRuntime: (message: BridgeResponse, transfer?: ArrayBuffer[]) => {
        if (import.meta.env.DEV) console.log(`[bridge] posting response req=${message.request_id} ok=${message.ok}`);
        iframeRef.current?.contentWindow?.postMessage(message, window.location.origin, transfer ?? []);
      },
    });
    hostRef.current = host;

    const onMessage = (event: MessageEvent) => {
      const decision = validateBridgeMessage(
        { allowedOrigin: window.location.origin, runtimeNonce },
        { origin: event.origin, source: event.source, data: event.data },
        iframeRef.current?.contentWindow ?? null,
      );
      if (import.meta.env.DEV) {
        // Live-debug aid (GDM-008 integration): shows accept/reject reasons.
        console.log(
          `[bridge] ${decision.accept ? "accept" : `reject:${decision.reason}`} req=${String((event.data as { request_id?: string })?.request_id)}`,
        );
      }
      if (!decision.accept) {
        // Wrong origin/source/nonce/action: drop silently before any dispatch.
        return;
      }
      void host.dispatch(decision.request);
    };
    window.addEventListener("message", onMessage);

    const iframe = iframeRef.current;
    const onUnload = () => host.dispose();
    iframe?.addEventListener("unload", onUnload);

    return () => {
      window.removeEventListener("message", onMessage);
      iframe?.removeEventListener("unload", onUnload);
      host.dispose();
    };
  }, [runtimeNonce]);

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <button
          type="button"
          onClick={exitToChildHome}
          className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Keluar
        </button>
        <span className="text-xs text-gray-400">Mode latihan Godot (fixture)</span>
      </div>
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold text-gray-700">Memuat latihan…</p>
          <p className="max-w-xs text-sm text-gray-400">
            Jika latihan tidak muncul, perangkat ini mungkin tidak mendukung WebGL 2.
          </p>
        </div>
      )}
      {runtimeError && (
        <div className="absolute inset-x-0 bottom-0 bg-red-50 p-3 text-sm text-red-700">{runtimeError}</div>
      )}
      <iframe
        ref={iframeRef}
        title="Latihan Godot"
        src={runtimeUrl}
        className="h-full w-full flex-1 border-0"
        onLoad={() => setReady(true)}
        allow="autoplay"
      />
    </div>
  );
}
