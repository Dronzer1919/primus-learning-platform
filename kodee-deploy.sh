#!/usr/bin/env bash
# ============================================================================
#  KODEE DEPLOY SCRIPT — primuscodex.com
#
#  One command takes a VPS from "repo on GitHub" to "working site":
#    pull -> write env -> build images -> start containers -> wait until
#    Mongo and the API are actually ready -> run every seed file in order ->
#    smoke-test the running site.
#
#  Usage (on the Hostinger VPS, as root):
#      bash kodee-deploy.sh
#
#  Deploys the `dev` branch, which is where this app's code lives.
#
#  Everything below is overridable from the environment, e.g.
#      BRANCH=feature/flowchart bash kodee-deploy.sh
#      SEED_ADMIN_PASSWORD='...' SEED_USER_PASSWORD='...' bash kodee-deploy.sh
#      FORCE_USER_SEED=yes bash kodee-deploy.sh     # DANGER: wipes all users
# ============================================================================

set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/Dronzer1919/primus-learning-platform.git}"
APP_DIR="${APP_DIR:-/root/learning-platform}"
# There is no `main` branch, and `master` is an EMPTY initial commit — origin/HEAD
# points at it, but it carries no files. All the app code lives on `dev`, which is
# also what the GitHub Actions workflow deploys (see DEPLOY_DEV_AUTOMATION.md).
BRANCH="${BRANCH:-dev}"

DOMAIN="${DOMAIN:-primuscodex.com}"
API_HOST_PORT="${API_HOST_PORT:-3100}"   # published as 127.0.0.1:3100 -> container :3001
WEB_HOST_PORT="${WEB_HOST_PORT:-8081}"   # published as 127.0.0.1:8081 -> container :80
MONGO_DB_NAME="${MONGO_DB_NAME:-learning-platform}"

API_CONTAINER="lp-api"
WEB_CONTAINER="lp-web"
MONGO_CONTAINER="lp-mongo"

# Seeding behaviour. seed.js DELETES every user/topic/tab, so it is treated as a
# first-install step: it runs only when the database has no users yet, unless you
# explicitly ask for it again with FORCE_USER_SEED=yes. The content seeds are
# idempotent by design and run on every deploy.
FORCE_USER_SEED="${FORCE_USER_SEED:-no}"
SKIP_SEED="${SKIP_SEED:-no}"

# Password for the `testuser` guest account. This one is deliberately NOT secret:
# the login page prefills it so visitors can look around in one click, which means
# it ships in the JavaScript bundle for anyone to read.
#
# It must match `demoLogin.password` in learning-platform/src/environments/
# environment.prod.ts. Change it in both places, then redeploy with
# FORCE_USER_SEED=yes so the account is re-created with the new password.
#
# The admin password is the opposite: random, private, kept in backend/.env.
DEMO_USER_PASSWORD="${DEMO_USER_PASSWORD:-GuestDemo123}"
RECREATE_ENV="${RECREATE_ENV:-no}"       # yes = overwrite an existing backend/.env
PRUNE_IMAGES="${PRUNE_IMAGES:-yes}"      # reclaim disk from dangling build layers

