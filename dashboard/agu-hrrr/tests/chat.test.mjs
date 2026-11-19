import test from "node:test";
import assert from "node:assert/strict";
import { makeHandler, limiter } from "../server/chat.mjs";
import { retrieve } from "../server/knowledge.mjs";
import endpoint from "../../api/research-chat.mjs";

const url = "https://study.example/api/research-chat";
function post(data, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://study.example", ...headers },
    body: JSON.stringify(data),
  });
}
const ask = { question: "At Galax, what is the MAE at H18?" };
const noProvider = () => {
  throw new Error("Unexpected provider request");
};
const provider = (parsed) =>
  Response.json({
    status: "completed",
    output: [
      {
        role: "assistant",
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(parsed) }],
      },
    ],
  });

test("retrieval distinguishes the three model implementations and the lead-specific metric", () => {
  for (const [q, title] of [
    ["How does GRU+Conv work?", "GRU with forecast convolutions"],
    ["How does the GRU+Conv use the gauge history and NWM forecast?", "GRU with forecast convolutions"],
    ["How does the temporal transformer use patches?", "Temporal Transformer"],
    ["How does the code select checkpoints?", "Scaling, loss and checkpoint selection"],
    ["How does the code calculate percent MAE reduction?", "Code for the lead-wise MAE reduction"],
  ]) {
    assert.equal(retrieve(q)[0].title, title);
  }
  const first = retrieve(ask.question)[0];
  assert.match(first.title, /Galax.*Mean absolute error/);
  assert.match(first.text, /H18 \|/);
  assert.match(first.text, /Persistence/);
  assert.match(
    retrieve("What about Sugar Grove?", [{ role: "user", content: ask.question }])[0].title,
    /Sugar Grove.*Mean absolute error/,
  );
  const ablation = retrieve("What was removing soil moisture worth for Galax LSTM seed 1730?").find((s) =>
    s.title.includes("retrained input removals"),
  );
  assert.match(ablation.title, /LSTM \/ Galax/);
  assert.match(ablation.text, /1729, 1730, 1731/);
  assert.equal(retrieve("Who played saxophone for Coltrane?").length, 0);
});
test("a missing credential returns actual ranked sources, never a generated answer", async () => {
  const handle = makeHandler({ env: {}, send: noProvider });
  assert.deepEqual(await (await handle(new Request(url))).json(), { mode: "sources" });
  const result = await (await handle(post(ask))).json();
  assert.equal(result.reason, "unconfigured");
  assert.equal(result.mode, "sources");
  assert(result.sources[0].href.includes("technical"));
  assert(!result.paragraphs);
});
test("Responses API request is server-only, bounded and uses the supplied evidence", async () => {
  let calls = 0;
  const handle = makeHandler({
    env: { OPENAI_API_KEY: "test-only" },
    send: async (target, options) => {
      calls++;
      assert.equal(target, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer test-only");
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.model, "gpt-4.1-mini");
      assert.equal(body.text.format.strict, true);
      assert(body.max_output_tokens <= 600);
      assert.equal(body.tools, undefined);
      const excerpts = JSON.parse(body.input[0].content);
      assert(excerpts.length <= 5);
      assert.match(excerpts[0].title, /Galax/);
      return provider({
        kind: "answer",
        paragraphs: [{ text: "See the released Galax H18 scorecard.", citations: ["S1"] }],
      });
    },
  });
  const res = await handle(post({ ...ask, model: "visitor-value" })),
    data = await res.json();
  assert.equal(calls, 1);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(data.mode, "ai");
  assert.deepEqual(data.paragraphs[0].citations, ["S1"]);
  assert.equal(data.sources.length, 1);
  assert(!JSON.stringify(data).includes("test-only"));
});
test("the API preserves a bounded conversation and can abstain", async () => {
  const history = [
    { role: "user", content: ask.question },
    { role: "assistant", content: "The Galax scorecard is available." },
  ];
  const handle = makeHandler({
    env: { OPENAI_API_KEY: "test-only" },
    send: async (_, o) => {
      const payload = JSON.parse(o.body);
      assert.deepEqual(payload.input.slice(1, 3), history);
      return provider({
        kind: "insufficient",
        paragraphs: [{ text: "The study does not establish a physical cause.", citations: [] }],
      });
    },
  });
  assert.equal(
    (await (await handle(post({ question: "What about Sugar Grove?", history }))).json()).kind,
    "insufficient",
  );
});
test("unverified references and upstream outages fall back to public sources", async () => {
  const results = [
    () => provider({ kind: "answer", paragraphs: [{ text: "A source is required.", citations: ["S26"] }] }),
    () => provider({ kind: "answer", paragraphs: [{ text: "A source is required.", citations: [] }] }),
    () => new Response(null, { status: 429 }),
    () => Response.json({ status: "incomplete", output: [] }),
  ];
  for (const send of results) {
    const handle = makeHandler({ env: { OPENAI_API_KEY: "test-only" }, send });
    const d = await (await handle(post(ask))).json();
    assert.equal(d.mode, "sources");
    assert.equal(d.reason, "unavailable");
    assert(!("paragraphs" in d));
  }
});
test("input, size, method and origin checks run ahead of provider calls", async () => {
  const handle = makeHandler({ env: {}, send: noProvider });
  assert.equal((await handle(new Request(url, { method: "PUT" }))).status, 405);
  assert.equal((await handle(post(ask, { origin: "https://another.example" }))).status, 403);
  assert.equal((await handle(post(ask, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handle(post({ question: " " }))).status, 400);
  assert.equal((await handle(post({ question: "a".repeat(701) }))).status, 400);
  assert.equal((await handle(post({ question: "a".repeat(22000) }))).status, 413);
  assert.equal(
    (
      await handle(
        post({
          ...ask,
          history: [
            { role: "system", content: "irrelevant" },
            { role: "assistant", content: "ok" },
          ],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await (await handle(post({ question: "Who played saxophone for Coltrane?" }))).json()).reason,
    "no_match",
  );
});
test("request ceilings account before the call and release concurrency", () => {
  const l = limiter();
  for (let i = 0; i < 4; i++) assert(l.take("a", 100));
  assert(!l.take("b", 100));
  for (let i = 0; i < 4; i++) l.release();
  for (let i = 0; i < 2; i++) {
    assert(l.take("a", 101));
    l.release();
  }
  assert(!l.take("a", 102));
  assert(l.take("a", 61_000));
  l.release();
});
test("the deployed entry point returns its status without calling a model", async () => {
  const r = await endpoint.fetch(new Request(url));
  assert.equal(r.status, 200);
  assert(["ai", "sources"].includes((await r.json()).mode));
});
