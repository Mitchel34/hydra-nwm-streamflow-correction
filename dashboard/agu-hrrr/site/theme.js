/* Apply the saved appearance before paint. System mode also follows live OS changes. */
(() => {
  const key = "hydra-appearance";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const valid = ["system", "light", "dark"];
  function read() {
    try {
      const value = localStorage.getItem(key);
      return valid.includes(value) ? value : "system";
    } catch { return "system"; }
  }
  let chosen = read();
  function sync() {
    root.dataset.theme = chosen === "system" ? (system.matches ? "dark" : "light") : chosen;
    document.querySelectorAll("[data-theme-picker]").forEach(select => { select.value = chosen; });
  }
  sync();
  root.classList.add("js");
  document.addEventListener("DOMContentLoaded", () => {
    sync();
    document.querySelectorAll("[data-theme-picker]").forEach(select => select.addEventListener("change", () => {
      chosen = select.value;
      try { localStorage.setItem(key, chosen); } catch { /* Private browsing can restrict storage. */ }
      sync();
    }));
  });
  system.addEventListener("change", sync);
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) { chosen = read(); sync(); }
  });
})();
