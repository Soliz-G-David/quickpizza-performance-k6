// =====================================================================
// utils/csv.js
// Lector de CSV simple (sin librerías externas) para usar dentro de SharedArray.
// Formato esperado: primera fila = encabezados, separador = coma,
// sin comas dentro de los valores.
// =====================================================================

export function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] || "").trim();
    });
    return row;
  });
}
