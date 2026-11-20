# 2.c y 2.d · Checks de tiempos y Grafana local

Esta entrega incorpora checks por solicitud y un dashboard de Grafana con RPS, P90/P95/P99, errores HTTP y usuarios virtuales activos. La conexión utiliza k6 → Prometheus → Grafana, con ejecutables instalados en el equipo.

## 1. Checks de tiempos de respuesta

`utils/checks.js` comprueba `response.timings.duration < 500` en cada solicitud del flujo modular, incluidas las llamadas auxiliares, autenticación, pedidos y valoraciones. Registra las etiquetas `kind=response_time` y `endpoint` para consultar los resultados. Una solicitud con status 0 falla este check.

El límite se configura con `MAX_RESPONSE_MS`, expresado en milisegundos. Por ejemplo, `k6 run -e MAX_RESPONSE_MS=700 scripts/quickpizza-v5-smoke.js` cambia el límite de los checks. Los thresholds existentes mantienen P95 < 500 ms y errores HTTP < 1 %. Cambiar el límite del check no modifica esos thresholds.

Los perfiles v5 muestran P90, P95 y P99 en el resumen de consola. Los checks describen el cumplimiento por respuesta, mientras que los thresholds determinan el código de salida de k6 para toda la prueba. `http_req_duration` incluye envío, espera y recepción HTTP. La conexión TCP/TLS y el think time se registran por separado.

## 2. Instalar los ejecutables

La integración fue validada con k6 2.4.0, Prometheus 3.16.0 y Grafana 12.3.0. Prometheus debe admitir histogramas nativos. Las versiones indicadas permiten ejecutar los comandos de esta guía.

Descargas oficiales para Windows y Linux:

