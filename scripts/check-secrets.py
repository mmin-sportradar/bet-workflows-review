#!/usr/bin/env python3
"""Refuse to publish a credential.

shared/** is pushed to mmin-sportradar/bet-workflows-review, which is PUBLIC and
served by GitHub Pages. Anything committed there is readable by anyone, and stays
in that repository's history after it is deleted from the file -- so a webhook
pasted into shared/feedback.js "just to try it" is not a mistake you can take
back by editing the line out.

This runs over the built output before it is pushed. It is deliberately a hard
failure: the cost of a false positive is one annoyed developer, and the cost of
a miss is a live credential on the open internet.

    python3 scripts/check-secrets.py out
"""

import re
import sys
from pathlib import Path

# Each entry is (name, pattern). Patterns match the shape of the credential, not
# a specific value, so a rotated one is caught too.
PATTERNS = [
    ("Slack incoming webhook", re.compile(r"hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+")),
    ("Slack bot/user/app token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
    ("Private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    # A credential-looking name assigned a long opaque literal. The internal AI
    # documentation tool's token has no publicly documented prefix, so there is
    # no shape to match -- but there IS a shape to the mistake: somebody pastes
    # it next to the name of the thing it is for. This catches the unknown-format
    # case that every pattern above would miss.
    (
        "credential assigned in source",
        re.compile(
            r"""(?ix)
            \b(?:api[_-]?key|api[_-]?token|access[_-]?token|auth[_-]?token
               |bearer[_-]?token|secret[_-]?key|client[_-]?secret
               |docs?[_-]?api[_-]?token|[a-z]*_token)\b
            \s*[:=]\s*
            ["'`]
            [A-Za-z0-9_\-\.=+/]{24,}
            ["'`]
            """
        ),
    ),
    ("Authorization header with a literal bearer token", re.compile(r"(?i)authorization[\"'\s:]+bearer\s+[A-Za-z0-9_\-\.=+/]{24,}")),
]

# Text the site is actually made of. A binary asset is not worth scanning and a
# false positive inside one would be impossible to act on.
SUFFIXES = {".html", ".js", ".mjs", ".css", ".json", ".md", ".txt", ".yml", ".yaml"}


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "out")
    if not root.is_dir():
        print(f"::error::{root} is not a directory")
        return 2

    findings = []
    scanned = 0

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        scanned += 1

        for line_no, line in enumerate(text.splitlines(), 1):
            for name, pattern in PATTERNS:
                match = pattern.search(line)
                if not match:
                    continue
                # Never print the credential itself -- a CI log is not the place
                # to publish the thing you are refusing to publish.
                found = match.group(0)
                masked = f"{found[:22]}…{found[-4:]}" if len(found) > 30 else f"{found[:8]}…"
                findings.append((path.relative_to(root), line_no, name, masked))

    if findings:
        print(f"::error::Refusing to publish: {len(findings)} credential(s) found in the build output.")
        for rel, line_no, name, masked in findings:
            print(f"::error file={rel},line={line_no}::{name} in {rel}:{line_no} ({masked})")
        print()
        print("This output is pushed to a PUBLIC repository. Remove the credential, then")
        print("REVOKE IT — it is in this repo's history from the moment it was committed,")
        print("and deleting the line does not take it back.")
        return 1

    print(f"No credentials in {scanned} published files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
