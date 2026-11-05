---
type: llm
weight: 3
---

Pass if the response chooses Expo with Expo Router and TypeScript (not a bare React Native CLI project), plans a development build rather than relying on Expo Go, uses TanStack Query with a persisted cache for offline, and says secrets must not go in EXPO_PUBLIC variables. Notifications should go through expo-notifications with server-side sending from FastAPI. Fail if it recommends a plain React Native CLI app, Flutter, or putting API secrets in the app bundle.
