(() => {
  const root = document.getElementById("ask");
  if (!root) return;
  const form = root.querySelector("form"),
    field = form.elements.question,
    search = form.elements.search;
  const send = form.querySelector("[type=submit]"),
    clear = root.querySelector(".chat-clear");
  const starters = [...root.querySelectorAll("[data-question]")],
    log = root.querySelector(".chat-log");
  const status = root.querySelector(".chat-state"),
    count = root.querySelector(".chat-count");
  const endpoint = "/api/research-chat",
    hosted = location.protocol !== "file:";
  const library = [
    { title: "Reviewed findings", href: "files/FINDINGS.md" },
    { title: "Code guide", href: "files/CODE_GUIDE.md" },
    { title: "Scorecards", href: "technical.html#nwm" },
  ];
  let session,
    checking,
    busy = false,
    expiryTimer,
    history = [];

  function controls() {
    const full = session?.remaining === 0;
    send.disabled = busy || full;
    starters.forEach((b) => {
      b.disabled = busy || full;
    });
    clear.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
  }
  function updateSession(next) {
    if (!next || !Number.isInteger(next.remaining) || !Number.isFinite(next.expires)) return;
    if (session?.expires === next.expires) next.remaining = Math.min(next.remaining, session.remaining);
    session = next;
    count.textContent = next.remaining + " of " + next.limit + " questions left";
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(
      () => {
        session = undefined;
        void refresh();
      },
      Math.max(100, next.expires - Date.now() + 200),
    );
    if (!next.remaining)
      status.textContent =
        "Session limit reached. Questions reopen " +
        new Date(next.expires).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }) +
        ".";
    controls();
  }
  function refresh() {
    if (!hosted) return Promise.resolve(false);
    if (checking) return checking;
    checking = (async () => {
      try {
        const r = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) return false;
        updateSession((await r.json()).session);
        return Boolean(session);
      } catch {
        return false;
      }
    })().finally(() => {
      checking = null;
    });
    return checking;
  }
  const init = () => {
    if (!session) void refresh();
  };
  root.addEventListener("focusin", init, { once: true });
  root.addEventListener("pointerenter", init, { once: true });
  window.addEventListener("focus", () => {
    if (session && !busy) void refresh();
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#ask") init();
  });
  if (location.hash === "#ask") init();

  const make = (tag, content) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    return node;
  };
  function turn(label, type) {
    const item = make("article");
    item.className = "chat-turn " + type;
    const title = make("strong", label);
    title.className = "turn-label";
    item.append(title);
    log.append(item);
    return item;
  }
  const reveal = (item) => {
    log.scrollTop += item.getBoundingClientRect().top - log.getBoundingClientRect().top;
  };
  function sourceLink(source, label) {
    let url;
    try {
      url = new URL(source.href, location.href);
    } catch {
      return;
    }
    if (!["https:", "http:", "file:"].includes(url.protocol)) return;
    const link = make("a", label || source.title);
    link.href = url.href;
    if (url.origin !== location.origin) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    return link;
  }
  function links(node, sources, cited = []) {
    const list = make("ul"),
      seen = new Set();
    list.className = "chat-sources";
    for (const source of sources) {
      const key = source.href + " " + source.title;
      if (seen.has(key)) continue;
      const index = cited.findIndex((s) => s.id === source.id);
      const label =
        index >= 0 && cited.length > 1 ? "[" + (index + 1) + "] " + source.title : source.title;
      const link = sourceLink(source, label);
      if (!link) continue;
      seen.add(key);
      const li = make("li");
      li.append(link);
      list.append(li);
    }
    if (list.childElementCount) node.append(list);
  }
  function studyText(text) {
    const p = make("p");
    for (const segment of text.split(
      /(\b(?:[\w-]+\/)+[\w-]+\.py\b|\b_fit_loop\b|\bvalidation_metrics\b|\bbaseline \+ residual\b)/g,
    )) {
      if (/\.py$|^_fit_loop$|^validation_metrics$|^baseline \+ residual$/.test(segment))
        p.append(make("code", segment));
      else p.append(document.createTextNode(segment));
    }
    return p;
  }
  function render(reply) {
    let item, text;
    const cited = ["study", "ai"].includes(reply.mode) ? reply.sources : [];
    if (reply.mode === "study" || reply.mode === "ai") {
      const label = reply.mode === "study" ? "From the published study" : "HYDRA · AI response";
      item = turn(label, "ai-turn");
      const sources = reply.sources || [];
      for (const part of reply.paragraphs) {
        const p = studyText(part.text);
        if (sources.length > 1)
          for (const id of part.citations) {
            const index = sources.findIndex((s) => s.id === id);
            if (index < 0) continue;
            const ref = sourceLink(sources[index], "[" + (index + 1) + "]");
            if (!ref) continue;
            ref.className = "ref-mark";
            ref.setAttribute("aria-label", sources[index].title);
            p.append(ref);
          }
        item.append(p);
      }
      links(
        item,
        sources.filter((s) => !s.id.startsWith("W")),
        cited,
      );
      text = reply.paragraphs.map((p) => p.text).join(" ");
    } else if (reply.mode === "publications") {
      item = turn("USGS publication search", "source-turn");
      text = "Searched publication titles for “" + reply.web.terms + "”.";
      if (reply.web.status === "found") item.append(make("p", text));
    } else {
      const sources = reply.sources || [];
      const hasWeb = Boolean(reply.web?.sources?.length);
      item = turn(
        sources.length ? "Related study passages" : hasWeb ? "Publication search" : "Study library",
        "source-turn",
      );
      const note =
        reply.error ||
        (reply.reason === "no_match"
          ? "I couldn’t locate that in the published study. Try a gauge, a forecast lead or a model name."
          : sources.length
            ? "AI synthesis is unavailable. These passages may help."
            : hasWeb
              ? "USGS returned the records below. AI synthesis is unavailable."
              : "AI synthesis is unavailable. You can explore the evidence directly.");
      item.append(make("p", note));
      for (const s of sources) {
        const block = make("div");
        block.className = "source-excerpt";
        if (s.excerpt) block.append(make("p", s.excerpt));
        links(block, [s]);
        item.append(block);
      }
      if (!sources.length && !hasWeb) links(item, library);
      text = sources.length ? sources.map((s) => s.title + ". " + (s.excerpt || "")).join(" ") : note;
    }
    if (reply.web) {
      const block = make("div");
      block.className = "chat-web";
      block.append(make("strong", "External reading · USGS Publications Warehouse"));
      if (reply.web.status === "found") {
        links(block, reply.web.sources, cited);
        text += " USGS publication records: " + reply.web.sources.map((s) => s.title).join(", ");
      } else
        block.append(
          make(
            "p",
            reply.web.status === "empty"
              ? "No publication titles matched “" +
                  (reply.web.terms || "this question") +
                  "”. Try a shorter topic, such as “streamflow forecasting”."
              : "The publication search is temporarily unavailable.",
          ),
        );
      item.append(block);
    }
    reveal(item);
    return text;
  }
  async function submit(raw) {
    const question = raw.trim();
    if (busy || !question || session?.remaining === 0) return;
    busy = true;
    controls();
    try {
      if (hosted && (!session || session.expires <= Date.now()) && !(await refresh())) {
        status.textContent = "The assistant couldn’t open a session. Please try again.";
        return;
      }
      if (session?.remaining === 0) return;
      const item = turn("You", "visitor-turn");
      item.append(make("p", question));
      reveal(item);
      clear.hidden = false;
      if (!hosted) {
        render({
          error:
            "Interactive answers are available on the hosted site. You can read the local study sources here.",
        });
        status.textContent = "Study links ready.";
        return;
      }
      status.textContent = search.checked
        ? "Checking the study and searching USGS publications…"
        : "Checking the study…";
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: history.slice(-4), search: search.checked }),
        signal: AbortSignal.timeout(44_000),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error();
      const reply = await response.json();
      updateSession(reply.session);
      if (!response.ok) {
        if (reply.reason === "session") session = undefined;
        if (reply.reason === "limit") {
          render(reply);
          return;
        }
        status.textContent = reply.error || "The assistant is temporarily unavailable.";
        return;
      }
      field.value = "";
      const text = render(reply);
      history.push(
        { role: "user", content: question },
        { role: "assistant", content: text.slice(0, 1450) },
      );
      history = history.slice(-4);
      if (session?.remaining)
        status.textContent = reply.mode === "sources" ? "Source search complete." : "Answer ready.";
    } catch {
      status.textContent =
        "The assistant couldn’t finish this request. Your question is still in the box.";
      void refresh();
    } finally {
      busy = false;
      controls();
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submit(field.value);
  });
  for (const button of starters)
    button.addEventListener("click", () => {
      field.value = button.dataset.question;
      void submit(field.value);
    });
  clear.addEventListener("click", () => {
    history = [];
    log.replaceChildren();
    field.value = "";
    clear.hidden = true;
    status.textContent = "Conversation cleared. Your question count is unchanged.";
    if (session?.remaining === 0) updateSession(session);
    field.focus();
  });
  root.querySelector(".chat-interactive").hidden = false;
})();
