# Experience Hydra Cinematic Redesign

Generated: 2026-06-30

## Current-State Audit

The current Hydra Experience is a Next.js App Router home page at `dashboard/src/app/page.tsx`, implemented primarily through `dashboard/src/components/hydra-experience/HydraExperienceScene.tsx`. The dashboard uses React 19, Next.js 16, Framer Motion, Three.js, React Three Fiber, Tailwind v4, and a typed content file at `dashboard/src/lib/hydra-experience-content.ts`.

The current experience already has a responsible narrative: rain begins, flood timing is explained, a flooded-road decision teaches NWS safety guidance, the interface floods, Hydra activates, and the final section links back to Findings, ERA5 Evidence, Experiments, Model, and Manuscript. Safety source links are present for NWS flood watch/warning guidance, NWS Turn Around Don't Drown guidance, and Ready.gov flood protective actions.

The main gap is experiential fidelity. The hero still has too much inert dark space, the rain layer is present but not tactile enough, signal information is mostly static text, the flooded-interface moment does not yet make the UI feel submerged, Hydra activation is a card grid rather than a noticeable transition from chaos to clarity, and the with/without comparison is not interactive.

Baseline checks before redesign:

- `npm run lint`: passed with four pre-existing unused-variable warnings in untouched components.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm run build`: passed.

## External Reference Matrix

| Reference | URL | What it does well | Conceptual borrowing | Implementation notes | Licensing / copying cautions |
| --- | --- | --- | --- | --- | --- |
| Evan Wallace, WebGL Water | https://madebyevan.com/webgl-water/ | Cursor-drawn water ripples, reflective/refraction-heavy water, heightfield feel, interaction that makes the surface feel physical. | Use pointer/touch ripples and a stronger waterline as an emotional cue. | Full heightfield simulation is too heavy for this pass; implement lightweight CSS/canvas ripples and keep R3F background original. | Do not copy source, textures, or shaders. The demo also cites external tile textures, so no asset reuse. |
| Codrops, Rain & Water Effect Experiments | https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/ and https://github.com/codrops/RainEffect | Rain-on-glass, droplet trails, refraction, atmospheric foreground layer. | Add a glass/streak layer over the hero and warning scenes so the page feels viewed through a windshield or command surface. | Use original CSS gradients and deterministic drops, not the old shader/demo code. | The repo is MIT, but no code or assets are copied; the implementation stays original and avoids legacy compatibility issues noted in the project comments. |
| Three.js GPGPU Water example | https://threejs.org/examples/webgl_gpgpu_water.html | Interactive water disturbance and GPU heightmap pattern. | Treat pointer disturbance as a design pattern, not as a required physical simulation. | Full GPGPU water is out of scope for this iteration; use R3F and CSS/canvas overlays already in the app. | Three.js examples are open-source, but no example code is copied. |
| Three.js Water helper docs | https://threejs.org/docs/pages/Water.html | Practical lower-complexity flat reflective water plane with distortion controls. | Use a reflective-water mental model for the R3F water plane and global rising water overlay. | Existing Three.js dependency is sufficient; no new dependency is needed. | Use docs for conceptual guidance only. |
| Codrops, Water-like Distortion with Three.js | https://tympanus.net/codrops/2019/10/08/creating-a-water-like-distortion-effect-with-three-js/ | Lightweight mouse-ripple canvas used as a distortion source, without full fluid simulation. | Build a simple pointer-ripple layer and avoid physical simulation complexity. | This supports the hybrid approach: R3F background plus CSS/canvas-style interface layers. | Tutorial code is not copied; original React/CSS implementation only. |
| Awwwards, Gentlerain.ai Water Interaction WebGL | https://www.awwwards.com/inspiration/scroll-based-3d-video-gentlerain-ai | Premium product-film feeling, scroll-based 3D/video pacing, mobile/desktop variants. | Improve pacing and emotional progression from cinematic rain to clean decision grid. | Use as art-direction reference only. | Proprietary showcase; no assets, videos, or identity copied. |
| Awwwards, Nature Beyond Technology interactive particle effect | https://www.awwwards.com/inspiration/interactive-particle-effect-nature-beyond-technology | Particle-based interaction and WebGL motion language. | Make signal nodes feel alive and reactive rather than decorative. | Implement accessible HTML signal buttons over visual layers, with keyboard/focus parity. | Proprietary showcase; no assets or shaders copied. |
| WebFlood | https://github.com/aeplay/WebFlood | Browser-based shallow-water flood simulation, GPGPU/GLSL computation, public education framing. | Treat flood simulation as an educational visualization and future direction. | A real shallow-water solver is intentionally not implemented in this pass; it would be too heavy and would imply more physical validity than this demo supports. | MIT license, but no code copied. |
| Hydro3DJS | https://github.com/uihilab/Hydro3DJS | Hydrology-specific 3D web visualization: rainfall, flooding, infrastructure exposure, geospatial context. | Use a digital-twin-style signal grid and route-state overlays to connect water visuals to decisions. | Current app should remain a lightweight public experience, not a full GIS/digital twin. | MIT license, but no code copied. |
| Esri, FlowRenderer flood simulation article | https://www.esri.com/arcgis-blog/products/arcgis-online/3d-gis/arcgis-flowrenderer-flood-simulation-visualization | Communicates that animated water velocity/direction improves risk comprehension compared with static flood extents. | Use motion and route-state changes to show warning-time and action-time, not just inundation. | Avoid implying Hydra has an operational flood simulator; this remains educational and evidence-linked. | Blog and product content are proprietary; cite conceptually only. |

## Proposed Scene-by-Scene Redesign

1. Calm rain hero: strengthen visible rain, glass streaks, fog, bottom waterline, and pointer ripples while preserving readable hero copy and CTAs.
2. Signals appear inside the rain: add interactive signal nodes for rainfall rate, gauge rise, drainage stress, road access, forecast shift, terrain, sensor anomaly, and responder report. Nodes must work with hover, focus, tap, and keyboard.
3. Watch / Warning / Flash Flood Warning escalation: turn the education cards into a stage sequence with visual intensity bars, rising water cues, and preserved NWS source links.
4. Flooded-road decision: make the road crossing more memorable with stronger water obscuration, disappearing road lines, pointer ripples, and different educational outcomes for unsafe/safe decisions.
5. Interface floods: create a signature moment where the UI itself appears submerged by a scroll-linked waterline, dimming/refraction, floating cards, and a visible teaching-device disclaimer.
6. Hydra activates: shift from noisy storm visuals to a calm cyan decision grid, route states, lead-time markers, and connected signal nodes.
7. Hydra capabilities: make Sense, Predict, Alert, Coordinate, and Learn interactive capability nodes that highlight related signals.
8. Without / With Hydra comparison: replace the static comparison with an accessible slider showing water coverage, route visibility, alert timing, data clarity, and priority-zone organization.
9. Final CTA: preserve the evidence route links and explicitly connect the experience back to the manuscript/research dashboard.

## Technical Implementation Plan

- Keep the Next.js App Router route structure intact.
- Keep the page wrapper server-side and put interaction in client components.
- Dynamically import the R3F storm layer client-side to reduce SSR/WebGL risk.
- Add reusable components:
  - `RainGlassLayer`
  - `SignalParticlesLayer`
  - `InterfaceFloodMoment`
  - upgraded `FloodEducationCards`
  - upgraded `FloodRoadChoice`
  - upgraded `HydraActivationGrid`
  - upgraded `BeforeAfterHydra` with a range slider
- Add content types for signals and layer groups in `hydra-experience-content.ts`.
- Avoid new dependencies; use existing React, Framer Motion, Three.js/R3F, and CSS.

## Accessibility Plan

- Keep Skip Experience and Exit links to `/analysis`.
- Keep sound off by default.
- Respect `prefers-reduced-motion` and the explicit Motion control.
- Ensure signal nodes, Hydra capabilities, and the comparison slider are keyboard-accessible.
- Keep source links visible.
- Keep emergency safety disclaimers visible and avoid fake official alerts.
- Avoid flashing, gore, trauma imagery, or game-like framing.
- Provide non-WebGL and reduced-motion fallbacks.

## Performance and Fallback Plan

- Feature-detect WebGL and use CSS fallback if unavailable.
- Dynamically import the R3F background layer.
- Keep particle counts bounded, especially on mobile.
- Use CSS and lightweight React state for foreground glass/ripple effects.
- Throttle pointer ripple creation.
- Avoid new heavy assets, videos, or libraries.
- Do not implement a shallow-water physical model in this pass.

## Completed Implementation Summary

- Added `RainGlassLayer`, a deterministic rain-on-glass overlay with fog drift, rain streaks, and throttled pointer/touch ripples.
- Added `usePointerRipples` for shared ripple behavior in the glass layer and flooded-interface scene.
- Added `SignalParticlesLayer`, a keyboard-accessible signal map with layer toggles for rainfall, gauge, terrain, drainage, roads, forecast, sensors, and response.
- Expanded `hydra-experience-content.ts` with typed signal layers, signal nodes, the required safety disclaimer, and capability-to-layer mappings.
- Upgraded the Watch / Warning / Flash Flood Warning cards into an escalating visual sequence with storm-stage bars, rain, water, and preserved NWS source links.
- Upgraded the flooded-road decision with local water ripples, stronger water obscuration, disappearing road markings, route-state labels, and outcome-specific safety copy.
- Replaced the old warning-gap mockup with `InterfaceFloodMoment`, where the interface itself is partially submerged by a scroll-linked water layer while keeping the teaching-device disclaimer visible.
- Upgraded `HydraActivationGrid` so Sense, Predict, Alert, Coordinate, and Learn are interactive capability nodes that highlight related signal layers in a calm decision grid.
- Replaced the static before/after comparison with an accessible range slider that visually shifts water coverage, route clarity, data organization, and lead-time framing.
- Dynamically imported the R3F storm layer and added WebGL feature detection so the experience falls back to the CSS storm background when WebGL is unavailable.
- Connected the opt-in audio tone to scroll progress so flood intensity lowers/muffles the tone and Hydra activation brightens it. Sound remains off by default.
- Added an explicit `hydra-reduced-motion` root class so the in-app Motion control disables major CSS and Framer/R3F motion beyond browser-level `prefers-reduced-motion`.

Validation after implementation:

- `npm run lint`: passed with four pre-existing unused-variable warnings in untouched dashboard components.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm run build`: passed.
- Production route checks returned 200 for `/`, `/analysis`, `/era5`, `/experiments`, `/model`, and `/manuscript`.
- Desktop screenshots were captured for landing, signal/education, flooded-road, warning-gap, Hydra activation, and final comparison scenes under `output/playwright/`.
- Mobile screenshots were captured for landing, warning-gap, and final comparison scenes under `output/playwright/`.
- A headless Playwright browser script captured no console/page errors while checking Begin Experience, flooded-road decisions, keyboard operation of the comparison slider, Motion toggle, and Sound opt-in.
- Claim checks found no new unsupported language about replacing official warnings, guaranteeing safety, preventing floods, beating persistence, causal feature importance, or ignoring official guidance.

