/* Where the page feedback goes.
 *
 * Three sinks are supported and you configure ONE:
 *
 *   endpoint     Our own /api/feedback, which holds the Slack webhook as a
 *                Worker environment variable and forwards for us. The best of
 *                the three by some distance -- the credential stays on the
 *                server, the page only talks to its own origin, and being
 *                same-origin it is the only sink that can read a real status
 *                code and tell delivered from rejected.
 *
 *                It is OFF, because it needs the Cloudflare Pages deployment
 *                and that deployment does not exist. See the note on it below.
 *
 *   googleForm   A Google Form's formResponse endpoint. Answers land in the
 *                linked Sheet. Nothing to run, nothing to pay for, and the
 *                worst case if the URL leaks is that somebody can add rows to a
 *                spreadsheet of widget feedback.
 *
 *   slackWebhook An incoming webhook, posting into a channel. Supported by the
 *                code, and unusable in this repository -- shared/ is published
 *                to a PUBLIC GitHub Pages repo, so the URL would be public and
 *                the publish workflow refuses it. Kept for a deployment that is
 *                genuinely private end to end. Read the warning below.
 *
 * Leave all three null and nothing is transmitted: ratings are kept in this
 * browser and nowhere else. The reader is thanked either way -- they did give
 * the feedback -- but no code here claims a delivery that did not happen.
 *
 * WHAT WE CAN AND CANNOT KNOW. Neither endpoint sends CORS headers, so the
 * browser hands back an opaque response and there is no way to read a status
 * code: a 400 from Google and a 200 from Google look identical from here. What
 * the browser DOES report is a request that never left -- no network, DNS gone,
 * connection refused -- and that is the case the retry queue below catches. So
 * "queued for retry" means "the browser could not send it", never "the endpoint
 * said no".
 */

