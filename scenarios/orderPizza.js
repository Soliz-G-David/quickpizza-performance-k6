// =====================================================================
// scenarios/orderPizza.js
// Flujo de negocio: un usuario entra a QuickPizza, inicia sesión,
// pide una pizza, la califica, pide otra y la vuelve a calificar.
//
// V4:
//  - Parametrización mediante CSV.
//  - Conversión de tipos correctos para el backend.
//  - Correlación de CSRF, sesión y pizza.id.
//  - Cada pizza conserva su propio ID.
//  - Distribución de calificaciones: 80% Love it / 20% No thanks.
//  - Contadores para medir la distribución de Love it / No thanks.
// =====================================================================

import http from "k6/http";
import { group, check, sleep } from "k6";
import { Counter } from "k6/metrics";

import { BASE_URL, THINK_TIME, debugLog } from "../config/settings.js";
import { htmlHeaders, apiParams, randomToken } from "../utils/http.js";
import { getCsrfToken, login, authenticate } from "../utils/auth.js";
import { getUserForVU, getRandomPizza } from "../utils/data.js";

// Contadores para verificar la distribución 80/20.
const loveItCounter = new Counter("love_it");
const noThanksCounter = new Counter("no_thanks");

function thinkTime() {
  sleep(
    THINK_TIME.min +
      Math.random() * (THINK_TIME.max - THINK_TIME.min)
  );
}

// Determina aleatoriamente si la pizza recibe Love it.
// Aproximadamente 80% = Love it
// Aproximadamente 20% = No thanks
function shouldLoveIt() {
  return Math.random() < 0.8;
}

// Pide una pizza con los datos del CSV y devuelve su ID.
// Correlación JSONPath: pizza.id
function orderPizza(token, pizzaData) {
  const res = http.post(
    `${BASE_URL}/api/pizza`,
    JSON.stringify(pizzaData),
    apiParams(token, "POST /api/pizza"),
  );

  const pizzaId = res.status === 200 ? res.json("pizza.id") : null;

  debugLog(
    `Correlación 3 (JSONPath) pizza.id ("${pizzaData.customName}")`,
    pizzaId
  );

  check(res, {
    "pizza: status 200": (r) => r.status === 200,
    "pizza: tiene id": () => pizzaId !== null,
  });

  return pizzaId;
}

// Califica una pizza.
// pizza_id debe enviarse como número porque el servidor Go espera int64.
function ratePizza(token, pizzaId, stars) {
  const res = http.post(
    `${BASE_URL}/api/ratings`,
    JSON.stringify({
      pizza_id: pizzaId,
      stars: stars,
    }),
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
    const res = http.get(
      `${BASE_URL}/`,
      Object.assign(htmlHeaders(), {
        tags: { name: "GET /" },
      }),
    );

    check(res, {
      "home: status 200": (r) => r.status === 200,
    });

    http.get(
      `${BASE_URL}/api/config`,
      apiParams(null, "GET /api/config")
    );

    http.get(
      `${BASE_URL}/api/quotes`,
      apiParams(null, "GET /api/quotes")
    );

    http.get(
      `${BASE_URL}/api/tools`,
      apiParams(anonToken, "GET /api/tools")
    );
  });

  thinkTime();

  group("02. Login", function () {
    const res = http.get(
      `${BASE_URL}/login`,
      Object.assign(htmlHeaders(`${BASE_URL}/`), {
        tags: { name: "GET /login" },
      }),
    );

    check(res, {
      "login page: status 200": (r) => r.status === 200,
    });

    const csrfToken = getCsrfToken();

    // Correlación 1: Regex
    if (!csrfToken) return;

    // Correlación 2: JSONPath
    token = login(user, csrfToken);

    if (!token) return;

    authenticate(token, user.username);

    http.get(
      `${BASE_URL}/api/ratings`,
      apiParams(token, "GET /api/ratings")
    );
  });

  // Si el login falla, no tiene sentido continuar.
  if (!token) return;

  thinkTime();

  let firstPizzaId = null;

  group("03. Pedir pizza 1", function () {
    firstPizzaId = orderPizza(
      token,
      getRandomPizza()
    );
  });

  thinkTime();

  group("04. Calificar pizza 1", function () {
    if (firstPizzaId !== null) {
      const loveIt = shouldLoveIt();

      if (loveIt) {
        loveItCounter.add(1);
        ratePizza(token, firstPizzaId, 5);
      } else {
        noThanksCounter.add(1);
        ratePizza(token, firstPizzaId, 1);
      }
    }
  });

  thinkTime();

  let secondPizzaId = null;

  group("05. Pedir pizza 2", function () {
    secondPizzaId = orderPizza(
      token,
      getRandomPizza()
    );
  });

  thinkTime();

  group("06. Calificar pizza 2", function () {
    if (secondPizzaId !== null) {
      const loveIt = shouldLoveIt();

      if (loveIt) {
        loveItCounter.add(1);
        ratePizza(token, secondPizzaId, 5);
      } else {
        noThanksCounter.add(1);
        ratePizza(token, secondPizzaId, 1);
      }
    }
  });

  thinkTime();
}
