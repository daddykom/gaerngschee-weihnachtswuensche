#!/usr/bin/env bash

set -Eeuo pipefail

readonly repository_url="${REPO_URL:-https://github.com/daddykom/gaerngschee-weihnachtswuensche.git}"
readonly branch="${DEPLOY_BRANCH:-main}"
readonly base_directory="${DEPLOY_BASE_DIR:-$HOME/public_html/gaerngschee/weihnachtswuensche}"
readonly composer_binary="${COMPOSER_BIN:-$HOME/bin/composer}"
readonly build_cpu="${DEPLOY_BUILD_CPU:-0}"

usage() {
  printf 'Usage: %s <prod|pre-prod>\n' "$0" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "$1" >&2
    exit 1
  }
}

environment="${1:-}"
if [[ "$environment" != 'prod' && "$environment" != 'pre-prod' ]]; then
  usage
  exit 2
fi

if [[ "$environment" == 'prod' ]]; then
  printf 'This will deploy the PRODUCTION environment. Type "DEPLOY PROD" to continue: '
  read -r confirmation
  if [[ "$confirmation" != 'DEPLOY PROD' ]]; then
    printf 'Production deployment cancelled.\n' >&2
    exit 1
  fi
fi

for command_name in git php84 npm rsync taskset; do
  require_command "$command_name"
done

if [[ ! -f "$composer_binary" ]]; then
  printf 'Composer executable not found: %s\n' "$composer_binary" >&2
  exit 1
fi

target_directory="$base_directory/$environment"
environment_file="$target_directory/backend/.env"
if [[ ! -f "$environment_file" ]]; then
  printf 'Missing environment file: %s\n' "$environment_file" >&2
  printf 'Create it before deploying.\n' >&2
  exit 1
fi

temporary_parent="${DEPLOY_TMP_DIR:-$HOME/tmp}"
mkdir -p "$temporary_parent"
temporary_directory="$(mktemp -d "$temporary_parent/gaerngschee-deploy.XXXXXX")"
cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

git clone --branch "$branch" --single-branch "$repository_url" "$temporary_directory/source"

mkdir -p "$temporary_directory/release/backend" "$temporary_directory/release/frontend"
rsync -a "$temporary_directory/source/backend/" "$temporary_directory/release/backend/"
rsync -a "$temporary_directory/source/db/" "$temporary_directory/release/db/"
rsync -a "$environment_file" "$temporary_directory/release/backend/.env"

pushd "$target_directory" >/dev/null
php84 "$composer_binary" install --working-dir="$temporary_directory/release/backend" --no-dev --optimize-autoloader --no-interaction
popd >/dev/null

pushd "$temporary_directory/source/frontend" >/dev/null
npm ci
taskset -c "$build_cpu" env NX_DAEMON=false NX_SKIP_NATIVE_FILE_CACHE=true npm run build
popd >/dev/null

rsync -a "$temporary_directory/source/frontend/dist/frontend/browser/" "$temporary_directory/release/frontend/"
mkdir -p "$temporary_directory/release/frontend/api"
rsync -a "$temporary_directory/source/frontend/public/api/" "$temporary_directory/release/frontend/api/"
rsync -a "$temporary_directory/source/frontend/public/.htaccess" "$temporary_directory/release/frontend/.htaccess"

phinx_environment='production'

(
  cd "$temporary_directory/release/backend"
  unset ADMIN_SEED_PASSWORD DB_HOST DB_PORT DB_NAME DB_TEST_NAME DB_USER DB_PASS
  export GAERNGSCHEE_ENV_FILE="$environment_file"
  php84 vendor/bin/phinx migrate -e "$phinx_environment" -c "$temporary_directory/release/db/phinx.php"
)

mkdir -p "$target_directory/backend" "$target_directory/frontend"
rsync -a --delete --exclude='.env' "$temporary_directory/release/backend/" "$target_directory/backend/"
rsync -a --delete "$temporary_directory/release/frontend/" "$target_directory/frontend/"

printf 'Deployment of %s completed in %s\n' "$environment" "$target_directory"