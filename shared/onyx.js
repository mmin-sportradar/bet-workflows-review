/* Ask BET-Tools, and render the answer in the panel.
 *
 * Loaded by chrome.js alongside the assistant. Classic script, no modules.
 *
 * NO CREDENTIAL, ANYWHERE, AND NOTHING TO PASTE.
 *
 * The reader is already signed in to Onyx in this browser, so the request goes
 * with `credentials: "include"` and Onyx answers as THEM, with their own
 * permissions. They see exactly what they are cleared to see, and there is no
 * token in this site, in this repository, or in anybody's browser.
 *
 * A shared token was never possible: shared/** is served from a public GitHub
 * Pages mirror, so a token belonging to the team would be a token belonging to
 * the internet. A per-reader token did work, and was dropped because asking
 * everybody to create one is not worth it.
 *
 * WHAT ONYX HAS TO ALLOW -- one change, and this lights up
 *
 * Cross-site cookies require an explicit origin. Onyx answers
 *
 *     access-control-allow-origin: *
 *
 * and the fetch spec forbids sending credentials to a wildcard, so the browser
 * refuses before anything is sent. Two settings on the Onyx deployment fix it:
 *
 *     CORS_ALLOWED_ORIGIN=https://<this site's origin>   (not *)
 *     Access-Control-Allow-Credentials: true
 *
 * Until then every call is refused, the client latches itself unavailable after
 * the first attempt, and the assistant shows what it knows plus a link into
 * BET-Tools that carries the question. Nothing is broken in the meantime; the
 * panel simply does not gain the extra answer.
 */

