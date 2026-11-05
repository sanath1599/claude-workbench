---
name: adding-motion-and-3d
description: Use when adding animation, scroll effects, page transitions, Lottie or Rive illustration, or WebGL/3D to a page or app, or when picking an animation library. Triggers on "animate", "scroll storytelling", "parallax", "3D hero", "page transition", "make it feel alive". Not for static visual taste (designing-without-ai-slop) or proving the result works (verifying-ui-in-browser).
---

# Adding motion and 3D

Motion is a cost the page pays on every load, on every low-end phone, and for every person who asked their device for less movement. Add it only where it explains something, then pick the lightest tool that does the job.

## When to use

- Any request to animate, reveal, transition, parallax, or add a 3D or illustrated moving element.
- Choosing between Motion, GSAP, Lottie, Rive, three.js and plain CSS.
- A landing page where the owner wants one memorable animated moment.

## When not to use

- Deciding colours, fonts or layout: `design-studio:choosing-type-and-color`, `design-studio:designing-without-ai-slop`.
- Checking the result at four widths with a clean console: `design-studio:verifying-ui-in-browser`.
- An interactive demo deck: `design-studio:presenting-guided-demos`.

## Procedure

1. **Decide whether motion earns its place.** Answer in one line each: what does this movement tell the person (a thing appeared, moved, changed state, or is loading), and what breaks if it is removed? If nothing breaks and nothing is explained, drop it. Keep at most one non-user-triggered moment per page (one load sequence or one scroll story); responses to clicks and hovers are fine and cheap.
   **Done when:** each animation on the list has a stated purpose, or is cut.
2. **Pick the tool from the job** (details in `references/library-table.md`).

   | Job | Use |
   | --- | --- |
   | Hover, focus, fade, small state changes, accordions | CSS transitions and `@starting-style` |
   | Route or view changes | View Transitions API through the router; fall back to CSS fade |
   | Scroll-linked progress, simple reveals | CSS `animation-timeline: view()` or `scroll()`, with an IntersectionObserver fallback |
   | React component enter, exit, layout, gestures, springs | Motion (`motion/react`) |
   | Multi-step scroll storytelling, pinning, timelines, SVG morphing | GSAP with ScrollTrigger and `useGSAP` |
   | Smooth scrolling | Lenis, only if the owner wants it, never hijacking native scroll on touch |
   | Small looping illustration from After Effects | Lottie via dotLottie |
   | Interactive illustration with states (hover, press, data-driven) | Rive |
   | Real 3D with a camera, lighting, models | three.js through React Three Fiber, lazy-loaded |
   | Product viewer for one model, no custom code | `<model-viewer>` web component |
   | 3D authored by a non-coder in a visual editor | Spline, exported to video or glTF where possible |
   | Large 2D scene or particle field | PixiJS |

   Do not mix two libraries to animate the same element. One owner per property.
   **Done when:** every animation maps to exactly one row, and the number of animation libraries in `package.json` is the smallest that covers the rows used.
3. **Set the budget before writing code.**
   - Animate only `transform` and `opacity` (plus `filter` sparingly). Never animate width, height, top or left.
   - Animation JavaScript on a marketing page: aim for 50 kB gzipped or less in the initial bundle; everything heavier loads after first paint or on intersection.
   - 3D: lazy-load the canvas, show a static poster until it is ready, and render on demand (`frameloop="demand"`) unless something moves continuously. Hold draw calls under 100, triangles under 100k on phones, and compress models (Draco or Meshopt) and textures (KTX2). `references/3d-asset-pipeline.md` has the export checklist.
   - Lottie files under 100 kB; Rive files under 200 kB. Larger means simplify the source.
   - Measure: run the production build, open the bundle visualizer, and take a Performance trace on a throttled CPU.
   **Done when:** you have written the budget numbers in the PR description or design notes.
4. **Respect `prefers-reduced-motion` from the start.** Reduced motion means no parallax, no autoplay loops, no scroll-jacking, and replacing slides with fades. Essential state changes still show, only gentler. Use `MotionConfig reducedMotion="user"` for Motion, `gsap.matchMedia()` for GSAP, a media query in CSS, and a static poster for Lottie, Rive and 3D. Provide a visible pause control for anything that loops longer than five seconds.
   **Done when:** with the OS setting on, the page has no continuous movement and nothing is hidden by a missing animation.
