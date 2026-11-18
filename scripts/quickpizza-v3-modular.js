// =====================================================================
// scripts/quickpizza-v3-modular.js
// v3: estructura modular + parametrización con SharedArray (CSV).
//
// Cada iteración ejecuta la transacción completa:
//   HomePage -> Login -> Pedir pizza 1 -> No thanks -> Pedir pizza 2 -> Love it
//
// Ejecutar (smoke):
//   k6 run --vus 1 --iterations 1 scripts/quickpizza-v3-modular.js
// Ejecutar (carga completa):
//   k6 run scripts/quickpizza-v3-modular.js
// =====================================================================

import { orderPizzaFlow } from "../scenarios/orderPizza.js";

export const options = {
  stages: [
    { target: 100, duration: "1m" }, // subida a 100 usuarios
    { target: 100, duration: "3m" }, // carga sostenida
    { target: 0, duration: "1m" }, // bajada
  ],
  // Thresholds provisionales (heredados de la v2). Se ajustan en el paso 8.
  thresholds: {
    // http_req_duration: ["p(95)<2100", "p(99)<2500"], //límites bastante permisivos
    // http_req_failed: ["rate<0.01"],

    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizzaFlow();
}
