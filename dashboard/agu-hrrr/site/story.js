(() => {
  // Preserve incoming bookmarks to the detailed report that previously occupied the homepage.
  const reportSections = new Set(["findings", "nwm", "simple", "inputs", "design", "verdicts", "methods", "limits", "files"]);
  function routeReport() {
    const id = location.hash.slice(1);
    if (!reportSections.has(id)) return false;
    location.replace(new URL("technical.html#" + id, location.href).href);
    return true;
  }
  if (routeReport()) return;
  window.addEventListener("hashchange", routeReport);

  const menu = document.querySelector(".mobile-nav");
  menu.addEventListener("click", event => { if (event.target.closest("a")) menu.open = false; });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
  });
  document.addEventListener("click", event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });

  const panels = Array.from(document.querySelectorAll("[data-gauge]"));
  const buttons = Array.from(document.querySelectorAll("[data-pick]"));
  const panelFor = name => panels.find(panel => panel.dataset.gauge === name);
  function choose(name) {
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.pick === name)));
    panels.forEach(panel => { panel.hidden = panel !== panelFor(name); });
  }
  buttons.forEach(button => button.addEventListener("click", () => choose(button.dataset.pick)));
  choose("Galax");
  for (const panel of panels) {
    const slider = panel.querySelector("input[type=range]");
    const rows = panel.querySelector("tbody").rows;
    const cursor = panel.querySelector(".lead-cursor");
    // The SVG and the accessible table were generated together from the released MAE means.
    const positions = panel.querySelector("polyline").points;
    const values = panel.querySelectorAll("[data-value]");
    function selectLead() {
      const index = Number(slider.value) - 1;
      const x = positions.getItem(index).x;
      cursor.setAttribute("x1", x);
      cursor.setAttribute("x2", x);
      panel.querySelector(".lead-number").textContent = "H" + (index + 1);
      values.forEach((cell,i) => { cell.textContent = rows[index].cells[i + 2].textContent; });
      slider.setAttribute("aria-valuetext", (index + 1) + (index === 0 ? " hour" : " hours"));
    }
    slider.addEventListener("input", selectLead);
    const plot = panel.querySelector(".lead-plot");
    function inspectAt(event) {
      const matrix = plot.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const first = positions.getItem(0).x, last = positions.getItem(rows.length - 1).x;
      const fraction = Math.max(0, Math.min(1, (point.x - first) / (last - first)));
      slider.value = 1 + Math.round(fraction * (rows.length - 1));
      selectLead();
    }
    plot.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") inspectAt(event);
    });
    plot.addEventListener("click", inspectAt);
    const curves = [...plot.querySelectorAll("polyline[data-series]")];
    const toggles = [...panel.querySelectorAll(".plot-legend > span")].map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Show " + curves[index].dataset.series + " line at " + panel.dataset.gauge);
      button.append(...item.childNodes);
      item.replaceWith(button);
      button.addEventListener("click", () => {
        const visible = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(visible));
        curves[index].classList.toggle("curve-off", !visible);
        const shown = toggles.filter(b => b.getAttribute("aria-pressed") === "true");
        toggles.forEach(b => { b.disabled = shown.length === 1 && b === shown[0]; });
      });
      return button;
    });
  }

  const tabs = Array.from(document.querySelectorAll(".model-tabs [role=tab]"));
  const models = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")));

  function showModel(index) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      models[i].hidden = !selected;
    });
  }
  function modelFromHash() {
    return models.findIndex(model => "#" + model.id === location.hash);
  }
  tabs.forEach((tab, index) => {
    models[index].setAttribute("role", "tabpanel");
    models[index].setAttribute("aria-labelledby", tab.id);
    models[index].tabIndex = 0;
    tab.addEventListener("click", () => showModel(index));
    tab.addEventListener("keydown", event => {
      const targets = {
        Home: 0, End: tabs.length - 1,
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        ArrowRight: (index + 1) % tabs.length
      };
      if (!Object.hasOwn(targets, event.key)) return;
      event.preventDefault();
      const next = targets[event.key];
      showModel(next);
      tabs[next].focus();
    });
  });
  showModel(Math.max(0, modelFromHash()));
  document.querySelector(".model-tabs").hidden = false;
  window.addEventListener("hashchange", () => {
    const index = modelFromHash();
    if (index < 0) return;
    showModel(index);
    models[index].scrollIntoView({block: "start"});
  });

  const motion = matchMedia("screen and (prefers-reduced-motion: no-preference)");
  const largePointerView = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 651px)");
  const scenes = Array.from(document.querySelectorAll("[data-parallax]"), element => ({
    element, type: element.dataset.parallax,
    layer: element.querySelector("[data-parallax-layer]") || element,
    visible: true, current: null, target: 0
  }));
  let frame = 0, previousTime = 0, measure = true;
  function draw(now) {
    frame = 0;
    const blend = previousTime ? 1 - Math.exp(-Math.min(now - previousTime, 80) / 65) : .23;
    previousTime = now;
    const active = scenes.filter(scene => scene.visible && (largePointerView.matches || scene.type === "section"));
    if (measure) {
      const viewport = document.documentElement.clientHeight;
      for (const scene of active) {
        const {top, height} = scene.element.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (viewport - 2 * top - height) / (viewport + height)));
        const bandTravel = largePointerView.matches ? 20 : 8;
        const range = scene.type === "photo" ? Math.min(17, height * .05) : bandTravel;
        scene.target = scene.type === "hero" ? Math.min(26, Math.max(0, -top * .065)) : range * progress;
      }
      measure = false;
    }
    let moving = false;
    for (const scene of active) {
      const offset = scene.current === null ? 0 : scene.target - scene.current;
      const settling = Math.abs(offset) > .12;
      scene.current = settling ? scene.current + offset * blend : scene.target;
      scene.layer.style.setProperty("--travel", scene.current.toFixed(2) + "px");
      if (scene.type === "section") scene.layer.style.setProperty("--glow-travel", (scene.current * .4).toFixed(2) + "px");
      moving ||= settling;
    }
    if (moving) frame = requestAnimationFrame(draw);
    else previousTime = 0;
  }
  function queue() {
    measure = true;
    if (!frame && motion.matches) frame = requestAnimationFrame(draw);
  }
  function resetMotion() {
    cancelAnimationFrame(frame);
    frame = previousTime = 0;
    for (const scene of scenes) {
      scene.current = null;
      scene.layer.style.removeProperty("--travel");
      scene.layer.style.removeProperty("--glow-travel");
    }
    queue();
  }
  if ("IntersectionObserver" in window) {
    const byElement = new Map(scenes.map(scene => [scene.element, scene]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const scene = byElement.get(entry.target);
        scene.visible = entry.isIntersecting;
        if (!scene.visible) scene.current = null;
      }
      queue();
    }, {rootMargin: "100px 0px"});
    scenes.forEach(scene => observer.observe(scene.element));
  }
  window.addEventListener("scroll", queue, {passive: true});
  window.addEventListener("resize", queue);
  if ("ResizeObserver" in window) new ResizeObserver(queue).observe(document.querySelector("main"));
  motion.addEventListener("change", resetMotion);
  largePointerView.addEventListener("change", resetMotion);
  queue();
})();
