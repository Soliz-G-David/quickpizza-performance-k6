#!/usr/bin/env bash
set -euo pipefail

profile="${1:-smoke}"
if (( $# > 0 )); then shift; fi
case "$profile" in
  smoke|load|spike|stress) ;;
  *) echo 'Perfil válido: smoke, load, spike o stress.' >&2; exit 2 ;;
esac

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
mkdir -p reports
run_id="quickpizza-${profile}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
export K6_PROMETHEUS_RW_SERVER_URL="${K6_PROMETHEUS_RW_SERVER_URL:-http://127.0.0.1:9090/api/v1/write}"
export K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true
export K6_PROMETHEUS_RW_STALE_MARKERS=true

echo "Ejecución: $run_id"
k6 run --out experimental-prometheus-rw \
  --tag "testid=$run_id" --tag "profile=$profile" \
  --summary-export "reports/${run_id}.json" \
  "$@" "scripts/quickpizza-v5-${profile}.js"
