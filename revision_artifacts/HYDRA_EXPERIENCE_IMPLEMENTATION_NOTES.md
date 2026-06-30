# Hydra Experience Implementation Notes

Generated: 2026-06-30

## Decisions Implemented

- Replaced the public `/` Home route with Hydra Experience.
- Kept existing evidence routes intact: `/analysis`, `/era5`, `/experiments`, `/model`, and `/manuscript`.
- Built the experience as an educational decision-support demo, not an official alerting product.
- Used React Three Fiber, Three.js, Framer Motion, and CSS overlays for the high-fidelity scroll experience.
- Added persistent controls for Skip Experience, Exit, Reduce Motion, and opt-in sound.
- Kept all safety/product copy in `dashboard/src/lib/hydra-experience-content.ts` for auditability.

## Safety Sources Used

- National Weather Service flood watch/warning guidance: `https://www.weather.gov/safety/flood-watch-warning`
- National Weather Service Turn Around Don't Drown guidance: `https://www.weather.gov/safety/flood-turn-around-dont-drown`
- Ready.gov flood protective actions: `https://www.ready.gov/floods`

## Claims Avoided

- No claim that Hydra replaces official National Weather Service warnings or local emergency instructions.
- No claim that Hydra guarantees safety, prevents floods, or issues real alerts.
- No claim that Hydra beats one-hour persistence.
- No causal feature-importance language was added.
- No new hydrology experiment, regulated-site, dam-operation, or deployment claim was added.

## Performance and Accessibility Fallbacks

- Reduced Motion disables the rising water overlay and replaces the animated Three scene with a static storm background.
- Audio is off by default and starts only after the user clicks the sound control.
- The Home page keeps direct Skip and Exit links to `/analysis`.
- The final scene links users back into the existing evidence dashboard instead of duplicating chart-heavy pages.

## Validation Status

- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed with four pre-existing unused-variable warnings in untouched components.
- `npm run build`: passed.
- Route smoke checks returned 200 for `/`, `/analysis`, `/era5`, `/experiments`, `/model`, and `/manuscript`.
- Desktop/mobile visual smoke screenshots were captured for the landing, road-choice, Hydra-activation, and final evidence scenes under `output/playwright/`.
- Mobile hash navigation was adjusted so fixed experience controls do not cover section headings.
- Claim checks found no unsupported public-facing language about replacing official warnings, guaranteeing safety, preventing floods, beating persistence, causal feature importance, or dam-operation explanations.
