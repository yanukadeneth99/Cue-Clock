#!/usr/bin/env bash
# Runs npm for ONE of this repo's two npm projects (app/ or website/), on behalf of the CI auto-fixer.
#
# Why this exists: the auto-fixer only lets Claude run a short list of approved commands, and each one is matched by how the command STARTS. Both npm projects live in subfolders, so every realistic command would begin with "cd website && npm ..." and would never match the list. That left the fixer able to diagnose a dependency failure but not actually fix it. This script is the single approved entry point instead, so one stable pattern covers every npm job in either folder.
#
# It also guarantees the safety flag rather than trusting whoever wrote the command. Installs ALWAYS pass --ignore-scripts, so a brand new and unchecked package version can never run its own install scripts inside our privileged CI job.
#
# Usage:
#   deps.sh <app|website> ci                              reinstall exactly what the lockfile says
#   deps.sh <app|website> install [package[@version] ...] install, and refresh the lockfile
#   deps.sh <app|website> run <lint|build|test>           run one of the project's own scripts
#   deps.sh <app|website> view <package> [field]          look a package up on the npm registry (read-only)

set -euo pipefail

# Checks every package name handed to us before it reaches npm. Two things are refused.
#
# Anything starting with "-" is refused because npm reads it as another option, and a later option beats an earlier one. "deps.sh website install --no-ignore-scripts" would otherwise turn into "npm install --ignore-scripts --no-ignore-scripts", which switches package install scripts back ON and quietly undoes the single protection this script exists to provide (checked against npm 11: the last flag wins).
#
# Addresses are refused because --ignore-scripts only stops a package's INSTALL scripts. Code pulled straight from a URL, a git repository or a local path could still run later during a normal "run build". Installs are therefore limited to ordinary packages from the npm registry, which is all Dependabot ever bumps.
reject_unsafe_specs() {
  for spec in "$@"; do
    case "$spec" in
      -*)
        echo "Options are not allowed here — expected a package name, got '${spec}'." >&2
        exit 2
        ;;
      http:*|https:*|git:*|git+*|ssh:*|file:*|/*|./*|../*)
        echo "Only packages from the npm registry are allowed, not '${spec}'." >&2
        exit 2
        ;;
      *)
        # anything else is an ordinary package name/version spec — allowed through
        ;;
    esac
  done
}

# Spelled out in full rather than read back out of this file's own comments: the script changes directory partway through, so anything that reads its own path would break exactly when an error message is needed most.
usage() {
  cat >&2 <<'EOF'
Usage:
  deps.sh <app|website> ci                              reinstall exactly what the lockfile says
  deps.sh <app|website> install [package[@version] ...] install, and refresh the lockfile
  deps.sh <app|website> run <lint|build|test>           run one of the project's own scripts
  deps.sh <app|website> view <package> [field]          look a package up on the npm registry (read-only)
EOF
}

project="${1:-}"
action="${2:-}"

# Only ever these two folders. Anything else, including a path with .. in it, is rejected outright.
case "$project" in
  app|website) ;;
  *)
    echo "First argument must be 'app' or 'website' (got '${project}')." >&2
    usage
    exit 2
    ;;
esac

# Work out the repo root from this script's own location, so it does not matter where it was called from.
root=$(cd "$(dirname "$0")/../.." && pwd)
dir="${root}/${project}"
if [ ! -f "${dir}/package.json" ]; then
  echo "No package.json in ${dir} — nothing to do." >&2
  exit 2
fi

# Drop the two arguments already read, so "$@" is just the extras.
shift 2 2>/dev/null || shift $# 2>/dev/null || true

cd "$dir"
# ${*:-} rather than ${*}: with no extra arguments (a plain "ci") an unset $* would abort the script under set -u.
echo "deps.sh: ${project} -> npm ${action} ${*:-}"

case "$action" in
  ci)
    npm ci --ignore-scripts
    ;;
  install)
    reject_unsafe_specs "$@"
    # The -- marks the end of the options, so nothing after it can be read as one.
    npm install --ignore-scripts -- "$@"
    ;;
  run)
    script="${1:-}"
    # Only the project's own checked-in scripts, so this cannot be used to run something arbitrary.
    case "$script" in
      lint|build|test) ;;
      *)
        echo "run needs one of: lint, build, test (got '${script}')." >&2
        exit 2
        ;;
    esac
    npm run "$script"
    ;;
  view)
    package="${1:-}"
    if [ -z "$package" ]; then
      echo "view needs a package name." >&2
      exit 2
    fi
    # A single optional field, e.g. "versions" or "peerDependencies". Read-only: this only queries the registry, it never writes to the project. The name and the field go through the same check as an install, so neither can smuggle in an option.
    field="${2:-}"
    reject_unsafe_specs "$package" ${field:+"$field"}
    npm view -- "$package" ${field:+"$field"}
    ;;
  *)
    echo "Second argument must be one of: ci, install, run, view (got '${action}')." >&2
    usage
    exit 2
    ;;
esac