5. **Build with the lifecycle in mind.** In React, create animations inside `useGSAP` or Motion components so cleanup runs; kill ScrollTriggers on unmount; dispose of three.js geometries, materials and textures; destroy Lottie and Rive instances. Never call `setState` per frame; write to refs or motion values.
6. **Handle server rendering and bundling.** On Vite single-page apps there is no SSR concern. With TanStack Start or any SSR, render WebGL, Lottie, Rive and GSAP-dependent code client-only (lazy import behind a mount check) and render the static poster on the server. Import Motion as `motion/react`, use `LazyMotion` with `domAnimation` and the `m` component where bundle size matters, and import GSAP plugins by name (`gsap/ScrollTrigger`) and register once.
7. **Test it.** Unit tests do not execute animation; do not mock your way to a green tick. Instead: run `design-studio:verifying-ui-in-browser`; emulate reduced motion in Playwright (`page.emulateMedia({ reducedMotion: 'reduce' })`) and assert nothing keeps moving; in Playwright disable animation for visual snapshots (`animations: 'disabled'`); check the console for WebGL context warnings; trace CPU on a throttled profile.
   **Done when:** the reduced-motion run and the normal run both pass, and the trace shows no long tasks during the animation.

## Quick reference

| Situation | Decision |
| --- | --- |
| Owner says "animated landing page" | One hero moment plus quiet CSS reveals; not a reveal on every section |
| Needs a 3D logo or product | `<model-viewer>` first; R3F if it must react to scroll or pointer |
| Illustration with hover states | Rive |
| Designer hands over After Effects | Lottie, dotLottie format |
| Page transition in the TanStack Router app | View Transitions API |
| Count-up, marquee, bento hover from a copy-paste kit | Rebuild in your own tokens; do not paste the kit's look |
| Needs physics-like springs on UI | Motion `type: "spring"` |

## Rationalizations

| Excuse | Instead |
| --- | --- |
| "Every section should fade in on scroll" | That is the generated default. Animate the one thing that matters. |
| "GSAP is more powerful, use it everywhere" | Use it where timelines or pinning are needed. Motion or CSS elsewhere. |
| "Reduced motion can come later" | It changes the structure; build it in at step 4. |
| "3D makes it premium" | A heavy canvas on a phone makes it slow. Ship a poster and lazy-load. |
| "I will add Lenis, it feels nice" | Smooth scroll breaks anchors, find-in-page and accessibility; only on request. |

## Verification

- [ ] Each animation has a stated purpose and one owner library.
- [ ] Only transform and opacity animate; no layout thrash.
- [ ] Reduced-motion run passes; looping media can be paused.
- [ ] Heavy libraries are lazy-loaded; a static poster exists for WebGL, Lottie and Rive.
- [ ] Cleanup on unmount confirmed; no console warnings.
- [ ] Budget numbers recorded and the production bundle checked.

## References

| File | Load when |
| --- | --- |
| references/library-table.md | choosing a library, checking licence, install names or status |
| references/recipes.md | writing Motion, GSAP, R3F or reduced-motion code |
| references/3d-asset-pipeline.md | exporting or compressing a 3D model or textures |

## Versions

- motion 14.9.1 (verified 2026-11-05, https://www.npmjs.com/package/motion)
- gsap 3.15.1 (verified 2026-11-05, https://www.npmjs.com/package/gsap), free under GSAP's standard no-charge licence
- @gsap/react 2.1.2 (verified 2026-11-05, https://www.npmjs.com/package/@gsap/react)
- lenis 1.3.27 (verified 2026-11-05, https://www.npmjs.com/package/lenis)
- three 0.187.0 (verified 2026-11-05, https://www.npmjs.com/package/three)
- @react-three/fiber 9.8.2 (verified 2026-11-05, https://www.npmjs.com/package/@react-three/fiber)
- @react-three/drei 10.7.9 (verified 2026-11-05, https://www.npmjs.com/package/@react-three/drei)
- @lottiefiles/dotlottie-react 0.21.1 (verified 2026-11-05, https://www.npmjs.com/package/@lottiefiles/dotlottie-react)
- @rive-app/react-webgl2 4.38.1 (verified 2026-11-05, https://www.npmjs.com/package/@rive-app/react-webgl2)
- pixi.js 8.22.0 (verified 2026-11-05, https://www.npmjs.com/package/pixi.js)