(function () {
  const script =
    document.currentScript || document.querySelector('script[src*="onyx.js"]');

  const ONYX = {
    origin: "https://onyx.ai.sportradar.online",
    agentId: 423,
    name: "BET-Tools",
  };

  // Endpoints, established by probing the deployment rather than from
  // documentation -- /openapi.json is disabled there, and Onyx has renamed these
  // since it was Danswer. An unauthenticated POST answers 403 where a route
  // exists and 404 where it does not:
  //
  //   /api/chat/create-chat-session   403  exists
  //   /api/chat/send-chat-message     403  exists
  //   /api/chat/send-message          404  gone (the old Danswer name)
  //   /api/search                     403  exists, documents only
  const API = {
    createSession: `${ONYX.origin}/api/chat/create-chat-session`,
    sendMessage: `${ONYX.origin}/api/chat/send-chat-message`,
  };

  // How long to wait before giving up and letting the assistant answer from
  // what it has. A documentation lookup that takes longer than this has stopped
  // being a chat and become a wait.
  const TIMEOUT_MS = 25000;

  const state = {
    // null until the first attempt has told us something. false means every
    // call will fail the same way, so we stop trying for the session.
    available: null,
    reason: "",
    sessionId: null,
    lastMessageId: null,
  };

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      // The whole point: the reader's own Onyx session. Nothing of ours.
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  // Turn a failure into something the caller can act on, and the reader can be
  // told honestly. The three cases need different words.
  function classify(error, res) {
    if (res && (res.status === 401 || res.status === 403)) {
      return { code: "signed-out", message: "Sign in to Onyx and ask again." };
    }
    if (res && res.status === 422) {
      // FastAPI names the fields it wanted. Worth having in the console while
      // the request shape is still being settled, and worth never showing a
      // reader.
      return { code: "shape", message: "BET-Tools did not understand the request." };
    }
    if (res && res.status >= 500) {
      return { code: "upstream", message: "Onyx is having trouble right now." };
    }
    if (error && error.name === "TimeoutError") {
      return { code: "timeout", message: "BET-Tools took too long to answer." };
    }
    // A TypeError from fetch is what a blocked CORS request looks like from
    // script: the browser refuses before anything is sent, and deliberately
    // tells the page nothing more.
    return {
      code: "blocked",
      message: "I cannot reach BET-Tools from this page yet.",
    };
  }

  async function createSession() {
    let res;
    try {
      res = await post(API.createSession, {
        persona_id: ONYX.agentId,
        description: "BET Workflows assistant",
      });
    } catch (error) {
      // Already classified by post() -- pass it through rather than flattening
      // every failure into the generic one.
      if (error.code) throw error;
      throw Object.assign(new Error("create-session failed"), classify(error, null));
    }
    if (!res.ok) {
      throw Object.assign(new Error("create-session failed"), classify(null, res));
    }
    const body = await res.json();
    return body.chat_session_id || body.id || body.session_id;
  }

  // Onyx streams its reply as newline-delimited JSON, one packet per token or
  // per event, and the last packets carry the citations. Plain JSON is handled
  // too, because a deployment behind a buffering proxy will send it that way.
  async function readReply(res) {
    const text = await res.text();

    const packets = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        packets.push(JSON.parse(trimmed));
      } catch {
        /* a partial line at the end of a stream */
      }
    }

    if (!packets.length) return { answer: "", sources: [] };

    // The prose arrives either whole or in pieces, under one of several names
    // depending on version.
    let answer = "";
    const documents = [];

    for (const packet of packets) {
      const piece =
        packet.answer_piece ??
        packet.answer ??
        packet.message ??
        (typeof packet.content === "string" ? packet.content : "");
      if (typeof piece === "string") answer += piece;

      const docs =
        packet.top_documents || packet.context_docs || packet.documents || packet.citations;
      if (Array.isArray(docs)) documents.push(...docs);
      else if (docs && Array.isArray(docs.top_documents)) documents.push(...docs.top_documents);
    }

    // Titles and links only, and deduplicated. The blurbs Onyx returns are
    // document text; they are shown to the reader who is entitled to them but
    // never stored, so only what is needed to cite a source is kept.
    const seen = new Set();
    const sources = [];
    for (const doc of documents) {
      const title =
        doc.semantic_identifier || doc.document_name || doc.title || doc.name || "";
      const url = doc.link || doc.url || doc.source_link || "";
      if (!title || !url || seen.has(url)) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      seen.add(url);
      sources.push({ title, url });
    }

    return { answer: answer.trim(), sources };
  }

  async function ask(question) {
    if (state.available === false) {
      throw Object.assign(new Error("unavailable"), {
        code: state.reason || "blocked",
        message: "I cannot reach BET-Tools from this page yet.",
      });
    }

    try {
      if (!state.sessionId) state.sessionId = await createSession();

      let res;
      try {
        res = await post(API.sendMessage, {
          chat_session_id: state.sessionId,
          message: question,
          parent_message_id: state.lastMessageId,
          prompt_id: null,
          search_doc_ids: null,
          retrieval_options: { run_search: "always" },
        });
      } catch (error) {
        if (error.code) throw error;
        throw Object.assign(new Error("send failed"), classify(error, null));
      }

      if (!res.ok) throw Object.assign(new Error("send failed"), classify(null, res));

      const reply = await readReply(res);
      state.available = true;
      if (!reply.answer) {
        throw Object.assign(new Error("empty"), {
          code: "empty",
          message: `${ONYX.name} had nothing to say about that.`,
        });
      }
      return reply;
    } catch (error) {
      // Latch the states that will not change within this page view, so the
      // assistant stops waiting on Onyx and answers from what it has.
      if (error.code === "blocked" || error.code === "signed-out") {
        state.available = false;
        state.reason = error.code;
      }
      throw error;
    }
  }

  // A link is the fallback and needs nothing: the app reads a `message` query
  // parameter, so the question travels even when the API cannot be reached.
  const appHref = (question) =>
    `${ONYX.origin}/app?agentId=${ONYX.agentId}` +
    (question ? `&message=${encodeURIComponent(question)}` : "");

  window.betOnyx = {
    name: ONYX.name,
    ask,
    appHref,
    status: () => ({ available: state.available, reason: state.reason }),
  };
})();
