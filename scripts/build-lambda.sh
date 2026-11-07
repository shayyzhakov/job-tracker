#!/usr/bin/env bash
# Bundles the API and scout Lambdas into dist-lambda/{api,scout}/ (one minified ESM file each).
# OpenTofu zips these directories (archive_file), so no zip step is needed here.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist-lambda
rm -rf "$OUT"
mkdir -p "$OUT/api" "$OUT/scout"

# createRequire banner: some CommonJS dependencies call require() inside an ESM bundle.
BANNER="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
bundle() { # <entry> <outfile>
  pnpm exec esbuild "$1" --bundle --platform=node --target=node24 --format=esm --minify \
    --banner:js="$BANNER" --legal-comments=none --outfile="$2"
}
bundle apps/api/src/lambda.ts "$OUT/api/index.mjs"
bundle apps/worker/src/handler.ts "$OUT/scout/index.mjs"
cp apps/worker/fixtures/listings.json "$OUT/scout/listings.json"
du -h "$OUT"/api/index.mjs "$OUT"/scout/index.mjs
