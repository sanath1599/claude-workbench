# Embedding generated markup safely

When a model writes screens that you assemble into one page:

1. Strip comments.
2. Prefix every CSS selector with a per-screen scope class. Map `:root`, `html` and `body` to the scope itself. Recurse into `@media`, `@supports`, `@container` and `@layer`. Copy `@keyframes` and `@font-face` unscoped. Drop other at-rules such as `@import`.
3. Put state hooks (`[data-step="1"] .x`, `[data-mode=play] .x`) on the scope element.
4. Remove `<script>`, `on*=` handlers, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>` and any external `src` or `href`.
5. Do not inline model JavaScript as markup. Wrap it as the body of `function(root, api){ "use strict"; ... }` and give it only a small `api` (`onStep`, `mode`, `toast`).

Serving such a page on a live site is a separate risk: see the generated-HTML section in `engineering-craft:reviewing-security`.
