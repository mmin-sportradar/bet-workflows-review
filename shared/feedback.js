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

    // DO NOT PUT A WEBHOOK URL HERE. Read this before you ignore it.
    //
    // This file is published twice. The Cloudflare mirror sits behind Access and
    // would be fine. But .github/workflows/publish-review-site.yml pushes
    // shared/** to mmin-sportradar/bet-workflows-review -- a PUBLIC repository,
    // served by GitHub Pages. A URL in this file is therefore readable by
    // anyone on the internet, and lands in a public repo's history where it
    // stays even after it is deleted from the file.
    //
    // An incoming webhook is a write credential. Published like that, anyone who
    // finds it can post into the channel as the app, indefinitely, and the only
    // remedy is to revoke it and issue a new one.
    //
    // The publish workflow now fails rather than shipping a webhook, so this is
    // a wall and not just a note. If you want feedback in Slack, use the Google
    // Form above and connect the Sheet to Slack at the Google end -- the
    // credential then lives on Google's side and never enters this repository.
    slackWebhook: null
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

  const configured = () => Boolean(SINK.endpoint || SINK.googleForm || SINK.slackWebhook);

  // Set once a 404 has proved there is no collector on this deployment. Without
  // it the public copy of the site would re-queue and re-retry every rating on
  // every page load, forever, against a route that is never going to exist.
  let endpointAbsent = false;

  // One shape, whichever sink it ends up in, so the queue does not have to know
  // which one was configured when the entry was made.
  function record(rating, comment) {
    let team = null;
    try {
      team = localStorage.getItem(TEAM_KEY);
    } catch (err) {
      /* not important enough to matter */
    }

    return {
      rating,
      comment: (comment || "").slice(0, 2000),
      page: location.pathname,
      title: document.title,
      team,
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
      const face = { up: ":+1:", neutral: ":neutral_face:", down: ":-1:" }[entry.rating] || "";
      const lines = [
        `${face} *${entry.rating}* on \`${entry.page}\``,
        entry.title ? `_${entry.title}_` : "",
        entry.team ? `Team: ${entry.team}` : "",
        entry.comment ? `> ${entry.comment.replace(/\n/g, "\n> ")}` : ""
      ].filter(Boolean);
      return post(SINK.slackWebhook, JSON.stringify({ text: lines.join("\n") }), false);
    }

    return Promise.reject(new Error("no feedback sink configured"));
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
  function submit(rating, comment) {
    const entry = record(rating, comment);

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

  window.betFeedback = { submit, configured };
})();
