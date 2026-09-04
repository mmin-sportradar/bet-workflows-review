#!/usr/bin/env python3
"""Refuse to ship an editor whose script a browser will not run.

admin/index.html is one page with one long inline script. Four character
sequences inside that script can end it early or stop it ending at all:
an HTML comment opener or closer, and an unescaped script tag. Get one
wrong and the browser treats the rest of the file as text -- the page
still loads, still looks right, and does nothing. Nobody can sign in.

Neither `node --check` nor a window.onerror probe sees this: the
JavaScript is valid, and the failure happens in the HTML tokenizer
before any of it runs. So this walks the same states the tokenizer does
and checks the script element ends where the file says it ends.

Run from the repository root; used by publish-review-site.yml and
scripts/cf-build.sh so a dead editor cannot reach either deployment.
"""

import re
import sys
from pathlib import Path

PAGE = Path(sys.argv[1] if len(sys.argv) > 1 else "admin/index.html")

# The states of the HTML spec's script data tokenizer that matter here.
DATA, ESCAPED, DOUBLE = "script data", "escaped", "double escaped"


def end_of_script(text, start):
    """Where the browser closes the script element that opens at `start`.

    Returns (index, state_history). index is None if it never closes.
    """
    i, state, seen = start, DATA, []

    def close_tag_at(j):
        # </script followed by anything that cannot continue a tag name.
        m = re.match(r"</script(?=[\s/>])", text[j:], re.I)
        return bool(m)

    def open_tag_at(j):
        return bool(re.match(r"<script(?=[\s/>])", text[j:], re.I))

    while i < len(text):
        if state == DATA:
            if close_tag_at(i):
                return i, seen
            if text.startswith("<!--", i):
                state = ESCAPED
                seen.append((i, "entered escaped state at an HTML comment opener"))
                i += 4
                continue
        elif state == ESCAPED:
            if close_tag_at(i):
                return i, seen
            if text.startswith("-->", i):
                state = DATA
                seen.append((i, "left escaped state at an HTML comment closer"))
                i += 3
                continue
            if open_tag_at(i):
                state = DOUBLE
                seen.append((i, "entered double-escaped state at a script tag"))
                i += 7
                continue
        else:  # DOUBLE -- the dangerous one: a closing tag no longer closes
            if text.startswith("-->", i):
                state = ESCAPED
                i += 3
                continue
            if close_tag_at(i):
                state = ESCAPED
                seen.append((i, "a closing script tag was SWALLOWED here"))
                i += 8
                continue
        i += 1
    return None, seen


def main():
    text = PAGE.read_text(encoding="utf-8")
    line_of = lambda i: text.count("\n", 0, i) + 1

    opens = [m.start() for m in re.finditer(r"<script(?=[\s>])", text)]
    # Only the real element openers, not the ones inside the script's own
    # template strings; the first is the page's own script.
    if not opens:
        sys.exit(f"::error::{PAGE} has no script element")
    start = text.index(">", opens[0]) + 1

    end, seen = end_of_script(text, start)
    expected = text.rindex("</script>")

    if end == expected:
        print(f"{PAGE}: script element closes at line {line_of(end)}, as written")
        return 0

    print(f"::error::{PAGE}: the browser does not close this page's script "
          f"where the file does, so the page loads as text and nothing runs.")
    if end is None:
        print(f"::error::the script element never closes; the file's own "
              f"closing tag is at line {line_of(expected)}")
    else:
        print(f"::error::the browser closes it at line {line_of(end)}; the "
              f"file's closing tag is at line {line_of(expected)}")
    for at, what in seen:
        print(f"  line {line_of(at)}: {what}")
    print("::error::fix: keep HTML comment openers and closers out of the "
          "script (comments and string literals included), and write any "
          "closing script tag with an escaped slash.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
