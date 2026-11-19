import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoots = [
  fileURLToPath(new URL("../", import.meta.url)),
  resolve("agu-hrrr"),
  resolve("dashboard/agu-hrrr"),
];
const root = sourceRoots.find((dir) => existsSync(join(dir, "site/files/FINDINGS.md")));
const read = (name) => readFileSync(join(root, name), "utf8");
const repo =
  "https://github.com/Mitchel34/hydra-nwm-streamflow-correction/blob/agu-hrrr-2026/dashboard/agu-hrrr/";
const stop = new Set(
  "a an the is are was were be been by at on in for and or to of from as we you i how what why did does do who where which can could would that this these those its into about did it with most each give tell me show please study research".split(
    " ",
  ),
);
const names = {
  "sugar grove": "sugargrove",
  "gru+conv": "gruconv",
  "gru conv": "gruconv",
  "mean absolute error": "mae",
  "root mean squared error": "rmse",
  "pearson correlation": "pearson",
  "national water model": "nwm",
  "soil moisture": "soilmoisture",
  "high flow": "highflow",
  "source code": "implementation",
  "under the hood": "architecture",
  "input features": "inputs",
};
const aliases = {
  removals: "removal",
  input: "inputs",
  metrics: "metric",
  checkpoints: "checkpoint",
  selection: "select",
  selected: "select",
  selecting: "select",
  learningrate: "rate",
  gains: "gain",
  gained: "gain",
  gauges: "gauge",
  rivers: "river",
  networks: "network",
  models: "model",
  skills: "skill",
  features: "inputs",
  feature: "inputs",
  ablation: "removal",
  ablations: "removal",
  remove: "removal",
  removed: "removal",
  removing: "removal",
  training: "train",
  trained: "train",
  trains: "train",
  learning: "learn",
  learns: "learn",
  architectures: "architecture",
  gru: "gruconv",
  convolution: "gruconv",
  convolutions: "gruconv",
  coding: "implementation",
  code: "implementation",
  floods: "flood",
  flooding: "flood",
  difference: "differ",
  different: "differ",
  limitations: "limits",
  uncertainty: "interval",
  hydrographs: "hydrograph",
  observations: "observed",
  weekly: "week",
  data: "dataset",
  dates: "period",
};
function words(input) {
  let text = input.toLowerCase().normalize("NFKC");
  for (const [phrase, word] of Object.entries(names)) text = text.replaceAll(phrase, word);
  return (text.match(/[a-z0-9]+/g) || []).filter((w) => !stop.has(w)).map((w) => aliases[w] || w);
}
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .trim()
    .replaceAll(" ", "-");
const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*\x60]/g, "")
    .trim();