(function () {
  /* ---------- configure one of these ---------- */

  const SINK = {
    // OFF, because the deployment it needs does not exist.
    //
    // This route lives in functions/api/feedback.js and runs only on the
    // Cloudflare Pages deployment. That deployment is optional and has never
    // been stood up -- .github/workflows/deploy-admin.yml no-ops because its
    // secrets are unset, and the site is served from GitHub Pages alone. On
    // GitHub Pages there is no /api/, so leaving this on meant every rating
    // took a 404 and was dropped: a sink that looks configured and collects
    // nothing, which is worse than no sink at all.
    //
    // Turn it on the day the Cloudflare project exists and SLACK_WEBHOOK_URL is
    // set on it. The client code is written and tested; it needs only this line.
    endpoint: null,
    // endpoint: "/api/feedback",

    // Create a form with five short-answer questions, then read the entry.N ids
    // out of the prefilled-link URL. The order here is the order they are named,
    // not the order they appear on the form.
    googleForm: null,
    // googleForm: {
    //   action: "https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse",
    //   fields: {
    //     rating: "entry.000000001",
    //     comment: "entry.000000002",
    //     page: "entry.000000003",
    //     title: "entry.000000004",
    //     team: "entry.000000005"
    //   }
    // },

    // A WEBHOOK CANNOT GO HERE. Not a judgement -- two systems refuse it.
    //
    // The reasoning that made it look acceptable was sound as far as it went: an
    // incoming webhook is bound at creation to ONE channel, so the worst a
    // passer-by who reads this file can do is put junk in the feedback channel,
    // and the remedy is to delete it and issue another. That is a bounded,
    // recoverable exposure.
    //
    // It does not matter, because:
    //
    //   GitHub push protection rejects the push to the public mirror outright --
    //   GH013, "Slack Incoming Webhook URL". The publish builds everything and
    //   dies at the last step.
    //
    //   And Slack revokes webhooks it finds in public repositories. Even
    //   bypassed, the feature would stop working on its own, silently, at a time
    //   nobody chose -- which is worse than never shipping it, because it would
    //   look like it worked.
    //
    // This sink stays because it is correct and tested, and because a private
    // deployment could use it. On this site it is unreachable. Use `slackTrigger`
    // below, or a relay that holds the webhook server-side.
    slackWebhook: null,

    // Slack, directly, without the wall above applying.
    //
    // A Workflow Builder WEBHOOK TRIGGER is not an incoming webhook, and the
    // difference is the whole reason this is allowed to be here. Slack's own
    // documentation: a trigger accepts "values for specific inputs" and rejects
    // anything that is not a flat object matching the schema you defined. So a
    // passer-by who reads this file can fire your feedback workflow with junk in
    // the fields. They cannot post arbitrary messages into the channel as the
    // app, which is exactly what an incoming webhook would let them do, and the
    // trigger can be deleted and re-issued in Workflow Builder without touching
    // the app, the token, or anything else.
    //
    // That is a bounded, recoverable exposure rather than a write credential, so
    // scripts/check-secrets.py permits `/triggers/` and still refuses
    // `/services/`. Do not "simplify" this by pasting an incoming webhook here.
    //
    // `inputs` maps our field names onto the input names your workflow declares,
    // because those are yours to name and will not match ours by luck. These
    // eight are everything that is ever sent -- declare exactly these as the
    // workflow's variables, all of type text.
    slackTrigger: null,

    // A relay: any URL that will take this feedback and forward it to Slack.
    //
    // This exists because the two direct routes are both shut. A published
    // incoming webhook is refused by GitHub push protection and revoked by Slack
    // when it finds it in a public repository. A Workflow Builder trigger is
    // restricted by a workspace admin. Every endpoint a browser can reach is
    // public, so the webhook has to sit somewhere that is not the browser --
    // which is what a relay is, and why there is no third option.
    //
    // What goes here is NOT a credential: it is an address that accepts a POST.
    // Somebody who finds it can send junk feedback, the same as they could by
    // clicking the thumbs. Slack's webhook stays wherever the relay keeps it.
    //
    // scripts/slack-relay.gs is a relay in about fifty lines, deployable from a
    // browser in three minutes with nothing to approve and no admin involved.
    // The Cloudflare route in functions/api/feedback.js is the same idea if the
    // project ever exists.
    //
    // Injected at publish time from SLACK_FEEDBACK_RELAY, so it is not committed
    // either -- not because it is secret, but because rotating an address should
    // not be a commit.
    relay: "https://script.google.com/macros/s/AKfycbyAQCTfXrrPRDgMMWc7SV-fxrwYxm0zeQk5ggiiv7QIRNt6ALlfND52KVJnr7XAWTxurg/exec"
    // relay: "https://script.google.com/macros/s/AKfy.../exec"
    // slackTrigger: {
    //   url: "https://hooks.slack.com/triggers/T00000000/0000000000000/xxxxxxxx",
    //   inputs: {
    //     kind: "kind",         // "rating" or "comment"
    //     summary: "summary",   // one line, ready to post as-is
    //     rating: "rating",     // up | down | neutral
    //     comment: "comment",   // empty on a rating
    //     page: "page",
    //     title: "title",
    //     team: "team",
    //     name: "name"        // typed by the reader; empty if they skipped it
    //   }
    // }
  };

  /* ---------- plumbing ---------- */

  const QUEUE_KEY = "bet-workflows:feedback-queue";
  const TEAM_KEY = "bet-workflows:team";
  const QUEUE_MAX = 20;

  const readQueue = () => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  };

  const writeQueue = (items) => {
    try {
      // Newest kept, oldest dropped: a queue that grew without bound would fill
      // localStorage on a browser that is simply offline a lot.
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-QUEUE_MAX)));
    } catch (err) {
      /* private mode, or the quota is full -- the feedback is lost, and there is
         nothing useful to do about it from here */
    }
  };

  const configured = () =>
    Boolean(
      SINK.endpoint || SINK.googleForm || SINK.slackWebhook || SINK.slackTrigger || SINK.relay
    );

  // Set once a 404 has proved there is no collector on this deployment. Without
  // it the public copy of the site would re-queue and re-retry every rating on
  // every page load, forever, against a route that is never going to exist.
  let endpointAbsent = false;

  // The switcher stores a key -- "mts", "sales", "all" -- and the label next to
  // it is what the reader actually saw. The key on its own reads like a name in
  // Slack ("From: all"), which is how this got noticed. "all" is the switcher
  // sitting at its default, so it says nothing and is dropped.
  function teamLabel(key) {
    if (!key || key === "all") return "";
    try {
      const button = document.querySelector(`.team-button[data-team="${CSS.escape(key)}"]`);
      const label = button && button.textContent.trim();
      if (label) return label;
    } catch (err) {
      /* no switcher on this page, or a key CSS.escape will not take */
    }
    return key;
  }

  // One shape, whichever sink it ends up in, so the queue does not have to know
  // which one was configured when the entry was made.
  function record(rating, comment, name) {
    let team = null;
    try {
      team = localStorage.getItem(TEAM_KEY);
    } catch (err) {
      /* not important enough to matter */
    }

    return {
      rating,
      // Typed by the person, never derived. Nothing here reads a login, a
      // cookie or a header -- if the box is left empty the feedback is
      // anonymous, which is the honest default for a box nobody has to fill in.
      name: (name || "").slice(0, 80),
      comment: (comment || "").slice(0, 2000),
      page: location.pathname,
      // The absolute one as well, because a path cannot be turned back into a
      // link on the far side of a relay -- it has no idea what host it is for.
      url: location.href,
      title: document.title,
      team: teamLabel(team),
      at: new Date().toISOString()
    };
  }

  function post(url, body, asForm) {
    // fetch with keepalive, NOT sendBeacon. Beacon looked like the right tool --
    // fire and forget, survives the page unloading -- and it quietly made the
    // retry queue below unreachable: it returns true the moment the browser
    // accepts the payload for sending, so a send that then fails outright is
    // indistinguishable from one that succeeded, and nothing was ever queued.
    // keepalive gives the same survival across a navigation started right after
    // the click, and a genuine network failure still rejects, which is the one
    // failure the queue can actually do something about.
    return fetch(url, {
      method: "POST",
      mode: "no-cors",
      // A form POST rather than JSON for Google, and a plain-text body for
      // Slack: Slack's webhook rejects application/json from a browser as a
      // preflighted request, and text/plain is what gets through without one.
      body,
      headers: asForm ? undefined : { "content-type": "text/plain;charset=UTF-8" },
      keepalive: true
    }).then(() => true);
  }

  // Our own route, when there is one. Same-origin, so this is an ordinary fetch
  // whose status can actually be read -- and the three outcomes are genuinely
  // different: delivered, this deployment has no collector, or try again later.
  function sendToEndpoint(entry) {
    return fetch(SINK.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    }).then((res) => {
      if (res.ok) return true;

      // 404 (no such route) or 405 (something else is serving that path): there
      // is no collector here and there never will be on this deployment. Report
      // undelivered without queueing -- a retry cannot succeed.
      if (res.status === 404 || res.status === 405) {
        endpointAbsent = true;
        return true;
      }

      // 503 (webhook not configured yet) and 5xx (Slack was down) are both
      // worth keeping: they come good once someone fixes the deployment.
      throw new Error(`feedback endpoint returned ${res.status}`);
    });
  }

  function send(entry) {
    if (SINK.endpoint && !endpointAbsent) return sendToEndpoint(entry);

    if (SINK.googleForm) {
      const { action, fields } = SINK.googleForm;
      const form = new FormData();
      for (const [key, id] of Object.entries(fields)) {
        if (id && entry[key] != null) form.append(id, String(entry[key]));
      }
      return post(action, form, true);
    }

    if (SINK.slackWebhook) {
      return post(SINK.slackWebhook, JSON.stringify(slackPayload(entry)), false);
    }

    if (SINK.slackTrigger) return sendToTrigger(oneEntry(entry));

    // Fire-and-forget, like the others: text/plain so there is no preflight to
    // answer, and the relay reads the body as JSON on the far side.
    if (SINK.relay) return post(SINK.relay, JSON.stringify(oneEntry(entry)), false);

    return Promise.reject(new Error("no feedback sink configured"));
  }

  const FACE = { up: "\u{1F44D}", down: "\u{1F44E}", neutral: "\u{1F610}" };

  // The colour bar down the left of each message, which is the only thing that
  // survives being skimmed: a run of grey with one red in it answers "is
  // anything wrong?" without reading a word.
  const COLOR = { up: "#2eb886", down: "#e01e5a", neutral: "#8d8d8d" };

  // Slack reads &, < and > as markup, and titles carry ampersands ("Data &
  // APIs"), so everything interpolated below goes through this first.
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // entry.title is document.title: on a flow page exactly right ("H2H — Setup
  // Flow"), on the landing page the site's own name repeated on every message.
  // So the site suffix comes off, and what is left being just the site name
  // means the landing page and is said as much.
  function where(entry) {
    const title = String(entry.title || "").replace(/\s*\|\s*Sportradar\s*$/i, "").trim();
    return title && !/^BET Workflows$/i.test(title) ? title : "the landing page";
  }

  // Kept deliberately in step with compose_() in scripts/slack-relay.gs. The
  // relay is pasted into Apps Script as a standalone file and cannot import
  // this, so the two are written twice on purpose; change them together.
  function slackPayload(entry) {
    const face = FACE[entry.rating] || "\u{1F4AC}";
    const spot = where(entry);
    const url = String(entry.url || "");
    // & is escaped inside the link too, or a query string ends the URL early
    // and the link goes somewhere shorter than intended. Slack puts it back.
    const href = url.replace(/[<>|]/g, "").replace(/&/g, "&amp;");
    const heading = /^https?:\/\//.test(url)
      ? `*${face}  <${href}|${esc(spot)}>*`
      : `*${face}  ${esc(spot)}*`;

    const blocks = [{ type: "section", text: { type: "mrkdwn", text: heading } }];
    if (entry.comment) {
      blocks.push({ type: "section",
        text: { type: "mrkdwn", text: `>${esc(entry.comment).replace(/\n/g, "\n>")}` } });
    }
    // Attribution is a footnote, not a headline, and both halves are optional:
    // the box nobody has to fill in stays anonymous.
    const from = [entry.name, entry.team].filter(Boolean).map(esc).join("  ·  ");
    if (from) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: from }] });

    return {
      // The notification and the sidebar preview, where no block renders.
      text: `${face} ${entry.rating || "feedback"} — ${spot}`,
      attachments: [{ color: COLOR[entry.rating] || "#8d8d8d", blocks }]
    };
  }

  // A workflow trigger takes a flat object and nothing else, so every value here
  // is a string or a number -- no nesting, no arrays.
  //
  // `kind` tells the workflow which it is, so the channel can read differently
  // for a thumb and for somebody who wrote a sentence -- one line for a rating,
  // the comment quoted for a comment.
  function oneEntry(entry) {
    return {
      kind: entry.comment ? "comment" : "rating",
      summary: `${FACE[entry.rating] || ""} ${where(entry)}`.trim(),
      rating: entry.rating || "",
      comment: entry.comment || "",
      page: entry.page || "",
      // Carried through, not dropped: the relay builds the Slack message on the
      // far side and a path is not something it can turn back into a link.
      url: entry.url || "",
      title: entry.title || "",
      team: entry.team || "",
      name: entry.name || "",
    };
  }

  // JSON, sent as text/plain. `mode: "no-cors"` can only use CORS-safelisted
  // content types, and application/json is not one of them -- it would provoke a
  // preflight that no-cors cannot answer. The existing Slack path has always
  // done this; whether a TRIGGER is as tolerant of it as an incoming webhook is
  // the one thing here that could not be checked without a live URL, so
  // `bodyAsForm: true` on the sink switches to form encoding, which is safelisted
  // too and suits a flat schema just as well.
  function sendToTrigger(flat) {
    const { url, inputs, bodyAsForm } = SINK.slackTrigger;
    const named = {};
    for (const [ours, theirs] of Object.entries(inputs || {})) {
      if (theirs && flat[ours] != null && flat[ours] !== "") named[theirs] = flat[ours];
    }

    if (bodyAsForm) {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(named)) form.append(key, String(value));
      return post(url, form.toString(), true);
    }

    return post(url, JSON.stringify(named), false);
  }

  // Anything that failed to leave last time goes out before anything new. Only
  // an outright network failure lands here -- see the note at the top about
  // opaque responses -- so in practice this drains on the next load with a
  // connection.
  function flush() {
    if (!configured() || endpointAbsent) return;
    const queued = readQueue();
    if (!queued.length) return;

    writeQueue([]);
    queued.forEach((entry) => {
      send(entry).catch(() => writeQueue([...readQueue(), entry]));
    });
  }

  // Returns whether the feedback was actually transmitted, so the caller can be
  // honest with the reader rather than showing a tick over a no-op.
  function submit(rating, comment, name) {
    const entry = record(rating, comment, name);

    if (!configured()) {
      // Kept, not thrown away: turning a sink on later drains whatever this
      // browser collected in the meantime.
      writeQueue([...readQueue(), entry]);
      return Promise.resolve(false);
    }

    return send(entry)
      .then(() => !endpointAbsent)
      .catch(() => {
        writeQueue([...readQueue(), entry]);
        return false;
      });
  }

  flush();

  // Ratings were briefly held back and sent as one grouped message per visit.
  // That is gone -- every rating goes as it happens now, and the channel being
  // busy is the accepted cost of seeing everything. This clears the buffer a
  // tester's browser may still be holding, so nothing is stranded there.
  try {
    localStorage.removeItem("bet-workflows:feedback-batch");
  } catch (err) {
    /* private mode: there was nothing to clear */
  }

  window.betFeedback = { submit, configured };
})();
