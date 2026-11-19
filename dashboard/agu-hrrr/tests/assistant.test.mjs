import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, makePayload } from "../server/chat.mjs";
import { studyAnswer } from "../server/answers.mjs";
import { studyData, retrieve } from "../server/knowledge.mjs";
import { publications, searchTerms } from "../server/publications.mjs";
import {
  allowance,
  blobCounters,
  browserSession,
  memoryCounters,
  startSession,
} from "../server/sessions.mjs";

const url = "https://study.example/api/research-chat";
const summary = "What did you find, in plain English?";
const open = "What does the Galax MAE scorecard measure?";
const clock = Date.parse("2026-11-19T10:00:00Z");
const post = (cookie, question = summary, extra = {}) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ question, ...extra }),
  });
const issued = (time = clock) => startSession(new Request(url), time);
const cookie = (session) => session.cookie.split(";")[0];
const forbidden = () => {
  throw new Error("Unexpected external request");
};
const result = (value) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  });

test("visitor starters give a direct sourced answer with appropriate units, limitations and code symbols", () => {
  const fixtures = [
    [summary, /41–46%.*36–49%.*1%/],
    ["Why did Sugar Grove gain less than Galax and Jefferson?", /physical cause.*0.73 m³\/s.*0.32 m³\/s/],
    ["Which input removals changed performance most?", /16–30%.*22–61%/],
    [
      "Where in the code is the correction added to NWM, and how do you select a checkpoint?",
      /ablation_campaign\.py.*346.*_fit_loop.*tie keeps the earlier/,
    ],
    ["Which function implements latest observed-flow persistence?", /persistence_donor/],
    ["Where is the codebase?", /agu-hrrr-2026/],
    ["How are the hydrographs aggregated from gauge data?", /all seven days/],
  ];
  for (const [q, pattern] of fixtures) {
    const a = studyAnswer(q);
    assert.equal(a.mode, "study");
    assert.match(a.paragraphs.map((p) => p.text).join(" "), pattern);
    assert(a.paragraphs.every((p) => p.citations.every((id) => a.sources.some((s) => s.id === id))));
  }
  assert.equal(
    retrieve("Which function implements latest observed-flow persistence?")[0].title,
    "Baselines and scoring",
  );
  assert.equal(
    retrieve("How are the hydrographs aggregated from gauge data?")[0].title,
    "Code for the seven-day flow average",
  );
  assert.equal(studyAnswer("What did you find about Helene fatalities?"), undefined);
});

test("all 270 site/lead/primary metric lookups reflect the released scores; follow-ups retain only missing dimensions", () => {
  const data = studyData();
  for (const site of data.sites)
    for (const metric of data.metrics)
      for (let h = 1; h <= 18; h++) {
        const a = studyAnswer(
          site + " " + (metric.key === "r" ? "Pearson correlation" : metric.key) + " at H" + h + "?",
        );
        const text = a.paragraphs.map((p) => p.text).join(" ");
        const decimals = ["rmse", "mae"].includes(metric.key) ? 2 : 3;
        for (const col of ["NWM", "Persistence", ...data.architectures])
          assert(text.includes(data.by_lead[site][metric.key][col][h - 1].toFixed(decimals)));
      }
  const q = "What is Galax MAE at H18?";
  assert.match(
    studyAnswer("What about Sugar Grove?", [{ role: "user", content: q }]).paragraphs[0].text,
    /Sugar Grove, 18 hours/,
  );
  assert.equal(studyAnswer(q).sources[0].href, "technical.html?metric=mae#nwm");
  assert.equal(
    retrieve("How should I interpret KGE compared with MAE at Galax?").some(
      (s) => s.title === "What the metrics measure",
    ),
    true,
  );
  assert.equal(studyAnswer("Compare Galax and Jefferson MAE at H18"), undefined);
  assert.equal(studyAnswer("What was Galax MAE from H1 to H18?"), undefined);
  assert.equal(studyAnswer("What was Galax MAE at H19?"), undefined);
});

