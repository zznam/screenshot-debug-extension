#!/usr/bin/env bash
set -euo pipefail

CLI_DEV=false
CLI_FIREFOX=false
CLI_ENV=development
cli_values=()

for arg in "$@"; do
  if [[ "$arg" != *=* ]]; then
    echo "Expected KEY=value: $arg" >&2
    exit 1
  fi
  key="${arg%%=*}"
  value="${arg#*=}"
  if [[ ! "$key" =~ ^CLI_[A-Z0-9_]+$ || "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "Invalid CLI setting: $key" >&2
    exit 1
  fi
  case "$key" in
    CLI_DEV|CLI_FIREFOX)
      if [[ "$value" != true && "$value" != false ]]; then
        echo "Invalid value for $key. Use true or false." >&2
        exit 1
      fi
      if [[ "$key" == CLI_DEV ]]; then CLI_DEV="$value"; else CLI_FIREFOX="$value"; fi
      ;;
    CLI_ENV)
      if [[ "$value" != development && "$value" != production ]]; then
        echo 'CLI_ENV must be development or production.' >&2
        exit 1
      fi
      CLI_ENV="$value"
      ;;
    *) cli_values+=("$key=$value") ;;
  esac
done

# A clean checkout has no ignored environment files. Use the tracked defaults.
env_source=".env.$CLI_ENV"
if [[ ! -f "$env_source" ]]; then env_source=.example.env; fi
if [[ ! -f "$env_source" ]]; then
  echo "Missing environment defaults: $env_source" >&2
  exit 1
fi

env_temp=$(mktemp .env.tmp.XXXXXX)
trap 'rm -f "$env_temp"' EXIT
{
  printf '# Generated build settings\nCLI_DEV=%s\nCLI_FIREFOX=%s\nCLI_ENV=%s\n' "$CLI_DEV" "$CLI_FIREFOX" "$CLI_ENV"
  for value in "${cli_values[@]+${cli_values[@]}}"; do
    if [[ -n "$value" ]]; then printf '%s\n' "$value"; fi
  done
  printf '\n# Values from %s\n' "$env_source"
  # Caller-provided build flags take precedence over stale values in local files.
  awk '!/^[[:space:]]*(export[[:space:]]+)?CLI_[A-Z0-9_]+[[:space:]]*=/' "$env_source"
} > "$env_temp"
mv "$env_temp" .env
