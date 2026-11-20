// =====================================================================
// utils/auth.js
// Autenticación y correlación de tokens.
//
// Correlación 1 (Regex):    csrf_token  -> se extrae de la cabecera Set-Cookie
// Correlación 2 (JSONPath): token       -> se extrae del body JSON del login
// =====================================================================

import http from "k6/http";
import { checkResponseTime } from "./checks.js";
import { check } from "k6";
import { BASE_URL, debugLog } from "../config/settings.js";
import { apiParams } from "./http.js";

// ---------------------------------------------------------------------
// POST /api/csrf-token
// El servidor responde con: Set-Cookie: csrf_token=XXXX; Path=/; SameSite=Strict
// ---------------------------------------------------------------------
export function getCsrfToken() {
  const res = http.post(`${BASE_URL}/api/csrf-token`, null, {
    headers: { accept: "*/*", origin: BASE_URL, referer: `${BASE_URL}/login` },
    tags: { name: "POST /api/csrf-token" },
  });

  checkResponseTime(res, "POST /api/csrf-token");

  // Se valida que la cabecera exista antes de aplicar la regex
  // (en la v2 un header vacío rompía la iteración).
  const setCookie = res.headers["Set-Cookie"] || "";
  const match = setCookie.match(/csrf_token=([A-Za-z0-9]+);/);
  const csrfToken = match ? match[1] : null;
  debugLog("Correlación 1 (Regex)    csrf_token", csrfToken);

  check(res, {
    "csrf: status 200": (r) => r.status === 200,
    "csrf: token extraído": () => csrfToken !== null,
  });

  return csrfToken;
}

// ---------------------------------------------------------------------
// POST /api/users/token/login?set_cookie=true
// El csrf enviado en el body debe coincidir con la cookie csrf_token.
// Respuesta: { "token": "XXXXXXXXXXXXXXXX" }  -> se extrae con JSONPath
// ---------------------------------------------------------------------
export function login(user, csrfToken) {
  const params = apiParams(null, "POST /api/users/token/login", `${BASE_URL}/login`);
  // Se envía la cookie csrf_token de forma explícita (igual que en la v2):
  // el servidor compara esta cookie con el campo "csrf" del body.
  params.cookies = {
    csrf_token: { value: csrfToken, replace: true },
  };

  const res = http.post(
    `${BASE_URL}/api/users/token/login?set_cookie=true`,
    JSON.stringify({
      username: user.username,
      password: user.password,
      csrf: csrfToken,
    }),
    params,
  );

  checkResponseTime(res, "POST /api/users/token/login");

  const token = res.status === 200 ? res.json("token") : null;
  debugLog("Correlación 2 (JSONPath) token de sesión", token);

  if (res.status !== 200) {
    console.warn(`[login] ${user.username} -> status ${res.status} | body: ${res.body}`);
  }

  check(res, {
    "login: status 200": (r) => r.status === 200,
    "login: token de 16 caracteres": () => token !== null && token.length === 16,
  });

  return token;
}

// ---------------------------------------------------------------------
// POST /api/users/token/authenticate
// Confirma que el token capturado es válido y pertenece al usuario.
// ---------------------------------------------------------------------
export function authenticate(token, username) {
  const res = http.post(
    `${BASE_URL}/api/users/token/authenticate`,
    null,
    apiParams(token, "POST /api/users/token/authenticate"),
  );

  checkResponseTime(res, "POST /api/users/token/authenticate");

  check(res, {
    "authenticate: status 200": (r) => r.status === 200,
    "authenticate: usuario correcto": (r) => r.status === 200 && r.json("username") === username,
  });

  return res;
}