test("paired rankings use each metric’s published direction and keep KGE distinct from MAE", () => {
  const q =
    "At Galax, how do persistence and the Transformer compare at H18 on both MAE and original KGE?";
  const pair = studyAnswer(q);
  assert.equal(pair.mode, "study");
  assert.match(
    pair.paragraphs[0].text,
    /the Transformer had lower mean absolute error \(9.24 m³.s\) than persistence \(10.34 m³.s\)/,
  );
  assert.match(
    pair.paragraphs[1].text,
    /Persistence had higher original KGE \(0.681\) than the Transformer \(0.625\)/,
  );
  assert.deepEqual(
    pair.sources.map((s) => s.href),
    ["technical.html?metric=mae#nwm", "technical.html?metric=kge#nwm"],
  );
  const next = studyAnswer("What about Jefferson?", [{ role: "user", content: q }]);
  assert.match(next.paragraphs[0].text, /At Jefferson, 18 hours ahead/);
  const simple = studyAnswer("Compare affine correction on NWM versus NWM at Galax H18 on MAE");
  assert.match(simple.paragraphs[0].text, /NWM had lower mean absolute error.*affine correction/);
});

test("one 24-hour cookie budget spans workers, GET, reloads and direct answers; question 26 makes no external call", async () => {
  let time = clock,
    generated = 0,
    searches = 0;
  const counters = memoryCounters();
  const opts = {
    env: { OPENAI_API_KEY: "test" },
    now: () => time,
    counters,
    send: async () => {
      generated++;
      return result({
        kind: "answer",
        paragraphs: [{ text: "See the published Galax table.", citations: ["S1"] }],
      });
    },
    searchFetch: async () => {
      searches++;
      return Response.json({ records: [] });
    },
  };
  const a = makeHandler(opts),
    b = makeHandler(opts);
  assert.equal((await a(post(""))).status, 409);
  const first = await a(new Request(url)),
    id = first.headers.get("set-cookie").split(";")[0];
  assert.match(first.headers.get("set-cookie"), /HttpOnly.*SameSite=Strict.*Secure/);
  assert.equal((await first.json()).session.remaining, 25);
  for (let n = 1; n <= 25; n++) {
    const handler = n % 2 ? a : b;
    time += 61_000;
    const response = await handler(post(id, n === 25 ? open : summary));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).session.remaining, 25 - n);
  }
  assert.equal(
    (await (await b(new Request(url, { headers: { cookie: id } }))).json()).session.remaining,
    0,
  );
  const denied = await a(post(id, open, { search: true }));
  assert.equal(denied.status, 429);
  assert.equal((await denied.json()).reason, "limit");
  assert.equal(generated, 1);
  assert.equal(searches, 0);
  time = clock + 86_400_001;
  assert.equal((await a(post(id))).status, 409);
  assert.equal(
    (await (await a(new Request(url, { headers: { cookie: id } }))).json()).session.remaining,
    25,
  );
  assert.equal(
    browserSession(new Request(url, { headers: { cookie: "hydra_chat_session=25" } }), time),
    null,
  );
});

test("private Blob counts are origin reads with conditional writes; simultaneous last-slot claims have exactly one winner", async () => {
  const blobs = new Map();
  const client = {
    async get(path, opts) {
      assert.equal(opts.useCache, false);
      assert.equal(opts.access, "private");
      const blob = blobs.get(path);
      return blob
        ? { statusCode: 200, blob: { etag: blob.etag }, stream: new Response(blob.value).body }
        : null;
    },
    async put(path, value, opts) {
      assert.equal(opts.ttlDays, 1);
      assert.equal(opts.addRandomSuffix, false);
      const old = blobs.get(path);
      if (old && !opts.allowOverwrite) throw new Error("already exists");
      if (old && old.etag !== opts.ifMatch) throw new Error("precondition failed");
      blobs.set(path, { value, etag: "v" + value });
    },
  };
  const a = blobCounters("test", client),
    b = blobCounters("test", client),
    s = issued();
  assert.deepEqual((await Promise.all([a.take(s), b.take(s)])).sort(), [1, 2]);
  for (let n = 3; n < 25; n++) assert.equal(await a.take(s), n);
  const endings = await Promise.all([a.take(s), b.take(s)]);
  assert(endings.includes(25) && endings.includes(null));
  assert.equal(await b.read(s), 25);
  assert.deepEqual(allowance(await a.read(s), s), {
    limit: 25,
    remaining: 0,
    expires: clock + 86_400_000,
  });
  assert.equal(blobs.size, 1);
});