function chunks(text, limit = 2050) {
  const out = [];
  let part = "";
  for (const line of text.split("\n")) {
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;
    if (line.length > limit) throw new Error("Oversized research source line");
    if (part.length + line.length + 1 > limit) {
      if (part.trim()) out.push(part.trim());
      part = "";
    }
    part += line + "\n";
  }
  if (part.trim()) out.push(part.trim());
  return out;
}
let corpus;
function build() {
  const docs = [];
  function add(title, body, href, tags = "", group = title) {
    const description = plain(body);
    if (!description) return;
    const terms = new Set(words(title + " " + description + " " + tags));
    docs.push({ title, body: description, href, group, terms, head: new Set(words(title + " " + tags)) });
  }
  function markdown(file, initial, tags, hrefFor) {
    const text = read(file);
    const sections = text.split(/^## /m);
    for (const [i, section] of sections.entries()) {
      const cut = section.indexOf("\n");
      const heading = i ? section.slice(0, cut).trim() : initial;
      const body = section.slice(cut + 1).trim();
      if (!body) continue;
      const url = hrefFor(heading, i);
      for (const chunk of chunks(body)) add(heading, chunk, url, tags, heading);
    }
  }
  markdown(
    "site/files/FINDINGS.md",
    "Study scope and prior exposure",
    "evidence research findings",
    (heading, i) => repo + "site/files/FINDINGS.md" + (i ? "#" + slug(heading) : ""),
  );
  markdown(
    "site/files/CODE_GUIDE.md",
    "Guide to the frozen code",
    "implementation methodology",
    (heading, i) => repo + "site/files/CODE_GUIDE.md" + (i ? "#" + slug(heading) : ""),
  );
  const sources = read("SOURCES.md")
    .split("## Archive inputs and panel construction")[1]
    .split("## Full-input architecture diagrams")[0];
  for (const part of chunks(sources.split("SHA-256")[0].split("| Original")[0]))
    add(
      "Building the gauge, NWM and HRRR inputs",
      part,
      repo + "SOURCES.md#archive-inputs-and-panel-construction",
      "data preprocessing gauge hrrr clock weather observations rain snow humidity temperature eligibility",
    );
  for (const [file, first, last, title, tags] of [
    [
      "story.py",
      "    scores = data[",
      "    extent =",
      "Code for the lead-wise MAE reduction",
      "implementation calculate chart lead percent mae nwm",
    ],
    [
      "prepare_hydrographs.py",
      "    weeks = []",
      "    if not any",
      "Code for the seven-day flow average",
      "implementation hydrograph weekly average complete days missing observed",
    ],
  ]) {
    const lines = read(file).split("\n"),
      start = lines.findIndex((line) => line.startsWith(first));
    const end = lines.findIndex((line, i) => i > start && line.startsWith(last));
    if (start < 0 || end <= start) throw new Error("Public code excerpt moved in " + file);
    add(
      title,
      file + " lines " + (start + 1) + "–" + end + "\n" + lines.slice(start, end).join("\n"),
      repo + file + "#L" + (start + 1) + "-L" + end,
      tags,
    );
  }
  const d = JSON.parse(read("site/data.json"));
  for (const site of d.sites) {
    for (const metric of d.metrics) {
      const values = d.by_lead[site][metric.key];
      const columns = Object.keys(values);
      const label = metric.key === "r" ? "Pearson r" : metric.label;
      const title = site + " · " + label + " by forecast lead";
      const rows = Array.from(
        { length: 18 },
        (_, i) =>
          "H" +
          (i + 1) +
          " | " +
          columns
            .map((k) => (values[k][i] === null ? "unavailable" : Number(values[k][i]).toFixed(4)))
            .join(" | "),
      );
      add(
        title,
        [
          "Full-input refits, three-seed mean metric on matching observed cases. " +
            metric.better +
            " is better.",
          "Native lead | " + columns.join(" | "),
          ...rows,
        ].join("\n"),
        "technical.html#nwm",
        site + " " + metric.key + " lead hour metric scorecard",
        title,
      );
    }
  }
  for (const [pair, rows] of Object.entries(d.removal)) {
    const caption =
      "First-year refits on matched cases. Percentage change in pooled squared error after retraining without an input. Positive means removal worsened error. Pointwise 7-day block intervals hold the fitted seeds fixed.";
    const table = rows.map(
      (r) =>
        r.input +
        " | " +
        r.mean.toFixed(2) +
        "% [" +
        r.interval.map((n) => n.toFixed(2) + "%").join(", ") +
        "] | " +
        r.per_seed.map((n) => n.toFixed(2) + "%").join(", ") +
        (r.cap_limited_seeds.length ? " | capped development twin: " + r.cap_limited_seeds.join(", ") : ""),
    );
    add(
      pair + " · retrained input removals",
      [caption, "Removed input | mean and interval | seeds " + d.seeds.join(", "), ...table].join("\n"),
      "technical.html#inputs",
      "removal ablation soilmoisture precipitation temperature humidity snow gauge history seed contribution table",
    );
    const comparisons = { NWM: d.against_nwm[pair], ...d.against_simple[pair] };
    const changes = Object.entries(comparisons).map(
      ([name, row]) =>
        name + " | " + [row.estimate, row.low, row.high].map((n) => (100 * n).toFixed(2) + "%").join(" | "),
    );
    add(
      pair + " · comparison with NWM and simple baselines",
      [
        "Pooled squared error change of the full-input refit relative to the named comparator on the same evaluation cases. Negative means the network had lower error. Pointwise seven-day block interval with the fitted seeds fixed.",
        "Comparator | estimate | lower | upper",
        ...changes,
      ].join("\n"),
      "technical.html#simple",
      "baseline regression persistence nwm pooled interval full-input",
    );
  }
  const weekly = JSON.parse(read("site/files/flow-weeks.json"));
  for (const [site, series] of Object.entries(weekly.sites)) {
    const rows = weekly.weeks.map((d, i) => d + " " + (series.values[i].mean ?? "gap"));
    add(
      site + " · observed weekly hydrograph",
      "Calendar weeks start on Monday. Weekly mean USGS discharge in m³/s, with seven approved and unflagged daily means required. The dates are in the fitting period. These are observational summaries. Week and flow:\n" +
        rows.join("; "),
      "index.html#hydrographs",
      site + " hydrograph observed river week fitting dates discharge",
    );
  }
  add(
    "Study design and the three gauges",
    "Hurricane Helene in September 2024 motivated the work. The study covers May 2021 through April 2023, when native NWM H1–H18 forecasts were available. Helene lies outside that interval. Fit May 2021–January 2022; validation February–April 2022; historical evaluation May 2022–April 2023. The final refits use the complete first year. The second year was exposed in prior work. HRRR supplied all weather inputs. Jefferson, North Carolina is on the South Fork New River, Galax, Virginia is on the New River, and Sugar Grove, North Carolina is on the Watauga River.",
    "index.html#research",
    "motivation helene dates interval site river location dataset split history forecast",
  );
  add(
    "What explains the difference between gauges?",
    "The frozen full-input refit networks reduced pooled squared error at Jefferson and Galax. The three Sugar Grove results stayed within about 1% of NWM. Sugar Grove's Transformer had higher MAE at all 18 leads. Removing initial soil moisture and retraining raised pooled squared error at Jefferson and Galax. These are predictive contrasts in one historical year. The study did not isolate a hydrologic cause for the difference between gauges or establish independent flood-event skill.",
    "index.html#interpretation",
    "differ compare gauge sites galax jefferson sugargrove gain less performance worse soilmoisture cause",
  );
  add(
    "Study team and AGU poster",
    "Mitchel Carson is affiliated with The University of Texas at Austin. Mohammad Ali Javidian (Computer Science) and William P. Anderson Jr. (Geological and Environmental Sciences) are affiliated with Appalachian State University. The study page identifies AGU26 poster H51P-1404 for December 11, 2026 in San Francisco.",
    "index.html#people",
    "authors coauthors researcher affiliation university conference team poster agu venue",
  );
  const frequencies = new Map();
  for (const doc of docs) for (const t of doc.terms) frequencies.set(t, (frequencies.get(t) || 0) + 1);
  return { docs, frequencies };
}

export function retrieve(question, history = []) {
  corpus ||= build();
  const { docs, frequencies } = corpus;
  const current = [...new Set(words(question))];
  const previous = [
    ...new Set(
      history
        .filter((m) => m.role === "user")
        .slice(-2)
        .flatMap((m) => words(m.content)),
    ),
  ];
  const score = (q, doc) =>
    q.reduce((n, t) => {
      if (!doc.terms.has(t)) return n;
      const idf = Math.log(1 + docs.length / (1 + frequencies.get(t)));
      return n + idf * (doc.head.has(t) ? 3 : 1);
    }, 0);
  const shortFollowup =
    current.length <= 6 &&
    (current.some((t) => frequencies.has(t)) ||
      /^(and |why\b|what about|what else|explain|tell me more|how so|why is that)/i.test(question));
  const sites = ["galax", "jefferson", "sugargrove"].filter((site) => current.includes(site));
  const metricWords = ["mae", "rmse", "pearson", "kge", "nse"];
  const metrics = metricWords.filter(
    (metric) =>
      current.includes(metric) ||
      (shortFollowup && !metricWords.some((k) => current.includes(k)) && previous.includes(metric)),
  );
  const families = ["lstm", "gruconv", "transformer"].filter((k) => current.includes(k));
  const mechanism =
    families.length &&
    !metrics.length &&
    !current.includes("removal") &&
    /how (does|do|did)|under the hood|architecture|encode|decoder|implementation/i.test(question);
  const ranked = docs
    .flatMap((doc) => {
      if (doc.title.includes(" / ") && sites.length && !sites.some((site) => doc.head.has(site))) return [];
      if (doc.title.includes(" / ") && families.length && !families.some((f) => doc.head.has(f))) return [];
      if (doc.head.has("scorecard") && sites.length && !sites.some((site) => doc.head.has(site))) return [];
      if (doc.head.has("scorecard") && metrics.length && !metrics.some((metric) => doc.head.has(metric)))
        return [];
      const local = score(current, doc);
      if (!local && !shortFollowup) return [];
      let value = local + score(previous, doc) * (shortFollowup ? 0.62 : 0.12);
      if (mechanism && doc.head.has("implementation") && families.some((f) => doc.head.has(f))) value += 23;
      if (metrics.length && doc.head.has("scorecard") && sites.length) value += 8;
      if (sites.length > 1 && sites.every((site) => doc.head.has(site)) && !metrics.length) value += 9;
      if (current.includes("removal") && doc.head.has("removal")) value += 7;
      if (current.includes("checkpoint") && doc.head.has("checkpoint")) value += 7;
      return value > 0 ? [{ doc, value }] : [];
    })
    .sort((a, b) => b.value - a.value);
  const picked = [],
    counts = new Map();
  for (const { doc } of ranked) {
    if ((counts.get(doc.group) || 0) >= 2) continue;
    picked.push({ id: "S" + (picked.length + 1), title: doc.title, href: doc.href, text: doc.body });
    counts.set(doc.group, (counts.get(doc.group) || 0) + 1);
    if (picked.length === 5) break;
  }
  return picked;
}
