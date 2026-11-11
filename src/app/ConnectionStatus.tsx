import React, { useEffect, useState } from "react";

type Sample = { ping: number; server: number };

type ConnectionSample = Sample | "offline" | null;

export function useConnectionSample(open: boolean) {
  const [sample, setSample] = useState<ConnectionSample>(null);

  useEffect(() => {
    if (!open) { setSample(null); return; }
    let current: AbortController | undefined;
    function offline() {
      current?.abort();
      setSample("offline");
    }
    async function measure() {
      if (!navigator.onLine) return offline();
      current?.abort();
      const request = new AbortController();
      current = request;
      const timeout = window.setTimeout(() => {
        if (request.signal.aborted) return;
        request.abort();
        setSample("offline");
      }, 4000);
      try {
        const start = performance.now();
        const response = await fetch("/api/connection", { signal: request.signal, cache: "no-store" });
        const ping = Math.round(performance.now() - start);
        const header = response.headers.get("X-Server-Time-Ms");
        const server = Number(header);
        if (response.status !== 204 || !header || !Number.isFinite(server) || server < 0) throw Error();
        if (!request.signal.aborted) setSample({ ping, server });
      } catch {
        if (!request.signal.aborted) setSample("offline");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void measure();
    const interval = window.setInterval(measure, 5000);
    window.addEventListener("offline", offline);
    window.addEventListener("online", measure);
    return () => {
      window.clearInterval(interval);
      current?.abort();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", measure);
    };
  }, [open]);
  return sample;
}

export function ConnectionStatus({ sample }: { sample: ConnectionSample }) {

  return <div role="group" aria-label="Качество связи" className="connection-status">
    {sample === "offline" ? "Нет связи" : sample === null ? "Проверка связи…" : <>
      <span>{sample.ping < 150 ? "Хорошая связь" : sample.ping < 400 ? "Средняя задержка" : "Высокая задержка"}</span>
      <span>PING {sample.ping} мс</span><span>SERVER {sample.server} мс</span>
    </>}
  </div>;
}
