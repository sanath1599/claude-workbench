# From approved mockup to clickable prototype

Use after the HTML mockup is approved and before any backend exists. The prototype stays believable and later swaps its mocks for real services behind the same interfaces.

1. **One typed fictional dataset.** Ids cross-reference (an employee id appears in leave, payroll and reviews). No sensitive personal fields in lists. Invented names, `example.com`.
2. **One persisted store.** Every mutation is an action on a single store persisted to `localStorage`, with a visible "Reset demo data" control.
3. **Fixed "today".** A `DEMO_TODAY` constant drives every date calculation; never `new Date()`, or the demo rots.
4. **Role switcher.** One permission map (`can(role, action)`) hides or disables what a role cannot do; ordinary users see only their own data. Test each role.
5. **Mock services behind real interfaces.** AI and integration features live in `services/`, follow a transparent documented rule set, and carry a visible "Demo data" label on charts.
6. **Interactions are real.** Every prominent button changes state, opens a dialog or shows a toast whose wording matches the button; consequential actions ask for confirmation.
7. **Same libraries as the mockup.** Toasts, icons and components match the approved mockup and the owner's rules (`workbench:using-sileo-toasts`). Convention docs are copied literally by every agent, so a wrong library named there spreads to every file.
8. **Parallel building.** Freeze the foundation first (types, store, primitives, layout, permissions) and follow `workbench:delegating-to-subagents` for file scope and screenshot evidence.

**Done when:** each role can complete its main journey, reset restores the seed, and `design-studio:verifying-ui-in-browser` is clean at four widths for each role.
