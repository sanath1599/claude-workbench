# Setup snippets

Snippets show shape, not exact APIs. Confirm against https://tanstack.com/router/latest/docs/framework/react/quick-start before pasting; names such as `getRouter` versus `createRouter` differ between SPA and Start.

## vite.config.ts (SPA)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Order matters: router plugin first.
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
});
```

Defaults: routes in `src/routes`, generated tree at `src/routeTree.gen.ts`, files prefixed `-` are ignored by the router.

## Router with QueryClient context

```ts
// src/router.tsx
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function makeRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: "intent" });
}
declare module "@tanstack/react-router" {
  interface Register { router: ReturnType<typeof makeRouter> }
}
```

```tsx
// src/routes/__root.tsx
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sileo";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

`main.tsx` renders `<QueryClientProvider client={router.options.context.queryClient}><RouterProvider router={router} /></QueryClientProvider>`. Add `<ReactQueryDevtools initialIsOpen={false} />` inside the provider. Check the sileo README for the Toaster props of the installed version.

## Loader + Query + typed search

```tsx
// src/routes/tasks.tsx
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const search = z.object({
  q: z.string().catch(""),
  page: z.number().int().min(1).catch(1),
});

export const tasksQuery = (s: z.infer<typeof search>) =>
  queryOptions({
    queryKey: ["tasks", s],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?q=${encodeURIComponent(s.q)}&page=${s.page}`);
      if (!r.ok) throw new Error(`tasks ${r.status}`);
      return (await r.json()) as { id: string; title: string }[];
    },
  });

export const Route = createFileRoute("/tasks")({
  validateSearch: search,
  loaderDeps: ({ search: s }) => s,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(tasksQuery(deps)),
  pendingComponent: () => <p>Loading</p>,
  component: Tasks,
});

function Tasks() {
  const s = Route.useSearch();
  const { data } = useSuspenseQuery(tasksQuery(s));
  return data.length ? <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul> : <p>No tasks yet.</p>;
}
```

## Form (TanStack Form + Zod)

```tsx
import { useForm } from "@tanstack/react-form";
import { sileo } from "sileo";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1, "Required") });

export function NewTask({ onCreate }: { onCreate: (v: z.infer<typeof schema>) => Promise<void> }) {
  const form = useForm({
    defaultValues: { title: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      await sileo.promise(onCreate(value), {
        loading: { title: "Saving" },
        success: { title: "Saved" },
        error: { title: "Could not save" },
      });
    },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(); }}>
      <form.Field name="title">
        {(f) => <input value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />}
      </form.Field>
    </form>
  );
}
```

## Table (v9)

Table v9 changed its setup from v8. Read https://tanstack.com/table/latest/docs/overview and its migration guide before writing the hook call; do not paste v8 code. Keep column definitions at module scope, memoise data, and show an empty state when `rows.length === 0`.

## Tokens (src/styles/tokens.css)

```css
:root { --bg: #ffffff; --fg: #111418; --muted: #5b6573; --accent: #2457ff; --radius: 10px; --space: 8px; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e1116; --fg: #e8ebf0; --muted: #9aa4b2; } }
body { background: var(--bg); color: var(--fg); }
```

Light is the default look; the dark block is an override. Components read variables only, never raw hex.

## Test setup

```ts
// vitest.config.ts: reuse vite.config, add test: { environment: "jsdom", setupFiles: "./src/test-setup.ts" }
// playwright.config.ts: webServer: { command: "npm run dev", url: "http://localhost:5173" }; route the API with page.route().
```
