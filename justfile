###############################################################
# Minimal commands to develop, build, test, and deploy
###############################################################
set shell                          := ["bash", "-c"]
set dotenv-load                    := true
export APP_FQDN                    := env_var_or_default("APP_FQDN", "metaframe1.localhost")
export APP_PORT                    := env_var_or_default("APP_PORT", "4430")
PACKAGE_NAME_SHORT                 := file_name(`cat package.json | jq -r '.name' | sed 's!.*/!!'`)
# vite needs an extra memory boost
vite                               := "VITE_APP_FQDN=" + APP_FQDN + " VITE_APP_PORT=" + APP_PORT + " NODE_OPTIONS='--max_old_space_size=16384' ./node_modules/vite/bin/vite.js"
tsc                                := "./node_modules/typescript/bin/tsc"
# minimal formatting, bold is very useful
bold                               := '\033[1m'
normal                             := '\033[0m'
green                              := "\\e[32m"
yellow                             := "\\e[33m"
blue                               := "\\e[34m"
magenta                            := "\\e[35m"
grey                               := "\\e[90m"

# If not in docker, get inside
@_help:
    echo -e ""
    just --list --unsorted --list-heading $'🌱 Commands:\n\n'
    echo -e ""
    echo -e "    Github  URL 🔗 {{green}}$(cat package.json | jq -r '.repository.url'){{normal}}"
    echo -e "    Publish URL 🔗 {{green}}https://metapages.github.io/{{PACKAGE_NAME_SHORT}}/{{normal}}"
    echo -e "    Develop URL 🔗 {{green}}https://{{APP_FQDN}}:{{APP_PORT}}/{{normal}}"
    echo -e ""

# Run the dev server. Opens the web app in browser.
dev: _mkcert _ensure_npm_modules (_tsc "--build")
    #!/usr/bin/env bash
    set -euo pipefail
    APP_ORIGIN=https://${APP_FQDN}:${APP_PORT}
    npm i
    export HOST={{APP_FQDN}}
    export PORT={{APP_PORT}}
    export CERT_FILE=.certs/{{APP_FQDN}}.pem
    export CERT_KEY_FILE=.certs/{{APP_FQDN}}-key.pem
    export BASE=
    VITE_APP_ORIGIN=${APP_ORIGIN} {{vite}} --clearScreen false --open

# Build the client in editor/dist
build: _ensure_npm_modules
    {{vite}} build

@deploy: _ensure_deployctl check build
  deployctl deploy --prod --project=metaframe-molstar --entrypoint=server.ts --include=./dist --include=./server.ts

# Check the build
check: _ensure_npm_modules (_tsc "--build")

# Test: currently bare minimum: only building. Need proper test harness.
@test: check

# compile typescript src, may or may not emit artifacts
_tsc +args="": _ensure_npm_modules
    {{tsc}} {{args}}

# DEV: generate TLS certs for HTTPS over localhost https://blog.filippo.io/mkcert-valid-https-certificates-for-localhost/
@_mkcert:
    APP_FQDN={{APP_FQDN}} CERTS_DIR=.certs deno run --allow-all https://deno.land/x/metapages@v0.0.27/commands/ensure_mkcert.ts

@_ensure_npm_modules:
    if [ ! -f "{{tsc}}" ]; then npm i; fi

# vite builder commands
@_vite +args="":
    {{vite}} {{args}}

@_ensure_deployctl:
    if ! command -v deployctl &> /dev/null; then echo '‼️ deployctl is being installed ‼️'; deno install -gArf jsr:@deno/deployctl; fi