test("a failed counter closes the hosted endpoint before study synthesis or publication search", async () => {
  const h = makeHandler({
    env: { VERCEL: "1", OPENAI_API_KEY: "test" },
    now: () => clock,
    send: forbidden,
    searchFetch: forbidden,
  });
  assert.equal((await h(post(cookie(issued()), open, { search: true }))).status, 503);
});

test("USGS lookup is opt-in, bounded, and source links come from USGS identifiers only", async () => {
  assert.equal(searchTerms("Find USGS publications on streamflow forecasting."), "streamflow forecasting");
  const send = async (u, opts) => {
    const api = new URL(u);
    assert.equal(api.hostname, "pubs.usgs.gov");
    assert.equal(api.searchParams.get("page_size"), "3");
    assert.equal(api.searchParams.get("title"), "streamflow forecasting");
    assert.equal(opts.headers.Authorization, undefined);
    return Response.json({
      records: [
        {
          indexId: "70023071",
          title: "A &amp; B",
          docAbstract: "<p>Abstract only.</p>",
          publicationYear: "2001",
          url: "https://untrusted.invalid/",
        },
        { indexId: "../untrusted", title: "Invalid" },
      ],
    });
  };
  const res = await publications(
    'Find papers on "streamflow forecasting".',
    send,
    new AbortController().signal,
  );
  assert.equal(res.status, "found");
  assert.equal(res.sources.length, 1);
  assert.equal(res.sources[0].href, "https://pubs.usgs.gov/publication/70023071");
  assert.match(res.sources[0].text, /A & B.*Abstract only/);
  const rejected = await publications(
    "streamflow",
    async () => new Response(null, { status: 502 }),
    new AbortController().signal,
  );
  assert.equal(rejected.status, "unavailable");
  const h = makeHandler({
    env: { OPENAI_API_KEY: "test", OPENAI_MODEL: "gpt-6-luna" },
    now: () => clock,
    searchFetch: send,
    send: async (_, opts) => {
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.reasoning, { effort: "none" });
      assert(body.input[0].content.includes('"id":"W1"'));
      return new Response(null, { status: 503 });
    },
  });
  const original = await (
    await h(post(cookie(issued()), "Find USGS publications on streamflow forecasting.", { search: true }))
  ).json();
  assert.equal(original.mode, "publications");
  assert.equal(original.web.sources[0].title, "A & B (2001)");
  const mixed = await (
    await h(
      post(cookie(issued()), 'How does the study compare with "streamflow forecasting" papers?', {
        search: true,
      }),
    )
  ).json();
  assert.equal(mixed.mode, "sources");
  assert.equal(mixed.web.status, "found");
  const explicit = makeHandler({ env: {}, now: () => clock, send: forbidden, searchFetch: send });
  assert.equal(
    (
      await (
        await explicit(post(cookie(issued()), "List USGS publications on streamflow forecasting"))
      ).json()
    ).mode,
    "publications",
  );
  const direct = makeHandler({ env: {}, now: () => clock, send: forbidden, searchFetch: forbidden });
  const normal = await (await direct(post(cookie(issued())))).json();
  assert.equal(normal.mode, "study");
  assert(!normal.web);
  assert.equal(makePayload("gpt-4.1-mini", open, [], [{ id: "S1" }]).reasoning, undefined);
});