Known limitations:

- No external code, shaders, textures, videos, or proprietary assets were copied from the reference projects.
- The implementation is a hybrid R3F/CSS experience, not a physical flood simulator.
- Automated console-log capture is not yet part of the repository test harness; a one-off headless Playwright script was used for this implementation pass.
- The WebGL fallback is implemented through feature detection and static CSS fallback, but a dedicated automated no-WebGL browser run was not added.

## Next Iteration: Cinematic Upgrade

Implemented: 2026-06-30

This pass upgraded the latest Hydra Experience from a strong public narrative into a more explicitly cinematic flood-risk environment while preserving the same scientific and safety guardrails.

Recommendations addressed:

- Make the first viewport read as an environment, not only a dark page: added a hero-level low-water crossing, underpass/bridge silhouette, obscured lane line, headlight glow, water-depth marker, waterline, and scene-cue labels behind the opening copy.
- Replace single global scroll progress with scene-local state: added `useCinematicSceneController` to track hero, signal, road, warning-gap, activation, and final scene progress, then used those values to drive storm intensity, water pressure, signal visibility, fog, and Hydra clarity.
- Make water more physical: added `WaterInteractionLayer`, a lightweight canvas overlay with pointer/touch ripples, scroll-linked water surface, shimmer lines, and a reduced-motion static fallback.
- Make Hydra activation feel like intervention: upgraded the R3F scene so rain slows, water recedes/translucifies, sensor nodes converge toward the grid, and lead-time rings appear as Hydra clarity rises.
- Improve interaction affordances: added signal prompts, active-layer counts, labels on active signal nodes, road-depth ambiguity markers, lead-time marker sequencing, a "focus a capability" prompt, and an evidence bridge before the final research links.
- Remove unsupported quantitative slider wording: changed the final comparison readout from a pseudo-quantitative clarity percentage to a visual split between the warning gap and Hydra view.

