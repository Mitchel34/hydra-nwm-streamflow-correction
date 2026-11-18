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
    plot.addEventListener("click", event => {
      const rect = plot.getBoundingClientRect();
      const x = (event.clientX - rect.left) * plot.viewBox.baseVal.width / rect.width;
      const first = positions.getItem(0).x, last = positions.getItem(rows.length - 1).x;
      slider.value = 1 + Math.round(Math.max(0, Math.min(1, (x - first) / (last - first))) * (rows.length - 1));
      selectLead();
    });
  }

  const hero = document.querySelector(".opening");
  const picture = hero.querySelector(".hero-image");
  const motion = matchMedia("(prefers-reduced-motion: no-preference) and (hover:hover) and (pointer:fine) and (min-width:651px)");
  let visible = true, scheduled = false;
  function paint() {
    scheduled = false;
    if (!motion.matches) { picture.style.removeProperty("--travel"); return; }
    if (visible) picture.style.setProperty("--travel", Math.min(15, Math.max(0, -hero.getBoundingClientRect().top * .045)) + "px");
  }
  function queue() {
    if (!scheduled && visible && motion.matches) { scheduled = true; requestAnimationFrame(paint); }
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) queue();
  }).observe(hero);
  window.addEventListener("scroll", queue, {passive:true});
  motion.addEventListener("change", paint);
  paint();
})();
