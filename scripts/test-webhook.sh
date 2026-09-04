#!/usr/bin/env bash
# Send one test message to a Slack incoming webhook.
#
#   ./scripts/test-webhook.sh
#
# Use this before pasting the URL into Cloudflare, for two reasons: it proves the
# webhook is still live, and the message tells you WHICH channel it posts to --
# a webhook is bound to the channel it was created for and cannot be repointed,
# so an "unused" one from months ago may well be aimed somewhere you have
# forgotten about.
#
# The URL is read with `read -rs`, so it is never echoed to the terminal, never
# written to your shell history, and never becomes a command-line argument that
# `ps` could show to another user on the machine. Nothing here writes it to disk.

set -euo pipefail

printf 'Paste the Slack webhook URL (input hidden), then press Enter:\n> '
read -rs WEBHOOK
printf '\n'

if [ -z "${WEBHOOK:-}" ]; then
  echo "Nothing entered." >&2
  exit 1
fi

case "$WEBHOOK" in
  https://hooks.slack.com/services/*) ;;
  *)
    echo "That does not look like an incoming webhook." >&2
    echo "Expected it to start with https://hooks.slack.com/services/" >&2
    exit 1
    ;;
esac

# -w '%{http_code}' and -o /dev/null: Slack answers "ok" or an error word, and
# the status code is the part worth acting on. The URL goes in via --data and the
# positional argument only, both of which stay inside this process.
STATUS=$(curl -s -o /tmp/slack-test-body.$$ -w '%{http_code}' \
  -X POST -H 'content-type: application/json' \
  --data '{"text":":wave: Test from the BET Workflows repo. If you can see this, the webhook is live — and this is the channel page feedback will land in."}' \
  "$WEBHOOK")
BODY=$(cat "/tmp/slack-test-body.$$" 2>/dev/null || true)
rm -f "/tmp/slack-test-body.$$"

echo "HTTP $STATUS${BODY:+  ($BODY)}"

case "$STATUS" in
  200)
    echo
    echo "Delivered. Go and look at Slack: whichever channel that message appeared in"
    echo "is where every page rating will go. If it is the wrong one, create a new"
    echo "webhook against the right channel rather than trying to repoint this one."
    echo
    echo "Next: add it in Cloudflare as SLACK_WEBHOOK_URL (Encrypted), then redeploy."
    echo "See the 'Configuring page feedback' section of DEPLOY.md."
    ;;
  404)
    echo
    echo "404 usually means the webhook has been revoked, or the app was deleted."
    echo "Create a new one at https://api.slack.com/apps."
    ;;
  403)
    echo
    echo "403 usually means the app was removed from the workspace, or an admin"
    echo "revoked it. Re-install the app, or create a new webhook."
    ;;
  *)
    echo
    echo "Not delivered. The body above is Slack's own explanation."
    ;;
esac
