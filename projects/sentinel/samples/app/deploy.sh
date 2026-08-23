#!/usr/bin/env bash
# Deliberately insecure fixture — see samples/README.md. Do not copy this file.
set -euo pipefail

# Credential inlined into a deploy script instead of injected by the CI runner.
REGISTRY_PASSWORD="pR0d-r3g1stry-9f2b7c"

echo "$REGISTRY_PASSWORD" | docker login registry.example.com -u deploy --password-stdin
docker build -t registry.example.com/app:latest .
docker push registry.example.com/app:latest
