(() => {
  const host = document.getElementById("hydrographs");
  if (!host || typeof Chart === "undefined") return;
  const data = JSON.parse(host.querySelector("#weekly-flow-data").textContent);
  const names = Object.keys(data.sites);
  const checks = [...host.querySelectorAll("input[type=checkbox]")];
  const windowSelect = host.querySelector("#flow-window");
  const slider = host.querySelector("#flow-week");
  const stage = host.querySelector(".flow-canvas");
  const table = host.querySelector("table");
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const format = (date, fmt) => fmt.format(new Date(date + "T12:00:00Z"));
  const dashes = [[], [9, 4], [2, 4]];
  let start = 0,
    end = data.weeks.length - 1,
    selected = 0;
  let chart;

  function palette() {
    const css = getComputedStyle(document.documentElement);
    const color = (name) => css.getPropertyValue(name).trim();
    return {
      lines: ["--lstm", "--gru", "--transformer"].map(color),
      text: color("--sub"),
      grid: color("--line"),
    };
  }
  function describe() {
    const display = format(data.weeks[selected], longDate);
    host.querySelector(".flow-date").textContent = "Week of " + display;
    const readings = checks.flatMap((box, i) => {
      if (!box.checked) return [];
      const cell = data.sites[names[i]].values[selected];
      const value = cell.mean === null ? "gap (" + cell.days + "/7 days)" : cell.mean.toFixed(2) + " m³/s";
      return [names[i] + " " + value];
    });
    host.querySelector(".flow-reading").textContent = readings.join("  ·  ");
    slider.value = String(selected);
    slider.setAttribute("aria-valuetext", display + ". " + readings.join(", "));
  }
  const rule = {
    id: "weekRule",
    afterDatasetsDraw(c) {
      const x = c.scales.x.getPixelForValue(selected - start);
      const { ctx, chartArea } = c;
      ctx.save();
      ctx.strokeStyle = c.scales.x.options.ticks.color;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };
  function select(index) {
    selected = Math.max(start, Math.min(end, index));
    describe();
    chart.draw();
  }
  function pick(event, active, c) {
    if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || !c.isPointInArea(event)) return;
    select(start + Math.round(c.scales.x.getValueForPixel(event.x)));
  }
  function update() {
    const windowIndex = Number(windowSelect.value);
    start = windowIndex ? (windowIndex - 1) * 13 : 0;
    end = windowIndex ? Math.min(start + 12, data.weeks.length - 1) : data.weeks.length - 1;
    selected = Math.max(start, Math.min(end, selected));
    const colors = palette();
    chart.data.labels = data.weeks.slice(start, end + 1).map((d) => format(d, monthDay));
    chart.data.datasets = names.map((name, i) => ({
      label: name,
      data: data.sites[name].values.slice(start, end + 1).map((v) => v.mean),
      borderColor: colors.lines[i],
      backgroundColor: colors.lines[i],
      borderDash: dashes[i],
      borderWidth: 2.6,
      pointRadius: 1.6,
      pointHoverRadius: 5,
      pointHitRadius: 8,
      spanGaps: false,
      tension: 0,
      hidden: !checks[i].checked,
    }));
    for (const axis of ["x", "y"]) {
      chart.options.scales[axis].ticks.color = colors.text;
      chart.options.scales[axis].grid.color = colors.grid;
      chart.options.scales[axis].border.color = colors.grid;
    }
    slider.min = String(start);
    slider.max = String(end);
    const onlyOne = checks.filter((b) => b.checked).length === 1;
    checks.forEach((b, i) => {
      b.disabled = onlyOne && b.checked;
      table.tHead.rows[0].cells[i + 1].hidden = !b.checked;
    });
    [...table.tBodies[0].rows].forEach((row, i) => {
      row.hidden = i < start || i > end;
      checks.forEach((b, col) => (row.cells[col + 1].hidden = !b.checked));
    });
    chart.update("none");
    describe();
  }
  stage.hidden = false;
  try {
    chart = new Chart(stage.querySelector("canvas"), {
      type: "line",
      data: { labels: [], datasets: [] },
      plugins: [rule],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false, axis: "x" },
        onHover: pick,
        onClick: pick,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              title: (items) =>
                items.length ? "Week of " + format(data.weeks[start + items[0].dataIndex], longDate) : "",
              label: (item) => item.dataset.label + "  " + item.parsed.y.toFixed(2) + " m³/s",
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: true },
            ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkip: true },
          },
          y: { beginAtZero: true, border: { display: false }, ticks: { maxTicksLimit: 6 } },
        },
      },
    });
    update();
  } catch {
    stage.hidden = true;
    if (chart) chart.destroy();
    return;
  }
  host.querySelector(".flow-static").hidden = true;
  host.querySelector(".flow-controls").hidden = false;
  host.querySelector(".flow-inspect").hidden = false;
  checks.forEach((box) => box.addEventListener("change", update));
  windowSelect.addEventListener("change", update);
  slider.addEventListener("input", () => select(Number(slider.value)));
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();
