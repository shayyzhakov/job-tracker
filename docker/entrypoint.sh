#!/bin/sh
set -e
# With arguments, run them instead of the server (e.g. a one-off task overriding the command).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec node --conditions=production dist/server.js
