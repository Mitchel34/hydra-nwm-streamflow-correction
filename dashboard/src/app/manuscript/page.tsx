'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchManuscriptMetadata } from '@/lib/data';
import { ManuscriptMetadata } from '@/lib/types';

const PHASE4_PDF = '/docs/hydra_phase4_manuscript.pdf';

export default function ManuscriptPage() {
  const [metadata, setMetadata] = useState<ManuscriptMetadata | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sourceAvailable, setSourceAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const loadedMetadata = await fetchManuscriptMetadata();
      const pdfPath = loadedMetadata?.pdf ?? PHASE4_PDF;
      const sourcePath = loadedMetadata?.source_zip;
      const [pdfResponse, sourceResponse] = await Promise.all([
        fetch(pdfPath, { method: 'HEAD' }).catch(() => null),
        sourcePath ? fetch(sourcePath, { method: 'HEAD' }).catch(() => null) : Promise.resolve(null),
      ]);

      if (!active) return;
      setMetadata(loadedMetadata);
      setAvailable(Boolean(pdfResponse?.ok));
      setSourceAvailable(Boolean(sourceResponse?.ok));
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const pdfPath = metadata?.pdf ?? PHASE4_PDF;
  const sourceZip = metadata?.source_zip;

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-corrected">
            Paper draft
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            <span className="gradient-text">Manuscript</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b6cddd]">
            The dashboard is a public companion to the Phase 4 Water Resources Research manuscript.
            This page exposes the updated source package and, when available, the compiled Phase 4
            PDF. It intentionally does not fall back to older drafts.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {available === null && (
          <div className="surface-panel rounded-xl p-8 text-center text-[#9fb9ca]">
            Checking manuscript assets...
          </div>
        )}

        {available === false && (
          <div className="surface-panel rounded-xl p-8">
            <h2 className="font-display text-2xl text-white">Phase 4 PDF Not Available Yet</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#a9c2d3]">
              The Phase 4 source package exists, but no compiled Phase 4 PDF is present at{' '}
              <code className="text-hydra-corrected">{pdfPath}</code>.
              This page intentionally does not fall back to older manuscript PDFs because that would
              mix outdated claims with the updated public dashboard.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-5">
                <h3 className="font-display text-base text-white">Source package</h3>
                <p className="mt-2 text-sm text-[#8fb4cc]">
                  <code>{metadata?.source_directory ?? 'docs/manuscript/overleaf/wrr_phase4_era5_revision_20260629/'}</code>
                </p>
                {sourceZip && (
                  <a
                    href={sourceZip}
                    download
                    className="mt-4 inline-flex rounded-full border border-hydra-corrected/45 px-4 py-2 text-sm text-hydra-corrected transition-colors hover:bg-hydra-corrected/10"
                  >
                    {sourceAvailable ? 'Download source bundle' : 'Source bundle path pending'}
                  </a>
                )}
              </div>
              <div className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-5">
                <h3 className="font-display text-base text-white">Expected public PDF path</h3>
                <p className="mt-2 text-sm text-[#8fb4cc]">
                  <code>{pdfPath}</code>
                </p>
                <p className="mt-3 text-xs text-[#8fb4cc]">
                  Local LaTeX tooling is required to create this PDF from the source bundle.
                </p>
              </div>
            </div>
            {metadata && (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-5">
                  <h3 className="font-display text-base text-white">Evidence guardrails</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[#a9c2d3]">
                    {metadata.guardrails.map((guardrail) => (
                      <li key={guardrail}>• {guardrail}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-5">
                  <h3 className="font-display text-base text-white">Source artifacts</h3>
                  <div className="mt-3 space-y-2">
                    {metadata.evidence_sources.map((source) => (
                      <code key={source} className="block text-xs text-[#8fb4cc]">
                        {source}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Link
              href="/era5"
              className="mt-6 inline-flex rounded-full border border-hydra-corrected/45 px-5 py-2.5 text-sm text-hydra-corrected transition-colors hover:bg-hydra-corrected/10"
            >
              View ERA5 evidence instead
            </Link>
          </div>
        )}

        {available === true && (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-[#2a445b] bg-[#071420]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg text-white">Phase 4 Manuscript PDF</h2>
                <p className="mt-1 text-sm text-[#8fb4cc]">
                  Compiled from the updated {metadata?.version ?? 'Phase 4'} manuscript package.
                </p>
              </div>
              <a
                href={pdfPath}
                download
                className="inline-flex justify-center rounded-full bg-hydra-corrected px-5 py-2.5 text-sm font-medium text-[#022133] transition-opacity hover:opacity-90"
              >
                Download PDF
              </a>
            </div>

            <div className="surface-panel h-[80vh] overflow-hidden rounded-xl p-2">
              <object
                data={pdfPath}
                type="application/pdf"
                className="h-full w-full rounded-lg bg-white"
              >
                <div className="flex h-full items-center justify-center p-8 text-center text-[#a9c2d3]">
                  PDF preview is not available in this browser. Use the download button above.
                </div>
              </object>
            </div>
            {sourceZip && (
              <a
                href={sourceZip}
                download
                className="inline-flex rounded-full border border-hydra-corrected/45 px-5 py-2.5 text-sm text-hydra-corrected transition-colors hover:bg-hydra-corrected/10"
              >
                Download source bundle
              </a>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