# Content seeds, in dependency order. seed.js runs first (it wipes topics), then
# these add the real interview content on top. Any other seed-*.js file dropped
# into backend/ later is picked up automatically after this list.
CONTENT_SEEDS=(
  seed-html-interview.js
  seed-css-interview.js
  seed-js-interview.js
  seed-interview-content.js
)

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[36m'
else
  C_RESET=''; C_BOLD=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''
fi

STEP_NO=0
step() { STEP_NO=$((STEP_NO + 1)); printf '\n%s==== Step %s: %s ====%s\n' "$C_BOLD$C_BLUE" "$STEP_NO" "$1" "$C_RESET"; }
ok()   { printf '  %s✔%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
warn() { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
fail() { printf '  %s✘%s %s\n' "$C_RED" "$C_RESET" "$1"; }
die()  { printf '\n%sDEPLOY FAILED:%s %s\n' "$C_RED$C_BOLD" "$C_RESET" "$1" >&2; exit 1; }

# Any unexpected error under `set -e` lands here, so a failure names the line
# that caused it instead of ending on a silent non-zero exit.
trap 'die "unexpected error at line $LINENO (command: $BASH_COMMAND)"' ERR

# ---------------------------------------------------------------------------
# Step 1 — Preflight
# ---------------------------------------------------------------------------
step "Preflight checks"

command -v git >/dev/null 2>&1 || die "git is not installed. Run: apt-get update && apt-get install -y git"
command -v docker >/dev/null 2>&1 || die "docker is not installed. See deployment-scripts/initial-setup.sh"

# `docker compose` (v2 plugin) is the modern form; fall back to the old binary.
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  die "neither 'docker compose' nor 'docker-compose' is available"
fi

docker info >/dev/null 2>&1 || die "cannot talk to the Docker daemon (is it running? are you root?)"
ok "git, docker and ${DC[*]} are available"

# ---------------------------------------------------------------------------
# Step 2 — Get the code
# ---------------------------------------------------------------------------
step "Fetch code ($BRANCH)"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  # Running as root over a clone owned by another user otherwise trips git's
  # "dubious ownership" check and aborts the deploy.
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  git fetch --prune origin

  git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1 \
    || die "origin/$BRANCH does not exist. Available: $(git branch -r --format='%(refname:short)' | tr '\n' ' ')"

  # Checked BEFORE the hard reset, because the reset is destructive. `master` in
  # this repo is an empty initial commit: resetting to it deletes every file in
  # the working tree and leaves docker compose with nothing to read ("no
  # configuration file provided"). Verifying the branch actually carries the app
  # first means a wrong BRANCH value fails safely instead of wiping the VPS.
  git cat-file -e "origin/$BRANCH:docker-compose.yml" 2>/dev/null \
    || die "origin/$BRANCH has no docker-compose.yml at its root — it does not contain the app.
  Refusing to reset $APP_DIR to it (that would delete the working tree).
  The app lives on 'dev'. Re-run as:  BRANCH=dev bash kodee-deploy.sh"

  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  # Hard reset rather than pull: a deploy box should mirror the remote exactly,
  # and a stray local edit must never be able to stall a deploy with a conflict.
  # backend/.env is gitignored, so it survives this.
  git reset --hard "origin/$BRANCH"
  ok "updated existing clone at $APP_DIR"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  ok "cloned $REPO_URL into $APP_DIR"
fi

# Belt and braces for the clone path, and a clear message instead of docker's
# cryptic "no configuration file provided: not found".
[ -f docker-compose.yml ] \
  || die "docker-compose.yml is missing from $APP_DIR after checking out '$BRANCH'."

ok "now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# ---------------------------------------------------------------------------
# Step 3 — backend/.env
# ---------------------------------------------------------------------------
step "Backend environment"

ENV_FILE="backend/.env"

# Appends a key only if it is absent, so hand-edited values are never clobbered.
ensure_env_key() {
  local key="$1" value="$2"
  if ! grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    ok "added missing $key"
  fi
}

# Reads a key back out. Values are written single-quoted (see set_env_key), so
# strip the quotes on the way out.
read_env_key() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^[[:space:]]*$1=//p" "$ENV_FILE" 2>/dev/null | head -1 | sed "s/^'//; s/'\$//"
}

# Writes a key, replacing any existing line. Rebuilt through a temp file rather
# than `sed -i` because a password can contain / and & — the two characters that
# turn a sed replacement into a corrupted file.
set_env_key() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -vE "^[[:space:]]*${key}=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
  printf "%s='%s'\n" "$key" "$value" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"          # overwrite contents, keeping mode 600
  rm -f "$tmp"
}

if [ -f "$ENV_FILE" ] && [ "$RECREATE_ENV" != "yes" ]; then
  ok "$ENV_FILE already exists — keeping it (RECREATE_ENV=yes to overwrite)"
  ensure_env_key NODE_ENV production
  ensure_env_key PORT 3001
  ensure_env_key MONGODB_URI "mongodb://${MONGO_CONTAINER}:27017/${MONGO_DB_NAME}"
  ensure_env_key JWT_EXPIRE 7d
  ensure_env_key CORS_ORIGIN "https://${DOMAIN},https://www.${DOMAIN}"
else
  # A secret committed to a repo is not a secret. Generate a fresh one per
  # install and leave it in the (gitignored) .env, which is the only place it
  # belongs. Regenerating invalidates existing logins — that is why an existing
  # .env is preserved above rather than rewritten on every deploy.
  if command -v openssl >/dev/null 2>&1; then
    GENERATED_JWT_SECRET="$(openssl rand -hex 48)"
  else
    GENERATED_JWT_SECRET="$(head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi

  cat > "$ENV_FILE" << EOF
# Generated by kodee-deploy.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC').
# Gitignored on purpose — this file holds real secrets. Edit freely; re-running
# the deploy keeps this file as-is unless you pass RECREATE_ENV=yes.
NODE_ENV=production
PORT=3001

MONGODB_URI=mongodb://${MONGO_CONTAINER}:27017/${MONGO_DB_NAME}

JWT_SECRET=${JWT_SECRET:-$GENERATED_JWT_SECRET}
JWT_EXPIRE=7d

CORS_ORIGIN=${CORS_ORIGIN:-https://${DOMAIN},https://www.${DOMAIN}}

# Google Sign-In — fill these in for the "Continue with Google" button to work.
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
EOF
  chmod 600 "$ENV_FILE"
  ok "wrote a fresh $ENV_FILE (JWT secret generated, mode 600)"
fi

if ! grep -qE '^[[:space:]]*GOOGLE_CLIENT_ID=.+' "$ENV_FILE"; then
  warn "GOOGLE_CLIENT_ID is empty — Google Sign-In will not work until you set it in $ENV_FILE"
fi

# ---------------------------------------------------------------------------
# Step 4 — Build and start
# ---------------------------------------------------------------------------
step "Build images and start containers"

# Repeated deploys on a small VPS quietly fill the disk with old image layers,
# and "no space left on device" mid-build is the most common way this step dies.
# Prune dangling layers up front; drop the build cache too when space is tight.
FREE_MB="$(df -Pm /var/lib/docker 2>/dev/null | awk 'NR==2{print $4}' || true)"
[[ "$FREE_MB" =~ ^[0-9]+$ ]] || FREE_MB="$(df -Pm / | awk 'NR==2{print $4}' || true)"
[[ "$FREE_MB" =~ ^[0-9]+$ ]] || FREE_MB=999999
if [ "$FREE_MB" -lt 3072 ]; then
  warn "only ${FREE_MB}MB of disk free — pruning old images and build cache first"
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
  FREE_MB="$(df -Pm / | awk 'NR==2{print $4}' || true)"
  ok "${FREE_MB:-?}MB free after pruning"
fi

"${DC[@]}" down --remove-orphans 2>/dev/null || true

# This stack is Docker-only, but the pre-Docker deploys ran the backend under
# PM2 with a systemd boot service (deployment-scripts/initial-setup.sh). That
# service can still resurrect an OLD host copy of the API on our port: it
# answers with stale code, crash-loops (the site flaps 200/502), and blocks the
# container's bind with "address already in use". With our containers now down,
# anything still listening on our ports is such a squatter — remove it, and if
# PM2 exists, dismantle it at the source so the squatter cannot come back.
clear_port_squatter() {
  local port="$1" pid
  pid="$(ss -lntpH "sport = :$port" 2>/dev/null | grep -v docker-proxy | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
  [ -n "$pid" ] || return 0
  warn "port $port is held by a non-docker process (pid $pid):"
  ps -fp "$pid" 2>/dev/null | sed 's/^/    /' || true
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete all >/dev/null 2>&1 || true
    pm2 save --force >/dev/null 2>&1 || true
    pm2 kill >/dev/null 2>&1 || true
    systemctl disable --now pm2-root >/dev/null 2>&1 || true
    ok "PM2 processes removed and its boot service disabled"
  fi
  kill "$pid" 2>/dev/null || true
  sleep 2
  kill -9 "$pid" 2>/dev/null || true
  sleep 1
  if ss -lntH "sport = :$port" 2>/dev/null | grep -q .; then
    die "port $port is STILL occupied after killing pid $pid — something respawns it. Inspect with: ss -lntp"
  fi
  ok "port $port is free again"
}
clear_port_squatter "$API_HOST_PORT"
clear_port_squatter "$WEB_HOST_PORT"

# Build and start are separate phases so a failure names the phase that broke
# and prints that phase's diagnostics — the ERR trap alone reports only a line
# number while the real docker error scrolls away above it.
if ! "${DC[@]}" build; then
  fail "image build failed — the docker error is printed directly above"
  df -h / 2>/dev/null | sed 's/^/    /' || true
  free -m 2>/dev/null | sed 's/^/    /' || true
  die "docker build failed. Usual causes on a small VPS:
  - 'no space left on device'   -> run: docker system prune -af   then re-run this script
  - build killed (exit code 137) -> out of memory; add swap:
        fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  - npm registry network timeout -> simply re-run this script"
fi
ok "images built"

if ! "${DC[@]}" up -d; then
  fail "containers failed to start — status:"
  docker ps -a --filter name=lp- --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | sed 's/^/    /' || true
  for c in "$API_CONTAINER" "$WEB_CONTAINER" "$MONGO_CONTAINER"; do
    printf '    --- last 15 log lines: %s ---\n' "$c"
    docker logs --tail 15 "$c" 2>&1 | sed 's/^/    /' || true
  done
  die "docker compose up failed — see the docker error and logs above.
  If a port is 'already allocated', something else holds 127.0.0.1:${API_HOST_PORT} or
  127.0.0.1:${WEB_HOST_PORT} — find it with:  docker ps ; ss -ltnp
  If it says 'address already in use' but ss shows NOTHING on that port, it is a
  stale docker-proxy / iptables leftover from an earlier failed deploy — fix with:
      systemctl restart docker    then re-run this script."
fi
ok "containers started"

# ---------------------------------------------------------------------------
# Step 5 — Wait until the stack is genuinely ready
# ---------------------------------------------------------------------------
step "Wait for MongoDB and the API"

# Polling beats a fixed sleep: a cold VPS can take far longer than 8s, and a warm
# one is ready in one. Seeding against a half-open Mongo is what produces the
# "deployed fine but the site is empty" failure this replaces.
wait_for() {
  local label="$1" tries="$2"; shift 2
  local i
  for ((i = 1; i <= tries; i++)); do
    if "$@" >/dev/null 2>&1; then
      ok "$label ready (after ${i}s)"
      return 0
    fi
    sleep 1
  done
  fail "$label did not become ready within ${tries}s"
  return 1
}

mongo_ping() { docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' ; }
# node:20 ships fetch, so the API check needs no extra tooling in the image.
api_health()  { docker exec "$API_CONTAINER" node -e \
  "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" ; }
web_serving() { docker exec "$WEB_CONTAINER" wget -q -O /dev/null http://127.0.0.1/ ; }

wait_for "MongoDB" 90 mongo_ping || die "MongoDB never came up. Check: ${DC[*]} logs $MONGO_CONTAINER"
wait_for "API"     90 api_health || {
  fail "API health check failed — last 40 log lines:"
  docker logs --tail 40 "$API_CONTAINER" || true
  die "the API is not healthy; seeding would fail too"
}

# ---------------------------------------------------------------------------
# Step 6 — Seed the database
# ---------------------------------------------------------------------------
step "Seed the database"

SEED_FAILURES=()
SEED_RAN=()
ADMIN_PASSWORD_TO_REPORT=""
USER_PASSWORD_TO_REPORT=""

# Always exits 0: a count is only ever used for reporting or a guard, and a
# transient mongosh hiccup must not abort the deploy through `set -e`.
mongo_eval() {
  docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB_NAME" --quiet --eval "$1" 2>/dev/null | tr -d '\r\n ' || true
}

run_seed() {
  local file="$1"; shift
  printf '\n  %s— running %s%s\n' "$C_BOLD" "$file" "$C_RESET"
  if docker exec "$@" "$API_CONTAINER" node "$file"; then
    ok "$file completed"
    SEED_RAN+=("$file")
  else
    fail "$file FAILED"
    SEED_FAILURES+=("$file")
  fi
}

if [ "$SKIP_SEED" = "yes" ]; then
  warn "SKIP_SEED=yes — no seeds were run"
else
  USER_COUNT="$(mongo_eval 'db.users.countDocuments()')"
  [[ "$USER_COUNT" =~ ^[0-9]+$ ]] || USER_COUNT=0

  # --- 6a. seed.js: accounts + language tabs. Destructive, so first-install only.
  if [ "$USER_COUNT" -gt 0 ] && [ "$FORCE_USER_SEED" != "yes" ]; then
    warn "$USER_COUNT existing user(s) found — skipping seed.js so real accounts are not deleted"
    warn "(re-run with FORCE_USER_SEED=yes if you truly want to wipe users, topics and tabs)"
  else
    # seed.js refuses to mint accounts without passwords. Resolve them in order:
    #   1. the environment, if you passed one for this run
    #   2. backend/.env, where a previous deploy stored them
    #   3. a freshly generated one
    # Whatever is used is then written back to backend/.env, so THE LOGIN STAYS
    # THE SAME on every future deploy and can always be looked up again with
    #     grep SEED_ backend/.env
    # That file is gitignored and mode 600, which is why the password lives there
    # and not in this script — a credential committed to the repo is public.
    resolve_seed_password() {
      local label="$1" supplied="$2" key="$3"
      if [ -n "$supplied" ]; then
        RESOLVED_PW="$supplied"
        ok "using the $label password from the environment"
      elif RESOLVED_PW="$(read_env_key "$key")" && [ -n "$RESOLVED_PW" ]; then
        ok "reusing the stored $label password (unchanged since the last deploy)"
      else
        RESOLVED_PW="$(openssl rand -base64 18 2>/dev/null | tr -d '/+=' || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
        ok "generated a new $label password"
      fi
    }

    resolve_seed_password admin "${SEED_ADMIN_PASSWORD:-}" SEED_ADMIN_PASSWORD; ADMIN_PW="$RESOLVED_PW"

    # testuser is the guest account the login page prefills, so it is pinned to
    # the shared demo password rather than resolved/generated like admin's — a
    # random one here would leave the prefilled form failing to log in.
    USER_PW="${SEED_USER_PASSWORD:-$DEMO_USER_PASSWORD}"
    ok "testuser pinned to the shared guest password (prefilled on the login page)"

    set_env_key SEED_ADMIN_PASSWORD "$ADMIN_PW"
    set_env_key SEED_USER_PASSWORD "$USER_PW"

    ADMIN_PASSWORD_TO_REPORT="$ADMIN_PW"
    USER_PASSWORD_TO_REPORT="$USER_PW"

    run_seed seed.js \
      -e ALLOW_PRODUCTION_SEED=yes \
      -e "SEED_ADMIN_PASSWORD=$ADMIN_PW" \
      -e "SEED_USER_PASSWORD=$USER_PW"
  fi

  # --- 6b. Content seeds. Idempotent — each removes only the topics it owns.
  #     They must follow seed.js, which deletes every topic.
  #     Any seed-*.js not in CONTENT_SEEDS is appended, so new seed files added to
  #     backend/ later run automatically without touching this script.
  EXTRA_SEEDS=()
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case " ${CONTENT_SEEDS[*]} seed.js " in
      *" $f "*) ;;                      # already handled above
      *) EXTRA_SEEDS+=("$f") ;;
    esac
  done < <(docker exec "$API_CONTAINER" sh -c 'ls -1 seed-*.js 2>/dev/null' | tr -d '\r' || true)

  for seed_file in "${CONTENT_SEEDS[@]}" ${EXTRA_SEEDS[@]+"${EXTRA_SEEDS[@]}"}; do
    if docker exec "$API_CONTAINER" test -f "$seed_file"; then
      run_seed "$seed_file"
    else
      warn "$seed_file not found in the image — skipped"
    fi
  done

  # --- 6c. Make the login accounts correct. Runs on EVERY deploy, and it has to:
  #     the common case is the one where seed.js was skipped because real users
  #     exist, and that is exactly when the login page can end up prefilled with
  #     guest credentials that no account actually has — "Invalid credentials" on
  #     a form the site filled in itself. Deletes nothing.
  printf '\n  %s— ensuring login accounts%s\n' "$C_BOLD" "$C_RESET"
  if docker exec "$API_CONTAINER" test -f ensure-accounts.js; then
    # ADMIN_PW is only set when seed.js ran, so fall back to the stored value.
    ENSURE_ADMIN_PW="${ADMIN_PW:-$(read_env_key SEED_ADMIN_PASSWORD)}"
    if docker exec \
         -e "DEMO_USER_PASSWORD=$DEMO_USER_PASSWORD" \
         -e "SEED_ADMIN_PASSWORD=$ENSURE_ADMIN_PW" \
         "$API_CONTAINER" node ensure-accounts.js; then
      ok "login accounts ready"
      # ensure-accounts forces the guest password, so this is what now works.
      USER_PASSWORD_TO_REPORT="$DEMO_USER_PASSWORD"
    else
      fail "ensure-accounts.js FAILED — the guest login will not work"
      SEED_FAILURES+=("ensure-accounts.js")
    fi
  else
    warn "ensure-accounts.js not found in the image — skipped"
  fi
fi

# ---------------------------------------------------------------------------
# Step 7 — Smoke test
# ---------------------------------------------------------------------------
step "Smoke test"

api_health   && ok "API responds on /api/health"        || fail "API health check failed"
web_serving  && ok "Frontend container serves index.html" || fail "frontend container is not serving"

# Content counts prove the seeds actually landed, rather than just exiting 0.
TOPIC_COUNT="$(mongo_eval 'db.topics.countDocuments()')"
TAB_COUNT="$(mongo_eval 'db.languagetabs.countDocuments()')"
USER_TOTAL="$(mongo_eval 'db.users.countDocuments()')"
printf '  %s•%s database: %s topic(s), %s language tab(s), %s user(s)\n' \
  "$C_BLUE" "$C_RESET" "${TOPIC_COUNT:-?}" "${TAB_COUNT:-?}" "${USER_TOTAL:-?}"
[ "${TOPIC_COUNT:-0}" != "0" ] || fail "no topics in the database — the site will render empty"

# The public URL only works once host Nginx + SSL are configured (see
# HOSTINGER_DEPLOYMENT_GUIDE.md); a failure here is not a failure of this deploy.
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 10 -o /dev/null "https://${DOMAIN}"; then
    ok "https://${DOMAIN} is reachable"
  else
    warn "https://${DOMAIN} did not respond — check host Nginx / SSL, not the containers"
  fi
fi

# ---------------------------------------------------------------------------
# Step 8 — Summary
# ---------------------------------------------------------------------------
step "Container status"
"${DC[@]}" ps

if [ "$PRUNE_IMAGES" = "yes" ]; then
  docker image prune -f >/dev/null 2>&1 || true
fi

printf '\n%s========================================================%s\n' "$C_BOLD" "$C_RESET"
if [ "${#SEED_FAILURES[@]}" -eq 0 ]; then
  printf '%s DEPLOY COMPLETE%s — %s seed file(s) ran cleanly\n' "$C_GREEN$C_BOLD" "$C_RESET" "${#SEED_RAN[@]}"
else
  printf '%s DEPLOY FINISHED WITH SEED ERRORS%s\n' "$C_RED$C_BOLD" "$C_RESET"
  for f in "${SEED_FAILURES[@]}"; do fail "$f"; done
fi
printf '%s========================================================%s\n' "$C_BOLD" "$C_RESET"

printf '\n  Site : https://%s\n' "$DOMAIN"
printf '  API  : https://api.%s/api/health\n' "$DOMAIN"
printf '  Local: http://127.0.0.1:%s  (web)   http://127.0.0.1:%s/api/health  (api)\n' "$WEB_HOST_PORT" "$API_HOST_PORT"

# Shown on every run, not just the run that created the accounts — the passwords
# are kept in backend/.env, so a deploy that skipped seed.js can still tell you
# how to log in. Recover them at any time with:  grep SEED_ backend/.env
[ -n "$ADMIN_PASSWORD_TO_REPORT" ] || ADMIN_PASSWORD_TO_REPORT="$(read_env_key SEED_ADMIN_PASSWORD)"
[ -n "$USER_PASSWORD_TO_REPORT" ]  || USER_PASSWORD_TO_REPORT="$(read_env_key SEED_USER_PASSWORD)"

if [ -n "$ADMIN_PASSWORD_TO_REPORT" ] || [ -n "$USER_PASSWORD_TO_REPORT" ]; then
  printf '\n%s  LOGIN CREDENTIALS%s  (log in with the USERNAME, not the email)\n' "$C_YELLOW$C_BOLD" "$C_RESET"
  [ -n "$ADMIN_PASSWORD_TO_REPORT" ] && \
    printf '    admin     password: %-24s email: admin@example.com\n' "$ADMIN_PASSWORD_TO_REPORT"
  [ -n "$USER_PASSWORD_TO_REPORT" ] && \
    printf '    testuser  password: %-24s email: user@example.com\n' "$USER_PASSWORD_TO_REPORT"
  printf '  Kept in %s (gitignored, mode 600) — same login on every deploy.\n' "$APP_DIR/$ENV_FILE"
  printf '  Recover any time:  grep SEED_ %s\n' "$ENV_FILE"
fi

printf '\n  Logs: %s logs -f %s\n\n' "${DC[*]}" "$API_CONTAINER"

[ "${#SEED_FAILURES[@]}" -eq 0 ] || exit 1
