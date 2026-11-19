import { studyData } from "./knowledge.mjs";

const repository =
  "https://github.com/Mitchel34/hydra-nwm-streamflow-correction/blob/agu-hrrr-2026/dashboard/agu-hrrr/";
const guide = (section) => repository + "site/files/CODE_GUIDE.md#" + section;
const findings = [
  "Findings and limitations",
  repository + "site/files/FINDINGS.md#what-the-poster-can-and-cannot-say",
];
const scores = ["Lead-by-lead scorecards", "technical.html#nwm"];
const training = ["Training and checkpoint code", guide("scaling-loss-and-checkpoint-selection")];
const reconstruction = ["Residual reconstruction code", guide("where-the-correction-is-added")];

function answer(rows) {
  const sources = [];
  const paragraphs = rows.map(([text, ...refs]) => {
    const citations = refs.map(([title, href]) => {
      let source = sources.find((s) => s.href === href);
      if (!source) {
        source = { id: "S" + (sources.length + 1), title, href };
        sources.push(source);
      }
      return source.id;
    });
    return { text, citations };
  });
  return { mode: "study", kind: "answer", paragraphs, sources };
}

const overview = [
  [
    "Local corrections improved the National Water Model (NWM) at two of the three gauges. Across the 1–18 hour forecasts, pooled squared error fell 41–46% at Jefferson and 36–49% at Galax across the three model families. Sugar Grove stayed within about 1% of NWM.",
    findings,
  ],
  [
    "The choice also depends on how far ahead you forecast. At Galax, carrying the latest gauge reading forward gave lower mean absolute error than every network through hour 7. These results cover one historical year that earlier work had already scored.",
    ["Simple baselines", "technical.html#simple"],
    findings,
  ],
];
const sugar = [
  [
    "The study measured the gap but could not pin it on a physical cause. Sugar Grove’s three corrections stayed within about 1% of NWM on pooled squared error. The Transformer actually raised mean absolute error at every lead. At one hour, it missed by 0.73 m³/s on average versus 0.32 m³/s for NWM.",
    findings,
    scores,
  ],
  [
    "Soil moisture helped the networks at Jefferson and Galax when tested by removing it and retraining. That shows those models used the information. It leaves open why the same recipe found little useful correction at Sugar Grove.",
    ["Input-removal results", "technical.html#inputs"],
  ],
];
const inputs = [
  [
    "Initial soil moisture showed the clearest recurring contribution. Removing it and retraining raised pooled squared error by about 16–30% at Jefferson and 22–61% at Galax across the three networks.",
    ["Input-removal results", "technical.html#inputs"],
  ],
  [
    "At Sugar Grove the largest three-seed mean effect of any tested removal was 4.8%. Each comparison used the same eligible cases as its full-input model. It measures what an input contributed to prediction under that recipe.",
    findings,
  ],
];
const residual = [
  "The network predicts the signed error in the National Water Model forecast at each lead. In the frozen campaign, validation_metrics in src/agu_hydra/training/ablation_campaign.py adds baseline + residual at line 346. Both terms are discharge in m³/s for the same forecast and valid hour.",
  reconstruction,
];
const checkpoint = [
  "The checkpoint decision is in _fit_loop in src/agu_hydra/training/engine.py, lines 315–348. A strictly lower validation loss replaces the saved epoch. A tie keeps the earlier one, and ten consecutive epochs without improvement stop training. Epoch zero is diagnostic. The first-year refit uses the development run’s selected epoch count.",
  training,
];
const methods = {
  gru: [
    "GRU+Conv reads the previous 168 hours of gauge observations with a recurrent encoder initialized from HRRR soil moisture. Two small convolutions read adjacent hours of the NWM and HRRR forecast already issued at the forecast origin. A shared prediction head combines the two streams to give each lead its own signed correction.",
    ["HydraGRUConv implementation", guide("gru-with-forecast-convolutions")],
  ],
  lstm: [
    "The sequence-to-sequence LSTM encodes 168 hours of gauge history, starting its hidden state from HRRR soil moisture. A decoder then steps through the 18 issued forecast hours and a shared linear layer predicts a signed adjustment to NWM at each lead.",
    ["Seq2SeqLSTM implementation", guide("sequence-to-sequence-lstm")],
  ],
  transformer: [
    "The Transformer groups a week of gauge history into 56 three-hour patches. Attention connects those patches, and the 18 forecast queries can use both that history and the initial soil state. The same output head reads out a correction for each lead.",
    ["TemporalTransformer implementation", guide("temporal-transformer")],
  ],
};
const metricPatterns = {
  mae: /\bmae\b|mean absolute error/,
  rmse: /\brmse\b|root mean square[d]? error/,
  kge: /\bkge\b|kling.gupta/,
  nse: /\bnse\b|nash.sutcliffe/,
  r: /pearson|correlation/,
};
const siteNames = ["Galax", "Jefferson", "Sugar Grove"];
const metricLabels = {
  mae: "mean absolute error",
  rmse: "root mean squared error",
  kge: "original KGE",
  nse: "NSE",
  r: "Pearson correlation",
};
const predictors = [
  [
    "Linear regression on NWM",
    /\b(?:linear regression|affine(?: regression| correction)?)(?: on (?:the )?(?:nwm|national water model))?\b/g,
  ],
  ["Mean error per lead", /\b(?:mean[- ]residual(?: correction)?|mean error per lead)\b/g],
  ["Persistence", /\b(?:persistence|latest[- ]observation baseline)\b/g],
  ["NWM", /\b(?:nwm|national water model)\b/g],
  ["LSTM", /\blstm\b/g],
  ["GRU+Conv", /\bgru(?:\s*[+ -]\s*conv)?\b/g],
  ["Transformer", /\btransformer\b/g],
];
const displayName = {
  Persistence: "persistence",
  Transformer: "the Transformer",
  LSTM: "the LSTM",
  "Mean error per lead": "the mean-residual correction",
  "Linear regression on NWM": "the affine correction",
};
function namedPredictors(text) {
  const models = [];
  for (const [name, pattern] of predictors) {
    const remaining = text.replace(pattern, " ");
    if (remaining !== text) models.push(name);
    text = remaining;
  }
  return models;
}
function metricCard(site, metric, lead) {
  const data = studyData(),
    values = data.by_lead[site][metric];
  const units = ["rmse", "mae"].includes(metric) ? " m³/s" : "";
  const raw = (name) => values[name][lead - 1];
  return {
    label: metricLabels[metric],
    better: data.metrics.find((m) => m.key === metric).better,
    raw,
    value: (name) =>
      Number.isFinite(raw(name)) ? raw(name).toFixed(units ? 2 : 3) + units : "unavailable",
    source: [
      site + " · " + metricLabels[metric] + " scorecard",
      "technical.html?metric=" + metric + "#nwm",
    ],
  };
}
function comparePair(card, [a, b]) {
  const name = (model) => displayName[model] || model;
  if (![card.raw(a), card.raw(b)].every(Number.isFinite))
    return (
      card.label +
      " was " +
      card.value(a) +
      " for " +
      name(a) +
      " and " +
      card.value(b) +
      " for " +
      name(b) +
      "."
    );
  if (card.value(a) === card.value(b))
    return "both forecasts had " + card.label + " of " + card.value(a) + " at the displayed precision.";
  const betterA = card.better === "lower" ? card.raw(a) < card.raw(b) : card.raw(a) > card.raw(b);
  const [best, other] = betterA ? [a, b] : [b, a];
  return (
    name(best) +
    " had " +
    card.better +
    " " +
    card.label +
    " (" +
    card.value(best) +
    ") than " +
    name(other) +
    " (" +
    card.value(other) +
    ")."
  );
}
function dimensions(text) {
  const sites = siteNames.filter((s) => text.includes(s.toLowerCase()));
  const metrics = Object.keys(metricPatterns).filter((key) => metricPatterns[key].test(text));
  const leads = [
    ...text.matchAll(
      /\b(?:h\s*|(?:lead|hour)\s*[-#]?\s*)(\d{1,2})\b|\b(\d{1,2})[- ]?(?:h|hrs?|hours?)\b/g,
    ),
  ].map((m) => Number(m[1] || m[2]));
  return { sites, metrics, leads: [...new Set(leads)], models: namedPredictors(text) };
}
function scorecard(q, history) {
  if (
    /\b(why|ablat\w*|remov\w*|validat\w*|train\w*|seed|percent|interval|difference|bias|versus other sites|through|from)\b|\d\s*[-–]\s*(?:h\s*)?\d/.test(
      q,
    )
  )
    return;
  const d = dimensions(q);
  if (/^(?:and\b|what about\b|how about\b|at h\d|at hour\b)|\bthere\b/.test(q)) {
    for (const turn of history.filter((turn) => turn.role === "user").reverse()) {
      const older = dimensions(turn.content.toLowerCase());
      for (const k of ["sites", "metrics", "leads", "models"]) if (!d[k].length) d[k] = older[k];
    }
  }
  if (d.sites.length !== 1 || !d.metrics.length || d.leads.length !== 1) return;
  const [site] = d.sites,
    [lead] = d.leads;
  if (lead < 1 || lead > 18) return;
  const when = lead + (lead === 1 ? " hour ahead" : " hours ahead");
  if (d.models.length === 2) {
    const rows = d.metrics.map((metric, i) => {
      const card = metricCard(site, metric, lead),
        comparison = comparePair(card, d.models);
      const text = i
        ? comparison[0].toUpperCase() + comparison.slice(1)
        : "At " + site + ", " + when + ", " + comparison;
      return [text, card.source];
    });
    rows[rows.length - 1][0] +=
      " Both forecasts were scored on matching observations in the historical evaluation year.";
    return answer(rows);
  }
  if (d.metrics.length !== 1 || d.models.length > 2) return;
  const card = metricCard(site, d.metrics[0], lead);
  if (d.models.length === 1 && d.models[0] !== "NWM")
    return answer([
      [
        "At " +
          site +
          ", " +
          when +
          ", " +
          comparePair(card, [d.models[0], "NWM"]) +
          " The scorecard uses matched observations.",
        card.source,
      ],
    ]);
  return answer([
    [
      site +
        ", " +
        when +
        ": " +
        card.label +
        " was " +
        card.value("NWM") +
        " for NWM and " +
        card.value("Persistence") +
        " for the latest-observation persistence baseline.",
      card.source,
    ],
    [
      studyData()
        .architectures.map((name) => name + " " + card.value(name))
        .join(" · ") +
        ". These are three-seed mean scores on matching observations from the historical evaluation year. " +
        (card.better === "lower" ? "Lower" : "Higher") +
        " values are better.",
      card.source,
    ],
  ]);
}

export function studyAnswer(question, history = []) {
  const q = question.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
  const exact = scorecard(q, history);
  if (exact) return exact;
  if (
    /^(?:(?:please |can you |could you )*(?:summari[sz]e|explain|describe) (?:the |this |your )?(?:study|project|research|(?:main |key )?(?:results|findings))|what (?:did (?:you|the (?:team|study)) find|(?:are|were) (?:the |your )?(?:main |key )?(?:findings|results|takeaways)|is (?:this|the study|hydra) about)|give me (?:a |the )?(?:summary|overview)|what(?:s| is) the (?:takeaway|headline|bottom line))(?:[,. ]+(?:in (?:plain english|simple terms)|briefly|overall|here))?[?.! ]*$/.test(
      q,
    )
  )
    return answer(overview);
  if (
    /sugar grove/.test(q) &&
    /\bwhy\b|(?:performance )?gap|gain less|little improvement/.test(q) &&
    !/\b(?:seed|h\d+|kge|nse|mae|rmse|rainfall|soil|learning rate)\b/.test(q)
  )
    return answer(sugar);
  if (
    /^(?:which|what)\b.*\b(?:inputs?|features?|removals?)\b.*\b(?:most|best|important|helped|mattered|largest)\b[?.! ]*$/.test(
      q,
    ) &&
    !siteNames.some((s) => q.includes(s.toLowerCase()))
  )
    return answer(inputs);
  const asksCheckpoint =
    /checkpoint|select(?:ed|ion)? (?:the |an? )?(?:best |trained )?epoch|early stopp?ing/.test(q);
  const asksSum =
    /(?:correction|residual).{0,35}(?:add|nwm|reconstruct)|(?:add|reconstruct).{0,35}(?:correction|residual)/.test(
      q,
    );
  if (asksCheckpoint && asksSum) return answer([residual, checkpoint]);
  if (
    asksCheckpoint &&
    /(?:how|where|rule|choose|select|what is|explain)/.test(q) &&
    !/\bwhich (?:epoch|checkpoint)|\b(?:seed|galax|jefferson|sugar grove|h\d+|why)\b/.test(q)
  )
    return answer([checkpoint]);
  if (
    asksSum &&
    /\b(where|how|what is)\b/.test(q) &&
    !/\b(why|remove|zero|ablat\w*|score|compare|select|soil|gru|lstm|transformer)\b/.test(q)
  )
    return answer([residual]);
  if (
    /persistence/.test(q) &&
    /which (?:function|file)|where .*implement|persistence_donor|how (?:is|does).*?(?:implement|choose|select)/.test(
      q,
    ) &&
    !/ablat|why|versus/.test(q)
  )
    return answer([
      [
        "In evaluation/hydra_evaluation/baselines.py, persistence_donor (line 80) walks backwards through the gauge history. It chooses the latest eligible original observation available when the forecast was issued. The forecast function (line 109) uses that value for each lead. A filled history slot cannot supply the persistence forecast.",
        ["Baseline code guide", guide("baselines-and-scoring")],
      ],
    ]);
  if (
    /hydrographs?/.test(q) &&
    /aggregat|seven.day|weekly|built|function|calculat/.test(q) &&
    !/why|helene|forecast error/.test(q)
  )
    return answer([
      [
        "The summarize function in prepare_hydrographs.py groups the USGS daily means into Monday-start weeks. It publishes a weekly mean only when all seven days have an approved, unflagged observation. A missing day leaves a gap in the chart. The chart shows fitting-period gauge observations.",
        ["Weekly aggregation source", repository + "prepare_hydrographs.py#L23-L51"],
      ],
    ]);
  if (
    /project_inputs|(?:input|feature).{0,15}(?:neutraliz|mask).*(?:ablat|remov)|(?:ablat|remov).*(?:neutraliz|mask)/.test(
      q,
    ) &&
    /how|where|function|code/.test(q) &&
    !/why|performance|soil moisture worth/.test(q)
  )
    return answer([
      [
        "In src/agu_hydra/training/ablations.py, project_inputs (line 109) neutralizes the selected standardized channels and their availability, age and lead information. AblationModel (line 142) keeps the architecture’s input slots in place, so each variant can be retrained with the same capacity. Even when NWM is removed as a predictor, it still supplies the baseline to which the residual is added.",
        ["Input-ablation implementation", guide("retrained-input-ablations")],
      ],
    ]);
  const family = /gru/.test(q)
    ? "gru"
    : /lstm/.test(q)
      ? "lstm"
      : /transformer/.test(q)
        ? "transformer"
        : "";
  if (
    family &&
    /^(?:how (?:does|did)|explain|what is|what.s|describe)\b/.test(q) &&
    /\b(work|works|use the gauge history|architecture|model under the hood)\b/.test(q)
  )
    return answer([methods[family]]);
  if (
    /^(?:where (?:is|can i find)|how (?:can|do) i (?:find|access)) (?:the |your )?(?:code(?:base)?|repo(?:sitory)?|implementation|source code)(?: for (?:this|the) (?:study|project))?[?!. ]*$/.test(
      q,
    )
  )
    return answer([
      [
        "Start with the HRRR study directory on the agu-hrrr-2026 branch. It contains the figure code, released scores and website. The implementation guide maps each model, loss and baseline to its location in the frozen research code. Older experiments elsewhere in the repository used other methods.",
        ["Study directory on GitHub", repository.replace("/blob/", "/tree/")],
        ["Frozen-code guide", repository + "site/files/CODE_GUIDE.md"],
      ],
    ]);
  if (
    /helene/.test(q) &&
    /\b(why|included|evaluate|evaluation|test|motivat\w*)\b/.test(q) &&
    !/\b(rainfall|damage|deaths|now|latest)\b/.test(q)
  )
    return answer([
      [
        "Hurricane Helene motivated the project. The analysis focused on May 2021 through April 2023, when NWM forecasts with native one- through 18-hour lead times were available. Helene occurred in September 2024, outside the study period. These results cannot tell us how the correction would have performed during that storm.",
        ["Study period and design", "index.html#research"],
      ],
    ]);
}
