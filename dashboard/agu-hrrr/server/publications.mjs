const ignored = new Set(
  "a an the me some on about what is are how do does can you i please could would usgs publication publications papers paper research studies study find look up search for external sources source internet web related to tell show any recent work by articles article from in using journal have there other literature evidence work that mentions mentioning published available".split(
    " ",
  ),
);

export function searchTerms(question) {
  const quoted = question.match(/["“]([^"”]{3,100})["”]/);
  if (quoted) return quoted[1].trim();
  const words = (question.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []).filter(
    (w) => !ignored.has(w),
  );
  return [...new Set(words)].slice(0, 8).join(" ");
}
const plain = (text) =>
  String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(?:amp|lt|gt|quot|#39|nbsp);/g,
      (s) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " })[s],
    )
    .replace(/\s+/g, " ")
    .trim();

export async function publications(question, send, signal) {
  const terms = searchTerms(question);
  if (!terms) return { status: "empty", terms, sources: [] };
  const url = new URL("https://pubs.usgs.gov/pubs-services/publication/");
  url.search = new URLSearchParams({ title: terms, page_size: "3", mimetype: "json" });
  try {
    const response = await send(url.href, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
    });
    if (!response.ok) throw new Error("Search unavailable");
    const data = await response.json();
    if (!Array.isArray(data.records)) throw new Error("Search unavailable");
    const sources = [];
    for (const row of data.records.slice(0, 3)) {
      if (!/^[a-z0-9]{1,45}$/i.test(row.indexId || "") || !plain(row.title)) continue;
      const title = plain(row.title).slice(0, 400);
      const year = /^\d{4}$/.test(row.publicationYear) ? " (" + row.publicationYear + ")" : "";
      const abstract = plain(row.docAbstract).slice(0, 850);
      sources.push({
        id: "W" + (sources.length + 1),
        title: title + year,
        href: "https://pubs.usgs.gov/publication/" + row.indexId,
        text: "External USGS publication record. " + title + year + ". " + abstract,
      });
    }
    return { status: sources.length ? "found" : "empty", terms, sources };
  } catch {
    return { status: "unavailable", terms, sources: [] };
  }
}
