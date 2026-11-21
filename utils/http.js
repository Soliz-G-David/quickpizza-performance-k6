// =====================================================================
// utils/http.js
// Funciones de apoyo para armar cabeceras y valores dinámicos.
// Reemplaza los valores fijos que dejó la grabación de k6 Studio
// (tokens "Token jIxbUHeCwu0yjwtc", traceparent, etc.).
// =====================================================================

import { BASE_URL } from "../config/settings.js";

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Token anónimo de 16 caracteres, igual al que genera el frontend de QuickPizza
// antes de iniciar sesión. Se genera uno nuevo por VU en vez de usar el grabado.
export function randomToken(length = 16) {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
  }
  return token;
}

// Cabeceras para pedir páginas HTML.
export function htmlHeaders(referer) {
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  if (referer) headers.referer = referer;
  return { headers };
}

// Cabeceras para llamadas a la API (JSON).
// tags.name agrupa las métricas por endpoint en Grafana / resumen de k6.
export function apiParams(token, name, referer = `${BASE_URL}/`) {
  const headers = {
    accept: "*/*",
    "content-type": "application/json",
    origin: BASE_URL,
    referer,
  };
  if (token) headers.authorization = `Token ${token}`;
  return { headers, tags: { name } };
}

// Respuestas de error o degradadas pueden no contener JSON válido.
export function jsonBody(response) {
  try {
    return response.json();
  } catch (e) {
    return null;
  }
}
