#!/usr/bin/env bats

load './support/deploy-fixtures'

setup() {
  setup_deploy_fixture
}

@test 'rejects an invalid environment' {
  run "$project_directory/scripts/deploy-weihnachtswuensche.sh" staging

  [ "$status" -eq 2 ]
  [[ "$output" == *'Usage:'* ]]
}

@test 'rejects a deployment without an environment file' {
  rm "$target_base/pre-prod/backend/.env"

  run run_deploy pre-prod

  [ "$status" -eq 1 ]
  [[ "$output" == *"Missing environment file: $target_base/pre-prod/backend/.env"* ]]
  [[ "$(< "$target_base/pre-prod/frontend/index.html")" == 'old-pre-prod-frontend' ]]
}

@test 'deploys the pre-production environment with the production migration environment' {
  printf 'stale-file\n' > "$target_base/pre-prod/frontend/stale.html"
  export GAERNGSCHEE_ENV_FILE="$target_base/pre-prod/backend/.env.example"

  run run_deploy pre-prod
  unset GAERNGSCHEE_ENV_FILE

  [ "$status" -eq 0 ]
  [ -f "$target_base/pre-prod/frontend/index.html" ]
  [ -f "$target_base/pre-prod/frontend/api/index.php" ]
  [ -f "$target_base/pre-prod/frontend/.htaccess" ]
  [ ! -f "$target_base/pre-prod/frontend/stale.html" ]
  [[ "$(< "$target_base/pre-prod/backend/.env")" == APP_ENV=prod* ]]
  [[ "$(< "$log_file")" == *'git clone --branch main --single-branch https://example.test/repository.git'* ]]
  [[ "$(< "$log_file")" == *"composer-pwd $target_base/pre-prod"* ]]
  [[ "$(< "$log_file")" == *'php84 '* ]]
  [[ "$(< "$log_file")" == *'npm ci'* ]]
   [[ "$(< "$log_file")" == *'taskset -c 0'* ]]
   [[ "$(< "$log_file")" == *'npm run build NX_DAEMON=false NX_SKIP_NATIVE_FILE_CACHE=true'* ]]
   [[ "$(< "$log_file")" == *'phinx migrate -e production'* ]]
   [[ "$(< "$log_file")" != *'phinx seed:run'* ]]
}

@test 'requires explicit confirmation for production deployment' {
  run run_deploy prod NO

  [ "$status" -eq 1 ]
  [[ "$output" == *'Production deployment cancelled.'* ]]
  [ -f "$target_base/prod/frontend-placeholder" ]
  [ ! -f "$log_file" ]
}

@test 'deploys the production environment with the production migration environment' {
  run run_deploy prod 'DEPLOY PROD'

  [ "$status" -eq 0 ]
  [ -f "$target_base/prod/frontend/index.html" ]
  [[ "$(< "$target_base/prod/backend/.env")" == APP_ENV=prod* ]]
   [[ "$(< "$log_file")" == *"composer-pwd $target_base/prod"* ]]
   [[ "$(< "$log_file")" == *'phinx migrate -e production'* ]]
   [[ "$(< "$log_file")" != *'phinx seed:run'* ]]
}

@test 'uses a configured deployment branch' {
  export DEPLOY_BRANCH=release
  run run_deploy pre-prod
  unset DEPLOY_BRANCH

  [ "$status" -eq 0 ]
  [[ "$(< "$log_file")" == *'git clone --branch release --single-branch'* ]]
}
