// =====================================================================
// config/settings.js
// Configuración general del proyecto (URL base, tiempos de espera, debug).
// La URL se puede cambiar sin tocar el código:
//   k6 run -e BASE_URL=http://localhost:3333 scripts/quickpizza-v3-modular.js
// =====================================================================

export const BASE_URL = __ENV.BASE_URL || "https://quickpizza.grafana.com";

// Think time (segundos) entre pasos del usuario: simula a una persona real.
export const THINK_TIME = {
  min: 1,
  max: 3,
};

// Modo debug: muestra en la terminal los valores correlacionados.
//   k6 run -e DEBUG=true --vus 1 --iterations 2 scripts/quickpizza-v3-modular.js
export const DEBUG = __ENV.DEBUG === "true";

// Tiempo máximo de respuesta (ms) que validan los checks de cada petición.
// Coincide con el criterio de éxito (P95 < 500 ms). Se puede cambiar sin tocar el código:
//   k6 run -e MAX_RESPONSE_MS=800 scripts/quickpizza-v5-load.js
export const MAX_RESPONSE_MS = Number(__ENV.MAX_RESPONSE_MS) || 500;

export function debugLog(label, value) {
  if (DEBUG) {
    console.log(`[VU ${__VU} | iteración ${__ITER}] ${label} = ${value}`);
  }
}
