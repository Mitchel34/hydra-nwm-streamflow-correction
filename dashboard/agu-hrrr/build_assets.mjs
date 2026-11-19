import { copyFile, mkdir } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const vendor = new URL("site/vendor/", root);
await mkdir(vendor, { recursive: true });
for (const [source, name] of [
  ["chart.js/dist/chart.umd.min.js", "chart.umd.min.js"],
  ["chart.js/LICENSE.md", "Chart.js-LICENSE.md"],
  ["@kurkle/color/LICENSE.md", "kurkle-color-LICENSE.md"],
]) {
  await copyFile(new URL("node_modules/" + source, root), new URL(name, vendor));
}
