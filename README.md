# QuickPizza – Pruebas de Performance con k6

Proyecto final del Diplomado en Testing de Software V6 (UCB) – Módulo Testing de Performance.
Evaluación de rendimiento de la app de demostración **QuickPizza** de Grafana, usando **Grafana k6 Studio**, **k6** y **Grafana**.

- **App bajo prueba:** https://quickpizza.grafana.com
- **Herramientas:** Grafana k6 Studio 2.1.3 · k6 · Grafana

---

## Escenario de negocio

Un usuario entra a QuickPizza, inicia sesión, pide una pizza y la califica:

1. **HomePage**: abre la página principal.
2. **Login**: obtiene el `csrf_token` e inicia sesión.
3. **Pedir pizza 1**: presiona *Pizza, Please!*.
4. **No thanks**: rechaza la pizza 1 (1 estrella).
5. **Pedir pizza 2**.
6. **Love it**: acepta la pizza 2 (5 estrellas).

---

## Estructura del proyecto

```
quickpizza-performance-k6/
├── config/
│   └── settings.js          # URL base (BASE_URL) y think time
├── data/
│   ├── users.csv            # Credenciales (usuario default de QuickPizza)
│   └── pizzas.csv           # 30 pizzas (datos del formulario)
├── utils/
│   ├── csv.js               # Lector de CSV
│   ├── data.js              # SharedArray de usuarios y pizzas
│   ├── http.js              # Cabeceras y token anónimo dinámico
│   └── auth.js              # csrf (Regex), login (JSONPath), authenticate
├── scenarios/
│   └── orderPizza.js        # Flujo de negocio (6 grupos)
├── scripts/                 # Script principal de cada versión del proyecto
│   ├── quickpizza-v2-correlacion.js
│   └── quickpizza-v3-modular.js
├── reports/                 # Reportes HTML generados por k6 (no se suben a git)
├── docs/                    # Capturas e informe
└── README.md
```

---

## Versiones del proyecto

| Versión | Descripción | Estado |
|---|---|---|
| **v1** | Script generado automáticamente por k6 Studio (grabación + asistente) | ✅ |
| **v2** | Correlaciones: `csrf_token` (automática), sesión por cookie y `pizza_id` (manual) | ✅ |
| **v3** | Estructura modular + parametrización con **SharedArray** (credenciales y 30 pizzas desde CSV) + 100 VUs + think time + corrección de errores de la v2 | ✅ |
| **v4** | Checks de negocio (tiempos y contenido) + comportamiento 80 % *Love it* / 20 % *No thanks* | ⏳ |
| **v5** | Thresholds con las metas del proyecto + perfiles de carga (smoke, load, spike, stress) | ⏳ |
| **v6** | Métricas en tiempo real hacia Grafana local + dashboard | ⏳ |

### Hallazgos de la v1 → v2

- El asistente de k6 Studio detectó automáticamente la correlación del **`csrf_token`**.
- **No** detectó la correlación del **`pizza_id`** → las calificaciones (`POST /api/ratings`) fallaban con **400**.
- Al correlacionar `pizza_id` en modo **JSON**, k6 Studio lo enviaba como **texto** (`"20623"`) y el servidor
  respondía: `cannot unmarshal string into Go struct field Rating.pizza_id of type int64`.
- **Solución:** Extractor en JSON (`pizza.id`) + Replacer en modo **Begin-End** (`"pizza_id":` … `,`), que inserta el número sin comillas → **201 Created**.

### Hallazgos de la v2 → v3

- **"Love it" calificaba la pizza equivocada:** usaba el `pizza_id` de la primera pizza. Ahora cada pizza guarda su propio ID.
- **Pedidos duplicados:** los grupos *No thanks* y *Love it* repetían `POST /api/pizza` (ruido de la grabación), así que cada iteración pedía 4 pizzas en vez de 2 y se inflaba el RPS. Se eliminaron.
- **Tokens fijos:** la grabación dejó `Token jIxbUHeCwu0yjwtc` y `traceparent` fijos. Ahora el token anónimo se genera por VU y el token de sesión se correlaciona desde el login.
- **Usuarios propios en el sitio público:** se intentó usar 30 usuarios propios registrados con `POST /api/users`. El registro respondía
  `username already taken` (el usuario existía), pero el login del **mismo** usuario a veces respondía 200 y a veces
  `401 authentication failed`. Hipótesis: el sitio público corre **varias réplicas** detrás de un balanceador y cada una guarda
  sus propios usuarios (estado no compartido). Se usa el usuario `default`, precargado en todas las réplicas, leído desde
  `data/users.csv` con SharedArray. El login se mantiene en cada iteración como parte de la transacción completa.
- **Regex frágil:** `resp.headers["Set-Cookie"].match(...)` rompía la iteración si el header no llegaba. Ahora se valida antes.

### Correlaciones implementadas (v3)

| # | Valor | Origen | Técnica | Uso |
|---|---|---|---|---|
| 1 | `csrf_token` | Header `Set-Cookie` de `POST /api/csrf-token` | Regex `csrf_token=([A-Za-z0-9]+);` | Body del login |
| 2 | `token` de sesión | Body de `POST /api/users/token/login` | JSONPath `token` | Header `Authorization: Token ...` |
| 3 | `pizza.id` | Body de `POST /api/pizza` | JSONPath `pizza.id` | Body de `POST /api/ratings` |

---

## Cómo ejecutar

### Requisitos
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) instalado (`k6 version`)
- (Opcional) Grafana k6 Studio para abrir y editar las grabaciones

### Prueba rápida (smoke)
```bash
k6 run --vus 1 --iterations 1 scripts/quickpizza-v3-modular.js
```

### Ver las correlaciones (modo debug)
Muestra en la terminal el `csrf_token`, el token de sesión y los `pizza.id` capturados en cada iteración:
```bash
k6 run -e DEBUG=true --vus 1 --iterations 2 scripts/quickpizza-v3-modular.js
```

### Prueba de carga con dashboard en vivo
PowerShell:
```powershell
$env:K6_WEB_DASHBOARD="true"
$env:K6_WEB_DASHBOARD_EXPORT="reports/reporte.html"
k6 run scripts/quickpizza-v3-modular.js
```
Dashboard en vivo: http://localhost:5665

### Cambiar la URL de la app
```bash
k6 run -e BASE_URL=http://localhost:3333 scripts/quickpizza-v3-modular.js
```

---

## Nota
`quickpizza.grafana.com` es un entorno **público y compartido** publicado por Grafana para practicar.
Las pruebas de carga se mantienen cortas y con *think time* para no saturarlo.

## Equipo – Grupo 2
- David Soliz Garcia
- Pedro Adrian Santos Orellana
- Mauricio Gutierrez Pacheco
- Rodrigo Camilo Mendez Gallardo
- Maria Alexandra Quintanilla
- Pablo Chuquimia Huanca

Docente: Marco Luna Gonzales
