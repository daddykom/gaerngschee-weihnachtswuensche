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
   [[ "$(< "$log_file")" == *'phinx migrate'*'fairgate-sync'*'rsync -a --delete --exclude=.env'* ]]
   [[ "$(< "$log_file")" == *"fairgate-sync env=$target_base/pre-prod/backend/.env pwd=$temporary_parent/gaerngschee-deploy."*'/release/backend'* ]]
   [[ "$(< "$target_base/pre-prod/backend/release-marker")" == 'new-release-backend' ]]
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
   [[ "$(< "$log_file")" == *'phinx migrate'*'fairgate-sync'*'rsync -a --delete --exclude=.env'* ]]
   [[ "$(< "$log_file")" == *"fairgate-sync env=$target_base/prod/backend/.env"* ]]
}

@test 'uses a configured deployment branch' {
  export DEPLOY_BRANCH=release
  run run_deploy pre-prod
  unset DEPLOY_BRANCH

  [ "$status" -eq 0 ]
  [[ "$(< "$log_file")" == *'git clone --branch release --single-branch'* ]]
}

@test 'does not publish pre-production when contact synchronization fails' {
  export DEPLOY_TEST_SYNC_FAIL=1
  local original_environment="$(< "$target_base/pre-prod/backend/.env")"

  run run_deploy pre-prod

  [ "$status" -eq 1 ]
  [[ "$output" == *'Fairgate contact synchronization failed:'* ]]
  [[ "$(< "$target_base/pre-prod/frontend/index.html")" == 'old-pre-prod-frontend' ]]
  [[ "$(< "$target_base/pre-prod/backend/release-marker")" == 'old-backend' ]]
  [[ "$(< "$target_base/pre-prod/backend/.env")" == "$original_environment" ]]
  [[ "$(< "$log_file")" != *'rsync -a --delete'* ]]
  [[ "$output" != *'Deployment of pre-prod completed'* ]]
}

@test 'does not publish production when contact synchronization fails' {
  export DEPLOY_TEST_SYNC_FAIL=1

  run run_deploy prod 'DEPLOY PROD'

  [ "$status" -eq 1 ]
  [[ "$output" == *'Fairgate contact synchronization failed:'* ]]
  [[ "$(< "$target_base/prod/backend/release-marker")" == 'old-backend' ]]
  [ -f "$target_base/prod/frontend-placeholder" ]
  [ ! -f "$target_base/prod/frontend/index.html" ]
  [[ "$(< "$log_file")" != *'rsync -a --delete'* ]]
}

@test 'uses the target configuration instead of inherited fake mode and credentials' {
  export APP_ENV=test FSA_MODE=fake DB_HOST=database DB_PORT=9999 DB_NAME=inherited DB_USER=inherited DB_PASS=inherited
  export FSA_BASE_URL=https://inherited.invalid FSA_ORGANIZATION_ID=inherited FSA_ACCESS_KEY=inherited FSA_PUBLIC_KEY=inherited

  run run_deploy pre-prod

  [ "$status" -eq 0 ]
  [[ "$output" == *'Fairgate contacts read: 2'* ]]
  [[ "$output" != *'synchronization skipped'* ]]
}

@test 'allows fake mode from the target environment without requiring a contact import' {
  printf 'APP_ENV=prod\nFSA_MODE=fake\n' > "$target_base/pre-prod/backend/.env"

  run run_deploy pre-prod

  [ "$status" -eq 0 ]
  [[ "$output" == *'Fairgate contact synchronization skipped: fake mode uses email-based profiles.'* ]]
  [[ "$(< "$target_base/pre-prod/backend/release-marker")" == 'new-release-backend' ]]
}

@test 'does not synchronize or publish when migration fails' {
  export DEPLOY_TEST_MIGRATION_FAIL=1

  run run_deploy pre-prod

  [ "$status" -eq 1 ]
  [[ "$output" == *'Migration failed:'* ]]
  [[ "$(< "$log_file")" != *'fairgate-sync'* ]]
  [[ "$(< "$log_file")" != *'rsync -a --delete'* ]]
  [[ "$(< "$target_base/pre-prod/backend/release-marker")" == 'old-backend' ]]
  [[ "$(< "$target_base/pre-prod/frontend/index.html")" == 'old-pre-prod-frontend' ]]
}
