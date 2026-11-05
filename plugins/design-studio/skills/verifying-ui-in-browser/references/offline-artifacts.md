# Verifying a generated offline page

- Block every request except `file:`, `data:`, `blob:` and `about:` through request interception, and record each blocked URL as a finding.
- Emulate `prefers-reduced-motion: reduce` and the `prefers-color-scheme` the page ships in, so screenshots are stable.
- Navigate with a hash per view, wait for a page-set ready flag (`window.__x.ready === true`), then settle about 450 ms.
- Collect `console` errors, `pageerror`, horizontal overflow (`scrollWidth > innerWidth`), clipped text (`scrollWidth > clientWidth` where `overflow-x` is hidden and there is no ellipsis), and elements outside the stage rectangle.
- Check desktop (1280x720) for every slide and step, plus a few phone-width (390x844) samples. Save JPEG screenshots at modest quality and look at them.
- Run at most about ten views per call, with a time budget. Report unchecked views as `not run`, never as passed.
- Run the browser in a throwaway container with no network when the page came from a model.
