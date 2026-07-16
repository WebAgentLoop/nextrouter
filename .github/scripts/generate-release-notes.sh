#!/usr/bin/env bash

set -euo pipefail

: "${RELEASE_VERSION:?RELEASE_VERSION is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${DOCKER_IMAGE:?DOCKER_IMAGE is required}"
: "${DOCKER_TAG:?DOCKER_TAG is required}"
: "${MANIFEST_DIGEST:?MANIFEST_DIGEST is required}"
: "${OUTPUT_FILE:?OUTPUT_FILE is required}"

SERVER_URL=${GITHUB_SERVER_URL:-https://github.com}
REPOSITORY=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}
COMMIT_URL="$SERVER_URL/$REPOSITORY/commit"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

for category in features fixes performance documentation maintenance other; do
  : > "$TEMP_DIR/$category"
done
has_changes=false

if [ -n "${PREVIOUS_TAG:-}" ]; then
  RANGE="${PREVIOUS_TAG}..${RELEASE_SHA}"
else
  RANGE="$RELEASE_SHA"
fi

while IFS=$'\t' read -r sha subject; do
  [ -n "$sha" ] || continue
  has_changes=true
  short_sha=${sha:0:8}
  escaped_subject=${subject//\\/\\\\}
  escaped_subject=${escaped_subject//\[/\\[}
  escaped_subject=${escaped_subject//\]/\\]}
  entry="- ${escaped_subject} ([${short_sha}](${COMMIT_URL}/${sha}))"

  case "$subject" in
    feat:*|feat\(*\):*|feat!:*|feat\(*\)!:*) category=features ;;
    fix:*|fix\(*\):*|fix!:*|fix\(*\)!:*|Revert\ *) category=fixes ;;
    perf:*|perf\(*\):*|perf!:*|perf\(*\)!:*) category=performance ;;
    docs:*|docs\(*\):*|docs!:*|docs\(*\)!:*) category=documentation ;;
    ci:*|ci\(*\):*|ci!:*|ci\(*\)!:*|build:*|build\(*\):*|build!:*|build\(*\)!:*|chore:*|chore\(*\):*|chore!:*|chore\(*\)!:*|refactor:*|refactor\(*\):*|refactor!:*|refactor\(*\)!:*|test:*|test\(*\):*|test!:*|test\(*\)!:*) category=maintenance ;;
    *) category=other ;;
  esac

  printf '%s\n' "$entry" >> "$TEMP_DIR/$category"
done < <(git log --no-merges --format='%H%x09%s' "$RANGE")

{
  echo "Docker release for commit [\`${RELEASE_SHA}\`](${COMMIT_URL}/${RELEASE_SHA})."
  echo
  echo "## Docker images"
  echo
  echo "- Immutable: \`${DOCKER_IMAGE}:${DOCKER_TAG}\`"
  echo "- Rolling: \`${DOCKER_IMAGE}:latest\`"
  echo "- Multi-arch digest: \`${MANIFEST_DIGEST}\`"
  echo
  echo '```bash'
  echo "docker pull ${DOCKER_IMAGE}:${DOCKER_TAG}"
  echo '```'
  echo
  echo "To roll back, deploy the immutable \`${DOCKER_TAG}\` tag instead of \`latest\`."
  echo
  echo "## What's changed"

  while read -r category heading; do
    if [ -s "$TEMP_DIR/$category" ]; then
      echo
      echo "### $heading"
      echo
      cat "$TEMP_DIR/$category"
    fi
  done <<'HEADINGS'
features Features
fixes Fixes
performance Performance
documentation Documentation
maintenance Maintenance
other Other changes
HEADINGS

  if [ "$has_changes" = false ]; then
    echo
    echo "No non-merge commits were added in this release."
  fi

  if [ -n "${PREVIOUS_TAG:-}" ]; then
    echo
    echo "**Full changelog:** [\`${PREVIOUS_TAG}...nextrouter-${RELEASE_VERSION}\`](${SERVER_URL}/${REPOSITORY}/compare/${PREVIOUS_TAG}...nextrouter-${RELEASE_VERSION})"
  fi
} > "$OUTPUT_FILE"
