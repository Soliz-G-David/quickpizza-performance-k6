// =====================================================================
// utils/data.js
// Parametrización de datos con SharedArray.
//
// SharedArray lee el archivo UNA sola vez y comparte los datos (solo lectura)
// entre todos los VUs, en lugar de que cada VU cargue su propia copia.
// Con 100 VUs esto reduce mucho el consumo de memoria.
//
// Importante: SharedArray solo se puede crear en el "init context"
// (fuera de default/setup/teardown), por eso se exporta como constante.
// =====================================================================

import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { parseCsv } from "./csv.js";

// ---- Usuarios (credenciales) -----------------------------------------
export const users = new SharedArray("users", function () {
  return parseCsv(open("../data/users.csv"));
});

// ---- Pizzas (datos del formulario "Pizza, Please!") -------------------
// Se convierten los tipos aquí (número / booleano / lista),
// porque el servidor en Go espera tipos correctos en el JSON.
export const pizzas = new SharedArray("pizzas", function () {
  return parseCsv(open("../data/pizzas.csv")).map((p) => ({
    customName: p.customName,
    maxCaloriesPerSlice: Number(p.maxCaloriesPerSlice),
    mustBeVegetarian: p.mustBeVegetarian === "true",
    minNumberOfToppings: Number(p.minNumberOfToppings),
    maxNumberOfToppings: Number(p.maxNumberOfToppings),
    excludedIngredients: [],
    excludedTools: p.excludedTools ? p.excludedTools.split("|") : [],
  }));
});

// Cada VU usa siempre el mismo usuario (VU 1 -> user01, VU 2 -> user02, ...).
// Si hay más VUs que usuarios, se reparten de forma circular.
export function getUserForVU() {
  return users[(exec.vu.idInTest - 1) % users.length];
}

// Cada pedido usa una pizza aleatoria del CSV.
export function getRandomPizza() {
  return pizzas[Math.floor(Math.random() * pizzas.length)];
}
