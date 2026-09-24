#!/usr/bin/env bash
# RESEARCH ONLY (docs/20). Downloads the public price lists listed in real-sources.json into $1
# (default: ./bench-raw, which is git-ignored by convention: do not commit third-party files)
# and checks their SHA-256 against the copies measured on 2026-09-24. Suppliers replace their files,
# so a mismatch usually means a newer list, not a broken download. Requires curl, unzip, jq, sha256sum.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${1:-bench-raw}"
mkdir -p "$dest"
jq -r '.sources[].files[] | [.local, .url, .sha256] | @tsv' "$here/real-sources.json" |
  while IFS=$'\t' read -r name url sha; do
    code=$(curl -sL -A "Mozilla/5.0" --max-time 120 -o "$dest/$name" -w '%{http_code}' "$url" || echo 000)
    got=$(sha256sum "$dest/$name" 2>/dev/null | cut -c1-64 || true)
    if [[ "$got" == "$sha" ]]; then status=same; else status="DIFFERENT (newer list or error page)"; fi
    printf '%-36s HTTP %s  %s\n' "$name" "$code" "$status"
  done
unzip -o -q "$dest/camba_sabana_20260830.zip" -d "$dest/camba_sabana" || true
unzip -o -q "$dest/camba_lista_20260830.zip" -d "$dest/camba_lista" || true
echo "Files in $dest. Next: python $here/ground_truth.py $dest <gt dir>, then the real-*.ts scripts (see docs/20 §2)."
