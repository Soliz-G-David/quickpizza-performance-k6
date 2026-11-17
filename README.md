# QuickPizza – Pruebas de Performance con k6

Proyecto final del Diplomado en Testing de Software (UCB).
Pruebas de carga sobre la app de demostración **QuickPizza** de Grafana, usando **Grafana k6 Studio** y **k6**.

- **App bajo prueba:** https://quickpizza.grafana.com
- **Herramientas:** Grafana k6 Studio 2.1.3 · k6 · Grafana Cloud k6

---

## Escenario de negocio

Un usuario entra a QuickPizza, inicia sesión, pide una pizza y la califica:

1. **HomePage**: abre la página principal.
2. **Login**: obtiene el `csrf_token` e inicia sesión.
3. **Pedir pizza**: presiona *Pizza, Please!*.
4. **No thanks**: rechaza la pizza (1 estrella).
5. **Pedir otra pizza**.
6. **Love it**: acepta la pizza (5 estrellas).

---

## Estructura del proyecto

```
quickpizza-performance-k6/
├── scripts/      # Scripts de k6 (una versión por etapa del proyecto)
├── data/         # Archivos de datos (CSV) para parametrización
├── reports/      # Reportes HTML generados por k6 (no se suben a git)
├── docs/         # Capturas e informe
└── README.md
```

---

## Versiones del proyecto

| Versión | Descripción | Estado |
|---|---|---|
| **v1** | Script generado automáticamente por k6 Studio (grabación + asistente) | ✅ |
| **v2** | Correlaciones: `csrf_token` (automática), sesión por cookie y `pizza_id` (manual) | ✅ |
| **v3** | Parametrización con CSV de 30 pizzas + 100 usuarios virtuales + think time | ⏳ |
| **v4** | Filtros del CSV con tipos correctos + comportamiento 80 % *Love it* / 20 % *No thanks* | ⏳ |
| **v5** | Thresholds, checks y reporte final | ⏳ |

### Hallazgos de la v1 → v2

- El asistente de k6 Studio detectó automáticamente la correlación del **`csrf_token`**.
- **No** detectó la correlación del **`pizza_id`** → las calificaciones (`POST /api/ratings`) fallaban con **400**.
- Al correlacionar `pizza_id` en modo **JSON**, k6 Studio lo enviaba como **texto** (`"20623"`) y el servidor
  respondía: `cannot unmarshal string into Go struct field Rating.pizza_id of type int64`.
- **Solución:** Extractor en JSON (`pizza.id`) + Replacer en modo **Begin-End** (`"pizza_id":` … `,`), que inserta el número sin comillas → **201 Created**.

---

## Cómo ejecutar

### Requisitos
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) instalado (`k6 version`)
- (Opcional) Grafana k6 Studio para abrir y editar las grabaciones

### Prueba rápida (smoke)
```bash
k6 run --vus 1 --iterations 1 scripts/quickpizza-v2-correlacion.js
```

### Prueba de carga con dashboard en vivo
PowerShell:
```powershell
$env:K6_WEB_DASHBOARD="true"
$env:K6_WEB_DASHBOARD_EXPORT="reports/reporte.html"
k6 run scripts/quickpizza-v2-correlacion.js
```
Dashboard en vivo: http://localhost:5665

---

## Nota
`quickpizza.grafana.com` es un entorno **público y compartido** publicado por Grafana para practicar.
Las pruebas de carga se mantienen cortas y con *think time* para no saturarlo.

## Equipo
- David Soliz Garcia
- _(agregar integrantes)_
