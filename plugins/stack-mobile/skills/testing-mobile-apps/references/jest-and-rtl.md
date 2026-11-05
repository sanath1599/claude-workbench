# Jest and React Native Testing Library

Docs: https://docs.expo.dev/develop/unit-testing/ , https://callstack.github.io/react-native-testing-library/

## Setup file

```ts
// jest.setup.ts  (jest.setupFilesAfterEnv in package.json)
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn() }));
```

## Test wrapper

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";

export async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
```

## Screen test: states

```tsx
test("shows an error state with retry", async () => {
  server.use(http.get("*/items", () => HttpResponse.json({}, { status: 500 })));
  const screen = await renderWithClient(<ItemsScreen />);
  expect(await screen.findByText(/could not load items/i)).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: /try again/i })).toBeOnTheScreen();
});
```

Write one test each for loading, empty, error and populated. With the RNTL version in use, check whether `userEvent` calls are async and `await` them.

## Expo Router screens

Use the testing helpers from `expo-router/testing-library` (`renderRouter`) with a virtual file tree to test navigation, redirects and params without a device.

## What not to unit test

Layout pixels, third-party library behaviour, and native module internals. Cover those with a Maestro flow or a manual checklist.
