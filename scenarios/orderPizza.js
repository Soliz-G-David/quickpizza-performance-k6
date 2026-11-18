// =====================================================================
// scenarios/orderPizza.js
// Flujo de negocio: un usuario entra a QuickPizza, inicia sesión,
// pide una pizza y la rechaza (No thanks), pide otra y le encanta (Love it).
//
// Correcciones respecto a la v2:
//  - Se eliminaron los POST /api/pizza duplicados de los grupos
//    "No thanks" y "Love it" (ruido de la grabación).
//  - Cada pizza guarda su propio ID: "Love it" ahora califica la
//    segunda pizza y no la primera.
//  - Se quitaron los tokens y traceparent fijos de la grabación.
// =====================================================================

import http from "k6/http";
import { group, check, sleep } from "k6";
import { BASE_URL, THINK_TIME, debugLog } from "../config/settings.js";
import { htmlHeaders, apiParams, randomToken } from "../utils/http.js";
import { getCsrfToken, login, authenticate } from "../utils/auth.js";
import { getUserForVU, getRandomPizza } from "../utils/data.js";

function thinkTime() {
  sleep(THINK_TIME.min + Math.random() * (THINK_TIME.max - THINK_TIME.min));
}

// Pide una pizza con los datos del CSV y devuelve su ID (correlación JSONPath).
function orderPizza(token, pizzaData) {
  const res = http.post(
    `${BASE_URL}/api/pizza`,
    JSON.stringify(pizzaData),
    apiParams(token, "POST /api/pizza"),
  );

  const pizzaId = res.status === 200 ? res.json("pizza.id") : null;
  debugLog(`Correlación 3 (JSONPath) pizza.id ("${pizzaData.customName}")`, pizzaId);

  check(res, {
    "pizza: status 200": (r) => r.status === 200,
    "pizza: tiene id": () => pizzaId !== null,
  });

  return pizzaId;
}

// Califica una pizza. pizza_id va como número (el servidor Go espera int64).
function ratePizza(token, pizzaId, stars) {
  const res = http.post(
    `${BASE_URL}/api/ratings`,
    JSON.stringify({ pizza_id: pizzaId, stars: stars }),
    apiParams(token, "POST /api/ratings"),
  );

  check(res, {
    "rating: status 201": (r) => r.status === 201,
  });

  return res;
}

export function orderPizzaFlow() {
  const user = getUserForVU();
  const anonToken = randomToken();
  let token = null;

  group("01. HomePage", function () {
    const res = http.get(`${BASE_URL}/`, Object.assign(htmlHeaders(), { tags: { name: "GET /" } }));
    check(res, { "home: status 200": (r) => r.status === 200 });

    http.get(`${BASE_URL}/api/config`, apiParams(null, "GET /api/config"));
    http.get(`${BASE_URL}/api/quotes`, apiParams(null, "GET /api/quotes"));
    http.get(`${BASE_URL}/api/tools`, apiParams(anonToken, "GET /api/tools"));
  });
  thinkTime();

  group("02. Login", function () {
    const res = http.get(
      `${BASE_URL}/login`,
      Object.assign(htmlHeaders(`${BASE_URL}/`), { tags: { name: "GET /login" } }),
    );
    check(res, { "login page: status 200": (r) => r.status === 200 });

    const csrfToken = getCsrfToken(); // Correlación 1 (Regex)
    if (!csrfToken) return;

    token = login(user, csrfToken); // Correlación 2 (JSONPath)
    if (!token) return;

    authenticate(token, user.username);
    http.get(`${BASE_URL}/api/ratings`, apiParams(token, "GET /api/ratings"));
  });

  // Si el login falla, no tiene sentido seguir con el flujo.
  if (!token) return;
  thinkTime();

  let firstPizzaId = null;
  group("03. Pedir pizza 1", function () {
    firstPizzaId = orderPizza(token, getRandomPizza()); // Correlación 3 (JSONPath)
  });
  thinkTime();

  group("04. No thanks", function () {
    if (firstPizzaId !== null) ratePizza(token, firstPizzaId, 1);
  });
  thinkTime();

  let secondPizzaId = null;
  group("05. Pedir pizza 2", function () {
    secondPizzaId = orderPizza(token, getRandomPizza());
  });
  thinkTime();

  group("06. Love it", function () {
    if (secondPizzaId !== null) ratePizza(token, secondPizzaId, 5);
  });
  thinkTime();
}
