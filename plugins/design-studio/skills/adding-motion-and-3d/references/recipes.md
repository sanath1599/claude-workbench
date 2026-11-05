# Recipes

Short patterns in TypeScript. Check each library's current docs for API changes.

## Motion: reduced motion for the whole app, small bundle

```tsx
import { LazyMotion, domAnimation, MotionConfig, m, AnimatePresence } from 'motion/react'

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
    </MotionConfig>
  )
}

export function Panel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}
```

`strict` makes the build fail if a plain `motion.div` slips in and defeats the lazy features.

## GSAP: scroll story with cleanup and reduced motion

```tsx
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export function Story() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ scrollTrigger: { trigger: '.story', start: 'top top', end: '+=150%', scrub: true, pin: true } })
        .from('.step-1', { autoAlpha: 0, y: 24 })
        .to('.step-1', { autoAlpha: 0 }, '+=0.5')
        .from('.step-2', { autoAlpha: 0, y: 24 })
    })
    return () => mm.revert()
  }, { scope: root })
  return <div ref={root}><section className="story">{/* steps */}</section></div>
}
```

With reduced motion the steps stay in normal flow, so write the markup to read correctly without the timeline.

## CSS only: reveal without a library

```css
.reveal { opacity: 0; translate: 0 12px; transition: opacity var(--duration-base) var(--ease-out), translate var(--duration-base) var(--ease-out); }
.reveal.is-visible { opacity: 1; translate: 0 0; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; translate: none; transition: none; } }
@supports (animation-timeline: view()) {
  .reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; opacity: 1; translate: none; }
  @keyframes rise { from { opacity: 0; translate: 0 12px; } to { opacity: 1; translate: 0 0; } }
}
```

Add one IntersectionObserver that sets `is-visible` for browsers without `animation-timeline`.

## R3F: lazy, on demand, with a poster

```tsx
import { lazy, Suspense, useEffect, useState } from 'react'
const Scene = lazy(() => import('./Scene'))

export function Hero3D() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="hero-3d" role="img" aria-label="Product model">
      <img src="/hero-poster.webp" alt="" width={1200} height={800} />
      {mounted && !reduce && <Suspense fallback={null}><Scene /></Suspense>}
    </div>
  )
}
// Scene.tsx: <Canvas frameloop="demand" dpr={[1, 2]}> ... call invalidate() when something changes
```

Mutate objects through refs inside `useFrame`; never call `setState` there.

## Lottie and Rive

```tsx
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
<DotLottieReact src="/empty-state.lottie" loop autoplay={!reduce} />
```

Rive: `useRive({ src, stateMachines: 'Main', autoplay: true })`, then read inputs with `useStateMachineInput(rive, 'Main', 'hover')`. A null input means the name does not match the editor.
