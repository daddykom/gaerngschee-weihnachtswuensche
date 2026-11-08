#!/usr/bin/env bash

setup_deploy_fixture() {
  project_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  test_directory="${BATS_TEST_TMPDIR}/deployment"
  fake_bin="$test_directory/bin"
  target_base="$test_directory/weihnachtswuensche"
  log_file="$test_directory/commands.log"
  temporary_parent="$test_directory/tmp"

  export project_directory fake_bin target_base log_file temporary_parent

  mkdir -p "$fake_bin" "$target_base/pre-prod/backend" "$target_base/pre-prod/frontend" "$target_base/prod/backend"
  printf 'APP_ENV=prod\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_NAME=gaerngschee\nDB_USER=pre-prod-user\nDB_PASS=pre-prod-pass\n' > "$target_base/pre-prod/backend/.env"
  printf 'APP_ENV=prod\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_NAME=gaerngschee\nDB_USER=prod-user\nDB_PASS=prod-pass\n' > "$target_base/prod/backend/.env"
  printf 'old-pre-prod-frontend\n' > "$target_base/pre-prod/frontend/index.html"
  printf 'old-prod-frontend\n' > "$target_base/prod/frontend-placeholder"

  cat > "$fake_bin/git" <<'FAKE_GIT'
#!/usr/bin/env bash
set -Eeuo pipefail
destination="${@: -1}"
printf 'git %s\n' "$*" >> "${DEPLOY_TEST_LOG}"
  mkdir -p "$destination/backend" "$destination/frontend" "$destination/db"
  mkdir -p "$destination/frontend/dist/frontend/browser"
  mkdir -p "$destination/frontend/public"
  mkdir -p "$destination/frontend/public/api"
  printf '<?php\n' > "$destination/frontend/public/api/index.php"
  printf 'RewriteEngine On\n' > "$destination/frontend/public/.htaccess"
  printf 'new-pre-prod-frontend\n' > "$destination/frontend/dist/frontend/browser/index.html"
FAKE_GIT

  cat > "$fake_bin/composer" <<'FAKE_COMPOSER'
#!/usr/bin/env bash
set -Eeuo pipefail
working_directory='.'
for argument in "$@"; do
  if [[ "$argument" == --working-dir=* ]]; then
    working_directory="${argument#--working-dir=}"
  fi
done
mkdir -p "$working_directory/vendor/bin"
cat > "$working_directory/vendor/bin/phinx" <<'FAKE_PHINX'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${DB_HOST:-}" == 'database' ]]; then
  printf 'unexpected inherited DB_HOST\n' >&2
  exit 1
fi
if [[ "${GAERNGSCHEE_ENV_FILE:-}" != "${DEPLOY_EXPECTED_ENV_FILE}" ]]; then
  printf 'unexpected environment file: %s\n' "${GAERNGSCHEE_ENV_FILE:-}" >&2
  exit 1
fi
printf 'phinx %s\n' "$*" >> "${DEPLOY_TEST_LOG}"
FAKE_PHINX
chmod +x "$working_directory/vendor/bin/phinx"
printf 'composer-pwd %s\n' "$PWD" >> "${DEPLOY_TEST_LOG}"
FAKE_COMPOSER

  cat > "$fake_bin/npm" <<'FAKE_NPM'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'npm %s NX_DAEMON=%s NX_SKIP_NATIVE_FILE_CACHE=%s\n' "$*" "${NX_DAEMON:-}" "${NX_SKIP_NATIVE_FILE_CACHE:-}" >> "${DEPLOY_TEST_LOG}"
if [[ "$*" == *'build'* ]]; then
  mkdir -p dist/frontend/browser
   printf 'new-pre-prod-frontend\n' > dist/frontend/browser/index.html
fi
FAKE_NPM

  cat > "$fake_bin/taskset" <<'FAKE_TASKSET'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'taskset %s\n' "$*" >> "${DEPLOY_TEST_LOG}"
shift 2
"$@"
FAKE_TASKSET

  cat > "$fake_bin/php84" <<'FAKE_PHP84'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'php84 %s\n' "$*" >> "${DEPLOY_TEST_LOG}"
"$@"
FAKE_PHP84

  chmod +x "$fake_bin"/*
}

run_deploy() {
  local environment="$1"
  local input="${2:-}"
  local command=(
    env
    "PATH=$fake_bin:/usr/bin:/bin"
    "DEPLOY_BASE_DIR=$target_base"
    "DEPLOY_TMP_DIR=$temporary_parent"
    "DEPLOY_TEST_LOG=$log_file"
    "COMPOSER_BIN=$fake_bin/composer"
    "DEPLOY_EXPECTED_ENV_FILE=$target_base/$environment/backend/.env"
    'REPO_URL=https://example.test/repository.git'
    "$project_directory/scripts/deploy-weihnachtswuensche.sh"
    "$environment"
  )

  if [[ -n "$input" ]]; then
    printf '%s\n' "$input" | "${command[@]}"
  else
    "${command[@]}"
  fi
}