Implementation details:

- `dashboard/src/components/hydra-experience/HydraExperienceScene.tsx` now wires scene refs into the local scene controller and includes the hero environmental overlay.
- `dashboard/src/components/hydra-experience/RainField.tsx` now accepts explicit storm, water, and Hydra clarity values and renders crossing geometry, road markings, bridge/underpass structure, headlight reflections, moving rain, signal convergence, atmospheric grid, and lead-time rings.
- `dashboard/src/components/hydra-experience/RainGlassLayer.tsx` and `RisingWaterLayer.tsx` now respond to scene-state values instead of a single page-level progress number.
- `dashboard/src/components/hydra-experience/SignalParticlesLayer.tsx`, `HydraActivationGrid.tsx`, `FloodRoadChoice.tsx`, and `BeforeAfterHydra.tsx` received interaction and readability upgrades.
- `dashboard/src/lib/hydra-experience-content.ts` keeps the new cinematic scene cues, lead-time markers, and evidence-bridge copy auditable alongside the NWS and Ready.gov source links.

Validation after this iteration:

- `npm run lint`: passed with four pre-existing unused-variable warnings in untouched dashboard components.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm run build`: passed.
- Production route checks returned 200 for `/`, `/analysis`, `/era5`, `/experiments`, `/model`, and `/manuscript`.
- Headless Playwright validation passed for landing load, Begin Experience anchor scroll, signal node/layer interaction, flooded-road safe/unsafe outcomes, Hydra capability interaction, comparison-slider keyboard operation, opt-in sound, reduced-motion audio stop, Skip Experience navigation, and no captured console/page errors.
- Canvas-pixel validation passed on the hero WebGL layer. Final run stats: `samples=16037`, `nonDark=12163`, `bright=590`.
- Desktop screenshots were captured for hero, signal, road, warning-gap, Hydra activation, and final evidence bridge.
- Mobile screenshots were captured for hero, signal, road, warning-gap, Hydra activation, and final evidence bridge.
- Screenshot directory: `output/playwright/hydra-cinematic-20260630/`.
- Public-claim search found only negative guardrail language such as "does not issue official warnings" and "does not prove"; no affirmative unsupported claims were added.

Limitations and source/licensing notes:

- No proprietary videos, shaders, map tiles, textures, third-party demo source, or reference-site assets were introduced.
- The flood visuals remain an educational interface treatment, not a physically valid flood simulation or operational hazard display.
- Sound remains a minimal procedural Web Audio tone, not a full ambient soundtrack. It is off by default and stops when reduced motion is enabled.
- The automated browser script remains a one-off validation command rather than a committed Playwright test suite.

## Premium Cinematic Upgrade

Implemented: 2026-06-30

This pass converted the latest Hydra Experience into a more unified storm simulation. The low-water crossing now acts as the hero object, warning stages drive the whole environment, signal controls affect visible layers, the interface flood moment is more physical, Hydra activation interrupts the flood, and the final section reads as leaving the simulation for the evidence chain.

Implementation details:

- Added a single cinematic state model through `useCinematicSceneController`: `warningStage`, `rainIntensity`, `waterline`, `uiSubmersion`, `activeSignalLayers`, `hydraIntervention`, `audioMood`, and `exitTransition`.
- Connected Flood Watch, Flood Warning, and Flash Flood Warning cards to environment state so selecting or focusing them changes rain density, waterline, fog, color pressure, and audio mood.
- Made rain-to-data interaction concrete by lifting signal-layer state into `HydraExperienceScene` and passing active layers to the R3F storm scene, signal map, and Hydra decision grid.
- Reworked signal controls from generic pills into map-like layer toggles with swatches, active counts, rainfall streaks, gauge marker, terrain contours, drainage paths, forecast cone, roads overlay, sensor cue, and response tag.
- Strengthened the flooded-interface sequence with a higher water mask, submerged text blur/refraction, floating drift, route/data meters, and a reduced-motion static fallback.
- Expanded procedural Web Audio from a single tone into opt-in rain noise, warning pulse, low-pass underwater muffling, distant thunder, and a calmer Hydra activation tone. Audio remains off by default and is stopped when reduced motion is selected.
- Moved Skip, Motion, Sound, and Exit into a compact cinematic tray with accessible labels and mobile-specific shorter visual labels.
- Hid the decorative hero tagline on mobile so the fixed tray does not cover intentional content.
- Added an ordered cause-effect path in Hydra activation: rain -> gauge -> terrain/drainage -> road risk -> action.
- Preserved existing research routes and the final links to Findings, ERA5 Evidence, Experiments, Model, and Manuscript.

Validation after this premium pass:

- `npm run lint`: passed with four pre-existing unused-variable warnings in untouched dashboard components.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passed.
- `npm run build`: passed.
- Production route checks returned 200 for `/`, `/analysis`, `/era5`, `/experiments`, `/model`, and `/manuscript`.
- Full headless browser validation passed for landing load, nonblank canvas render, Begin Experience scroll, warning-stage selection, signal-layer toggles, road decision status, Hydra capability focus, comparison-slider keyboard operation, opt-in sound, reduced-motion audio stop, and no captured console/page errors.
- Focused final browser validation passed after the mobile tray fix.
- Canvas-pixel validation passed on the hero WebGL layer. Final run stats: `samples=56448`, `nonDark=28946`, `bright=1559`.
- Desktop and mobile screenshots were captured under `output/playwright/hydra-premium-20260630/`.

Guardrails:

- Safety copy remains sourced to NWS flood watch/warning guidance, NWS Turn Around Don't Drown guidance, and Ready.gov floods guidance through `hydra-experience-content.ts`.
- The page continues to state that Hydra is educational decision support and does not issue official warnings or guarantee safety.
- No language was added claiming Hydra prevents floods, replaces official authorities, beats persistence, proves causal feature effects, or acts as an operational alerting product.
- No external code, shaders, videos, map tiles, textures, or proprietary reference assets were introduced.

## Future Enhancements

- Optional shader-based water distortion after profiling.
- Actual hydrologic map overlays if backed by data and clear disclaimers.
- Route-specific narrative variants tied to manuscript study sites.
- More robust automated browser interaction tests once the dashboard adopts a formal Playwright test harness.
