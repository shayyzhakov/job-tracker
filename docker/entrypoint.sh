#!/bin/sh
set -e
# Apply migrations on start when asked (handy locally; on AWS prefer a one-off migration task).
if [ "$MIGRATE_ON_START" = "true" ]; then
  node --conditions=production dist/db/migrate.js
fi
exec node --conditions=production dist/server.js