- [k6 2.4.0](https://github.com/grafana/k6/releases/tag/v2.4.0).
- [Prometheus 3.16.0](https://github.com/prometheus/prometheus/releases/tag/v3.16.0).
- [Grafana 12.3.0](https://grafana.com/grafana/download/12.3.0).

En Windows, extraer k6 y Prometheus y agregar sus carpetas al PATH. Instalar Grafana con el instalador de Windows y arrancar su servicio. Si se utiliza el ZIP de Grafana, ejecutar su servidor desde la carpeta de instalación según la documentación oficial.

En macOS se pueden instalar con Homebrew:

```bash
brew install k6 prometheus grafana
brew services start grafana
```

Verificar `k6 version` y `prometheus --version`. Los comandos de Prometheus siguientes corresponden a la versión 3.16.0. En versiones anteriores que lo requieran, agregar `--enable-feature=native-histograms`.

La salida `experimental-prometheus-rw` funciona en la versión de k6 validada. k6 2.4.0 avisa que se retirará en v3. Esta entrega utiliza la versión compatible indicada.

## 3. Iniciar Prometheus

Abrir una terminal en la raíz del repositorio y mantener el proceso abierto.

PowerShell:

```powershell
New-Item -ItemType Directory -Force .local/prometheus | Out-Null
prometheus.exe --config.file=observability/prometheus.yml --web.enable-remote-write-receiver --web.listen-address=127.0.0.1:9090 --storage.tsdb.path=.local/prometheus
```

macOS / Linux:

```bash
mkdir -p .local/prometheus
prometheus --config.file=observability/prometheus.yml \
  --web.enable-remote-write-receiver \
  --web.listen-address=127.0.0.1:9090 \
  --storage.tsdb.path=.local/prometheus
```

Abrir `http://127.0.0.1:9090/-/ready`. Debe responder `Prometheus Server is Ready.`. El flag `--web.enable-remote-write-receiver` habilita el endpoint `/api/v1/write` que recibe las métricas de k6.

## 4. Conectar Grafana e importar el dashboard

1. Abrir `http://127.0.0.1:3000` e ingresar a Grafana. Una instalación nueva utiliza las credenciales iniciales indicadas por Grafana y solicita cambiar la contraseña.
2. Ir a **Connections → Data sources → Add data source → Prometheus**.
3. Usar `http://127.0.0.1:9090` como URL y configurar **Scrape interval = 5s**, para que la ventana de consulta corresponda al intervalo de envío de k6.
4. Pulsar **Save & test** y confirmar que Grafana puede consultar Prometheus.
5. Ir a **Dashboards → New → Import**, cargar `observability/quickpizza-dashboard.json` y elegir el datasource Prometheus del paso anterior.
6. Importar el dashboard **QuickPizza · Rendimiento k6**.

## 5. Enviar métricas de k6

En otra terminal, desde la raíz del proyecto:

PowerShell:

```powershell
./scripts/run-grafana.ps1 -Profile smoke -K6Arguments @('--iterations', '4')
```

macOS / Linux:

```bash
bash scripts/run-grafana.sh smoke --iterations 4
```

El script activa los histogramas nativos, configura el destino remote write, asigna un `testid` único y guarda el resumen en `reports/<testid>.json`. Al finalizar, envía marcadores de cierre de las series para que Grafana refleje el fin de la prueba. Los errores y el incumplimiento de thresholds conservan el código de salida de k6.

La demostración anterior ejecuta cuatro iteraciones con un usuario para obtener muestras suficientes por serie y representar las tasas del dashboard. Para verificar rápidamente el flujo con la única iteración del perfil smoke original:

```powershell
./scripts/run-grafana.ps1 -Profile smoke
```

```bash
bash scripts/run-grafana.sh smoke
```

Para utilizar otro perfil, cambiar `smoke` por `load`, `spike` o `stress`. Los perfiles mantienen las cargas definidas por el equipo en los scripts v5.

## 6. Leer el dashboard

Seleccionar el identificador mostrado por el runner en el filtro **Ejecución**. Usar el rango **Last 15 minutes** y refresco de **5s**. Las tasas necesitan al menos dos muestras por serie. Una única iteración smoke puede dejar RPS y percentiles por ventana sin datos porque cada endpoint y grupo puede aportar una sola muestra. La demostración de cuatro iteraciones permite obtener las muestras requeridas. Si se ejecutó la prueba antes de abrir el dashboard, actualizar el filtro o recargarlo. Para revisar pruebas antiguas, ajustar el rango temporal a su fecha.

| Panel | Cálculo e interpretación |
|---|---|
| RPS | Suma de la tasa de `k6_http_reqs_total` por ventana móvil. |
| P90/P95/P99 | `histogram_quantile` sobre la suma de tasas de histogramas de duración. Se convierten segundos a milisegundos. |
| Errores HTTP | Tasa de requests con `expected_response=false` dividida entre la tasa total, expresada en porcentaje. |
| VUs | Valor de `k6_vus` para la ejecución seleccionada. |
| Checks de tiempo | Tasa acumulada de checks con `kind=response_time`, desglosada por endpoint y grupo. |

El panel de latencia calcula percentiles aproximados sobre una ventana móvil. El resumen final de k6 calcula sus percentiles sobre todas las solicitudes de la ejecución. La línea de 500 ms referencia el objetivo P95 y la línea del 1 % referencia el objetivo de errores HTTP. Los fallos funcionales y de tiempo aparecen también en los checks de k6.

Cada ejecución corresponde a un proceso de k6. El filtro de ejecución selecciona un único `testid`. Los histogramas permiten combinar las duraciones de los endpoints para calcular los percentiles de ese proceso.

## 7. Problemas habituales

| Síntoma | Acción |
|---|---|
| Conexión rechazada en 9090 | Mantener Prometheus abierto y comprobar `http://127.0.0.1:9090/-/ready`. |
| HTTP 404 al enviar métricas | Iniciar Prometheus con `--web.enable-remote-write-receiver`. |
| RPS aparece pero los percentiles están vacíos | Ejecutar mediante el runner para activar histogramas nativos y comprobar la versión de Prometheus. |
| Dashboard vacío | Revisar datasource, rango temporal, filtro Ejecución y errores de envío en la terminal de k6. |
| k6 termina con código 99 | Revisar los thresholds. Un P95 mayor o igual a 500 ms incumple el objetivo del proyecto. |
| PowerShell bloquea el archivo `.ps1` | Revisar la política de ejecución del equipo o utilizar los comandos equivalentes de k6 indicados en la documentación oficial. |

## 8. Entregar mediante rama y Pull Request

La rama preparada es `feature/checks-tiempos-grafana`. Con los cambios aplicados y confirmados en esa rama:

```bash
git push -u origin feature/checks-tiempos-grafana
```

En GitHub crear un Pull Request con base `main` y compare `feature/checks-tiempos-grafana`. Adjuntar las evidencias y esperar la revisión del equipo.

Título sugerido del PR: **Añadir checks de tiempos y dashboard Grafana sin Docker**.

Para obtener las evidencias de entrega, guardar el resumen de k6 y capturar el dashboard mostrando el filtro de ejecución y sus cuatro métricas solicitadas. Un resultado que incumpla el umbral debe documentarse con su valor observado.

## Fuentes oficiales

- [k6 · Prometheus remote write](https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/).
- [k6 · Checks](https://grafana.com/docs/k6/latest/using-k6/checks/).
- [k6 · Métricas HTTP](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/).
- [Prometheus · Parámetros del servidor](https://prometheus.io/docs/prometheus/latest/command-line/prometheus/).
- [Grafana · Instalación en Windows](https://grafana.com/docs/grafana/latest/setup-grafana/installation/windows/).

## 9. Validación realizada

La versión anterior, preparada sobre `56ce305`, se validó el 18 de noviembre de 2026 en Linux, con un usuario virtual y cuatro iteraciones sobre `https://quickpizza.grafana.com`.

| Resultado | Valor observado |
|---|---|
| Solicitudes HTTP | 52 |
| P90 | 260,19 ms |
| P95 | 271,35 ms |
| P99 | 563,62 ms |
| Errores HTTP | 0 % |
| Checks totales | 107 aprobados de 108 |
| Checks de tiempo | 51 aprobados de 52 |
| Thresholds y salida de k6 | Cumplidos, código 0 |

El check fallido corresponde a una respuesta de la página inicial de 846,48 ms. La ejecución cumplió el objetivo agregado P95 < 500 ms.

Se validó la importación del JSON en Grafana, la recepción remote write en Prometheus, la lectura desde el datasource de Grafana y la devolución de series numéricas para todas las consultas del dashboard. Una prueba sintética local con la mitad de solicitudes HTTP 500 confirmó que el panel de errores representa aproximadamente 50 %.

Se verificaron los límites de 499, 500 y 501 ms del helper, las respuestas con status 0, los tiempos no finitos, la sintaxis JavaScript/Bash y la configuración de Prometheus. El runner de PowerShell queda pendiente de ejecución en Windows.

## Compatibilidad con el repositorio actualizado

Este parche se preparó sobre `0495851`, después de la incorporación de checks de contenido y tiempo por el equipo en `229b19f`. Los checks de tiempo usan `MAX_RESPONSE_MS` y se centralizan en el helper para etiquetar sus métricas por endpoint. Los checks de contenido se conservan. Los resultados anteriores corresponden a la versión validada el 18 de noviembre. La versión actualizada se verifica por separado.

La prueba smoke de esta versión actualizada completó una iteración y 13 solicitudes con 0 % de errores HTTP. Se aprobaron 33 de 34 checks. El check de tiempo de la página inicial detectó 910,40 ms y el P95 global fue de 565,29 ms, por encima del objetivo de 500 ms. k6 devolvió el código 99 por incumplimiento del threshold de latencia.
