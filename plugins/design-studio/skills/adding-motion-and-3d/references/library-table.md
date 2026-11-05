# Library table

Versions verified 2026-11-05 on npm. Read the library's current docs before using an API; this table is a router, not a manual.

| Library | npm package | Version | Licence | Use it for | Gotchas |
| --- | --- | --- | --- | --- | --- |
| CSS transitions, `@starting-style`, scroll-driven animation | none | n/a | n/a | Hover, focus, enter/exit of simple elements, scroll-linked reveals | `animation-timeline` is not in every browser; keep an IntersectionObserver fallback |
| View Transitions API | none | n/a | n/a | Route and view changes | Wrap `document.startViewTransition` behind feature detection |
| Motion (formerly Framer Motion) | `motion` | 14.9.1 | MIT | React enter/exit, layout animation, gestures, springs, scroll values | Import from `motion/react`; exits need `AnimatePresence`; use `LazyMotion` and `m` to cut size |
| GSAP + ScrollTrigger | `gsap`, `@gsap/react` | 3.15.1, 2.1.2 | GSAP standard no-charge licence (not OSI open source) | Timelines, pinning, scrubbed scroll stories, SVG work | Register plugins once; use `useGSAP` for cleanup; two tweens on one property conflict |
| Lenis | `lenis` | 1.3.27 | MIT | Smooth scrolling on request | Breaks anchors and find-in-page if misused; skip on touch |
| Lottie (dotLottie) | `@lottiefiles/dotlottie-react` | 0.21.1 | MIT | Small looping illustrations from After Effects | Heavy JSON files; load lazily; destroy on unmount; provide poster |
| Rive | `@rive-app/react-webgl2` (or `react-canvas`) | 4.38.1 | MIT | Interactive illustration with state machines | Input names must match the editor exactly; one WASM runtime per page |
| three.js | `three` | 0.187.0 | MIT | Real 3D, custom shaders | Dispose resources; match package and `@types/three` versions |
| React Three Fiber + drei | `@react-three/fiber`, `@react-three/drei` | 9.8.2, 10.7.9 | MIT | three.js inside React with helpers | v9 pairs with React 19; never `setState` in `useFrame`; client-only under SSR |
| model-viewer | `@google/model-viewer` | 4.4.0 | Apache-2.0 | One 3D model with orbit and AR | Poster image and `loading="lazy"` |
| PixiJS | `pixi.js` | 8.22.0 | MIT | Heavy 2D scenes, particles, games | Overkill for UI; WebGL context limits |
| React Spring | `@react-spring/web` | 10.1.2 | MIT | Spring physics | Overlaps Motion; do not use both |
| Anime.js | `animejs` | 4.5.0 | MIT | Small framework-free timelines | Overlaps GSAP and Motion |
| Barba.js | `@barba/core` | 2.10.3 | MIT | Page transitions on multi-page sites | Not for React routers; use View Transitions |
| Locomotive Scroll | `locomotive-scroll` | 5.0.1 | MIT | Scroll-linked effects with its own scroller | Scroll hijack tendencies; prefer Lenis plus ScrollTrigger |
| AOS and similar reveal libraries | `aos` | 2.3.4 | MIT | Attribute-driven reveals | Replace with CSS or Motion `whileInView` |
| Spline runtime | `@splinetool/react-spline` | 4.1.0 | no licence field on npm; check the vendor terms | Scenes authored visually | Large runtime and scene files; export to video or glTF when interaction is not needed |
| Babylon.js | `@babylonjs/core` | 9.33.3 | Apache-2.0 | Full game-style engine, physics, XR | Large; only when three.js is not enough |
| PlayCanvas | `playcanvas` | 2.23.3 | MIT | Engine with a hosted editor | Team workflow tool, rarely right for a marketing page |
| A-Frame | `aframe` | 1.8.0 | MIT | Declarative WebXR | Only for XR experiences |
| Zdog, Vanta.js, Vanilla-Tilt | `zdog`, `vanta`, `vanilla-tilt` | skip | MIT | Decorative pseudo-3D, animated backgrounds, card tilt | Read as templated; use CSS transforms if a tilt is truly needed |
| Magic UI, React Bits | copy-paste components | n/a | MIT | Idea source for effects | Pasting them wholesale gives the generated look; rebuild in project tokens |

## Choosing between near neighbours

- Motion or GSAP: Motion when the animation is driven by React state; GSAP when you need a timeline scrubbed by scroll or pinned sections. Do not drive the same element with both.
- Lottie or Rive: Lottie plays a fixed clip; Rive reacts to input. If the designer exports from After Effects, Lottie; if there are hover and press states, Rive.
- three.js or Spline: Spline is quickest for a non-coder, but ships a heavy runtime. For a branded hero that must stay fast, export a short video or glTF and use three.js or `<model-viewer>`.
- R3F or plain three.js: R3F when the app is React; plain three.js for a standalone canvas inside a non-React page.
