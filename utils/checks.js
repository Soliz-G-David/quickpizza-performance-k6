import { check } from "k6";
import { MAX_RESPONSE_MS } from "../config/settings.js";

// Conserva la validación funcional y registra el tiempo de cada solicitud.
export function checkResponseTime(response, endpoint) {
  return check(response, {
    [`${endpoint}: tiempo < ${MAX_RESPONSE_MS} ms`]: (r) =>
      r.status > 0 && Number.isFinite(r.timings.duration) &&
      r.timings.duration < MAX_RESPONSE_MS,
  }, { kind: "response_time", endpoint });
}
