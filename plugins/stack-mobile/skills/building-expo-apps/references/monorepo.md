# Monorepo with a web app

Docs: https://docs.expo.dev/guides/monorepos/

```
repo/
  apps/mobile/     Expo app
  apps/web/        Vite + TanStack app (stack-web:building-tanstack-frontends)
  packages/api/    typed client, Zod schemas, query keys
  packages/core/   pure logic: formatting, validation, money, dates
  package.json     workspaces: ["apps/*", "packages/*"]
```

Rules:

- Shared packages are plain TypeScript with no `react-dom`, no `react-native`, no platform APIs. Anything platform-specific stays in the app.
- Do not share UI components between web and native by default. Share tokens (as data), schemas and logic. Each platform renders its own components so each follows its own conventions.
- Export source TypeScript from packages (`"main": "src/index.ts"`) and let each app's bundler compile it. Metro watches workspace folders automatically in current SDKs; check the guide if it does not resolve a package.
- One version of `react` and `react-native` per workspace. Install with the root package manager (`{{wb.package_manager}}`) and run `npx expo install --check` inside `apps/mobile`.
- Mobile-only secrets and EAS config live in `apps/mobile`. Run EAS commands from that directory.
- CI: build only what changed (`apps/mobile/**` or `packages/**` for mobile).
