// Charts for the Hydra site: plain SVG drawn from the page's embedded data. No dependencies.
(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("site-data").textContent);
  var NS = "http://www.w3.org/2000/svg";
  var tooltip = document.getElementById("tooltip");
  var SERIES = [
    { name: "NWM", color: "--s-nwm", width: 2.5 },
    { name: "Persistence", color: "--s-persistence", width: 2.5, dash: "6 4", label: "Persistence of the last gauge reading" },
    { name: "Mean error per lead", color: "--s-simple", width: 1.5, dash: "2 3", simple: true },
    { name: "Linear regression on NWM", color: "--s-simple", width: 1.5, dash: "7 3 2 3", simple: true },
    { name: "LSTM", color: "--s-lstm", width: 2.5 },
    { name: "GRU+Conv", color: "--s-gru", width: 2.5 },
    { name: "Transformer", color: "--s-transformer", width: 2.5 }
  ];
  var SEED_COLORS = ["--seed-1", "--seed-2", "--seed-3"];
  var state = { metric: data.metrics[0], simple: false, site: data.sites[0] };

  function el(name, attributes, parent) {
    var node = document.createElementNS(NS, name);
    for (var key in attributes) node.setAttribute(key, attributes[key]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function css(variable) { return "var(" + variable + ")"; }
  function format(value, digits) { return value.toFixed(digits === undefined ? 2 : digits); }
  function ticks(low, high, count) {
    var span = high - low, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var error = span / count / step;
    step *= error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
    var out = [];
    for (var v = Math.ceil(low / step) * step; v <= high + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { values: out, step: step };
  }
  function showTip(html, event) {
    tooltip.innerHTML = html;
    tooltip.style.opacity = 1;
    var x = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
    var y = Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 8);
    tooltip.style.left = Math.max(8, x) + "px";
    tooltip.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tooltip.style.opacity = 0; }
  function card(parent, title) {
    var box = document.createElement("div");
    box.className = "chart";
    var heading = document.createElement("h4");
    heading.textContent = title;
    box.appendChild(heading);
    parent.appendChild(box);
    return box;
  }
  function swatch(kind, color, dash) {
    var svg = el("svg", { width: 28, height: 12, viewBox: "0 0 28 12", "aria-hidden": "true" });
    if (kind === "line") el("line", { x1: 1, x2: 27, y1: 6, y2: 6, stroke: css(color), "stroke-width": 3, "stroke-dasharray": dash || "" }, svg);
    else el("rect", { x: 4, y: 1, width: 16, height: 10, rx: 2, fill: css(color) }, svg);
    return svg;
  }
  function legend(target, items) {
    target.textContent = "";
    items.forEach(function (item) {
      var span = document.createElement("span");
      span.appendChild(swatch(item.kind, item.color, item.dash));
      span.appendChild(document.createTextNode(item.label));
      target.appendChild(span);
    });
  }
  function buttons(target, options, current, label, onPick) {
    options.forEach(function (option, index) {
      var button = target.children[index];
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.textContent = label(option);
        button.addEventListener("click", function () { onPick(option); });
        target.appendChild(button);
      }
      button.setAttribute("aria-pressed", String(option === current));
    });
  }

  // ---- Score by lead ----
  function lineChart(parent, site) {
    var W = 420, H = 310, m = { l: 50, r: 14, t: 10, b: 46 };
    var shown = SERIES.filter(function (s) { return state.simple || !s.simple; });
    var values = data.by_lead[site][state.metric.key];
    var all = [];
    shown.forEach(function (s) { all = all.concat(values[s.name]); });
    var low = Math.min.apply(null, all), high = Math.max.apply(null, all);
    if (state.metric.better === "lower") low = 0;
    var pad = (high - low) * 0.06;
    var scale = ticks(low - (state.metric.better === "lower" ? 0 : pad), high + pad, 5);
    var y0 = Math.min(scale.values[0], low), y1 = Math.max(scale.values[scale.values.length - 1], high);
    var x = function (i) { return m.l + (W - m.l - m.r) * i / 17; };
    var y = function (v) { return H - m.b - (H - m.t - m.b) * (v - y0) / (y1 - y0); };
    var digits = scale.step >= 1 ? 0 : scale.step >= 0.1 ? 1 : 2;
    var box = card(parent, site);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": state.metric.label + " by lead at " + site + " for NWM, persistence and the three networks" }, box);
    scale.values.forEach(function (v) {
      el("line", { class: "grid", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, svg);
      el("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, svg).textContent = format(v, digits);
    });
    el("line", { class: "axis", x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }, svg);
    for (var i = 0; i < 18; i += 2) el("text", { x: x(i), y: H - m.b + 18, "text-anchor": "middle" }, svg).textContent = String(i + 1);
    el("text", { x: (m.l + W - m.r) / 2, y: H - 4, "text-anchor": "middle" }, svg).textContent = "Lead (h)";
    shown.forEach(function (s) {
      var points = values[s.name].map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
      el("polyline", { points: points, fill: "none", stroke: css(s.color), "stroke-width": s.width, "stroke-dasharray": s.dash || "",
        "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    });
    var cross = el("line", { class: "cross", y1: m.t, y2: H - m.b }, svg);
    var hit = el("rect", { class: "hit", x: m.l - 8, y: m.t, width: W - m.l - m.r + 16, height: H - m.t - m.b }, svg);
    function move(event) {
      var rect = svg.getBoundingClientRect();
      var px = (event.clientX - rect.left) * W / rect.width;
      var i = Math.max(0, Math.min(17, Math.round((px - m.l) / (W - m.l - m.r) * 17)));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.style.visibility = "visible";
      var order = shown.slice().sort(function (a, b) {
        return (state.metric.better === "lower" ? 1 : -1) * (values[a.name][i] - values[b.name][i]);
      });
      showTip("<strong>" + site + ", lead " + (i + 1) + " h</strong>" + order.map(function (s) {
        return '<span class="row"><span>' + s.name + "</span><span>" + format(values[s.name][i], digits + 2) + "</span></span>";
      }).join(""), event);
    }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", function () { cross.style.visibility = "hidden"; hideTip(); });
  }
  function drawLeads() {
    var target = document.getElementById("lead-charts");
    target.textContent = "";
    data.sites.forEach(function (site) { lineChart(target, site); });
    legend(document.getElementById("lead-legend"), SERIES.filter(function (s) { return state.simple || !s.simple; }).map(function (s) {
      return { kind: "line", color: s.color, dash: s.dash, label: s.label || s.name };
    }));
    document.getElementById("metric-direction").textContent = state.metric.label + ", mean of three seeds. " +
      (state.metric.better === "lower" ? "Lower is better." : "Higher is better.");
    buttons(document.getElementById("metric-buttons"), data.metrics, state.metric, function (metric) { return metric.label.replace(" (m³/s)", ""); },
      function (metric) { state.metric = metric; drawLeads(); });
  }

  // ---- Input removal ----
  function barChart(parent, network, site) {
    var rows = data.removal[network + " / " + site];
    var W = 420, H = 330, m = { l: 128, r: 16, t: 8, b: 30 };
    var low = 20 * Math.floor(data.removal_range[0] / 20), high = 20 * Math.ceil(data.removal_range[1] / 20);
    var x = function (v) { return m.l + (W - m.l - m.r) * (v - low) / (high - low); };
    var band = (H - m.t - m.b) / rows.length, bar = band * 0.24;
    var box = card(parent, network + " · " + site);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Change in squared error when each input group is removed, per seed, " + network + " at " + site }, box);
    for (var v = low; v <= high; v += 20) {
      el("line", { class: v === 0 ? "zero" : "grid", x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }, svg);
      el("text", { x: x(v), y: H - m.b + 18, "text-anchor": "middle" }, svg).textContent = (v % 40 === 0 ? v + "%" : "");
    }
    rows.forEach(function (row, r) {
      var top = m.t + band * r;
      el("text", { x: m.l - 8, y: top + band / 2 + 5, "text-anchor": "end" }, svg).textContent = row.input;
      row.per_seed.forEach(function (value, s) {
        var left = Math.min(x(0), x(value)), width = Math.max(1, Math.abs(x(value) - x(0)));
        var rect = el("rect", { class: "bar", x: left, y: top + band * 0.14 + s * bar, width: width, height: bar - 1.5, rx: 1.5,
          fill: css(SEED_COLORS[s]) }, svg);
        var tip = "<strong>" + row.input + " removed</strong>" + network + " at " + site +
          '<span class="row"><span>Seed ' + data.seeds[s] + "</span><span>" + (value >= 0 ? "+" : "") + format(value, 1) + "%</span></span>" +
          '<span class="row"><span>Mean of three seeds</span><span>' + (row.mean >= 0 ? "+" : "") + format(row.mean, 1) + "%</span></span>" +
          (row.cap_limited_seeds.indexOf(Number(data.seeds[s])) >= 0 ? "This removed-input fit ended at the epoch cap." : "");
        rect.addEventListener("pointermove", function (event) { showTip(tip, event); });
        rect.addEventListener("pointerleave", hideTip);
      });
    });
  }
  function drawRemoval() {
    var target = document.getElementById("removal-charts");
    target.textContent = "";
    data.architectures.forEach(function (network) { barChart(target, network, state.site); });
    legend(document.getElementById("seed-legend"), data.seeds.map(function (seed, s) {
      return { kind: "bar", color: SEED_COLORS[s], label: "Seed " + seed + (s === 2 ? " (took no part in choosing the recipe)" : "") };
    }));
    buttons(document.getElementById("site-buttons"), data.sites, state.site, function (site) { return site; },
      function (site) { state.site = site; drawRemoval(); });
  }

  document.getElementById("show-simple").addEventListener("change", function (event) { state.simple = event.target.checked; drawLeads(); });
  window.addEventListener("scroll", hideTip, { passive: true });
  drawLeads();
  drawRemoval();
})();
