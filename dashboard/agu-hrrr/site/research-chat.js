(() => {
  const root = document.getElementById("ask");
  if (!root) return;
  const form = root.querySelector("form");
  const field = form.elements.question;
  const send = form.querySelector("[type=submit]");
  const starters = [...root.querySelectorAll("[data-question]")];
  const log = root.querySelector(".chat-log");
  const status = root.querySelector(".chat-state");
  const clear = root.querySelector(".chat-clear");
  const history = [];
  let pending;
  const modeNotice = root.querySelector(".chat-mode");
  let checkedMode = false;
  async function checkMode() {
    if (checkedMode) return;
    checkedMode = true;
    let mode = "local";
    if (location.protocol !== "file:") {
      try {
        const response = await fetch("/api/research-chat", { cache: "no-store" });
        if (response.ok) mode = (await response.json()).mode;
      } catch {
        /* The static copy still has all three source links. */
      }
    }
    modeNotice.textContent =
      mode === "ai"
        ? "AI answers with study citations"
        : mode === "sources"
          ? "Source search is available. AI answers are offline."
          : "Local study sources";
    modeNotice.hidden = false;
  }
  root.addEventListener("focusin", checkMode, { once: true });
  root.addEventListener("pointerenter", checkMode, { once: true });
  const checkLinkedSection = () => {
    if (location.hash === "#ask") void checkMode();
  };
  window.addEventListener("hashchange", checkLinkedSection);
  checkLinkedSection();
  const localLinks = [
    { title: "Reviewed findings", href: "files/FINDINGS.md" },
    { title: "Implementation guide", href: "files/CODE_GUIDE.md" },
    { title: "Forecast scorecards", href: "technical.html#nwm" },
  ];
  const make = (tag, content) => {
    const e = document.createElement(tag);
    if (content !== undefined) e.textContent = content;
    return e;
  };
  function busy(value) {
    send.disabled = value;
    starters.forEach((b) => (b.disabled = value));
    form.setAttribute("aria-busy", String(value));
  }
  function turn(label, type) {
    const item = make("article");
    item.className = "chat-turn " + type;
    const title = make("strong", label);
    title.className = "turn-label";
    item.append(title);
    log.append(item);
    return item;
  }
  function reveal(item) {
    log.scrollTop += item.getBoundingClientRect().top - log.getBoundingClientRect().top;
  }
  function addLinks(node, sources) {
    const seen = new Set();
    const nav = make("ul");
    nav.className = "chat-sources";
    for (const s of sources || []) {
      if (seen.has(s.href + " " + s.title)) continue;
      seen.add(s.href + " " + s.title);
      const parsed = new URL(s.href, location.href);
      if (!["https:", "http:", "file:"].includes(parsed.protocol)) continue;
      const li = make("li"),
        link = make("a", s.title);
      link.href = parsed.href;
      li.append(link);
      nav.append(li);
    }
    if (nav.childElementCount) node.append(nav);
  }
  const reasons = {
    unconfigured: "The AI assistant is offline. These passages come directly from the study sources.",
    unavailable: "The AI service could not return a verified answer. These sources match your question.",
    no_match: "I couldn’t find a matching passage. Try a gauge name, a model, a metric or an input.",
    offline: "Live chat runs on the hosted site. You can read the study sources here.",
  };
  function showSources(reason, sources) {
    const item = turn("Study sources", "source-turn");
    item.append(make("p", reasons[reason] || reason));
    const distinct = new Set();
    for (const s of (sources || []).slice(0, 4)) {
      if (distinct.has(s.title) || !s.excerpt) continue;
      distinct.add(s.title);
      const block = make("div");
      block.className = "source-excerpt";
      addLinks(block, [s]);
      block.append(make("p", s.excerpt));
      item.append(block);
    }
    if (!distinct.size) addLinks(item, localLinks);
    reveal(item);
  }
  async function submit(question) {
    if (pending || !question.trim()) return;
    question = question.trim();
    const user = turn("You", "visitor-turn");
    user.append(make("p", question));
    reveal(user);
    field.value = "";
    clear.hidden = false;
    if (location.protocol === "file:") {
      showSources("offline");
      status.textContent = "Local source links ready.";
      return;
    }
    const controller = new AbortController();
    pending = controller;
    busy(true);
    status.textContent = "Finding study evidence…";
    try {
      const r = await fetch("/api/research-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: history.slice(-4) }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!r.headers.get("content-type")?.includes("application/json")) throw new Error("offline");
      const reply = await r.json();
      if (!r.ok) {
        showSources(reply.error || "unavailable", reply.sources);
        status.textContent = "Research sources ready.";
        return;
      }
      if (reply.mode === "sources") {
        showSources(reply.reason, reply.sources);
        history.push(
          { role: "user", content: question },
          {
            role: "assistant",
            content:
              "Source search returned: " +
              (reply.sources || [])
                .map((s) => s.title)
                .join(", ")
                .slice(0, 1100),
          },
        );
        status.textContent = "Source search complete.";
      } else if (reply.mode === "ai" && Array.isArray(reply.paragraphs)) {
        const item = turn("HYDRA · AI response", "ai-turn");
        for (const paragraph of reply.paragraphs) {
          item.append(make("p", paragraph.text));
          addLinks(
            item,
            reply.sources.filter((s) => paragraph.citations.includes(s.id)),
          );
        }
        reveal(item);
        history.push(
          { role: "user", content: question },
          {
            role: "assistant",
            content: reply.paragraphs
              .map((p) => p.text)
              .join(" ")
              .slice(0, 1450),
          },
        );
        status.textContent = "Answer ready.";
      } else throw new Error("unavailable");
      if (history.length > 4) history.splice(0, history.length - 4);
    } catch (e) {
      if (controller.signal.aborted) return;
      showSources(e.message === "offline" ? "offline" : "unavailable");
      status.textContent = "Source links ready.";
    } finally {
      if (pending === controller) {
        pending = null;
        busy(false);
      }
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submit(field.value);
  });
  starters.forEach((b) =>
    b.addEventListener("click", () => {
      void submit(b.dataset.question);
    }),
  );
  clear.addEventListener("click", () => {
    pending?.abort();
    pending = null;
    history.length = 0;
    log.replaceChildren();
    status.textContent = "Conversation cleared.";
    clear.hidden = true;
    busy(false);
    field.value = "";
    field.focus();
  });
  root.querySelector(".chat-interactive").hidden = false;
})();
