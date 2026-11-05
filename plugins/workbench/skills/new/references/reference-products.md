# Reference products

The intake's `references` table lists products the owner likes: type (`url`, `app`, `package`, `binary`), the link or name, and what they like about it. Learn patterns only.

## Per reference
1. Use toolbelt:reverse-engineer-anything (the REA MCP server ships in the toolbelt plugin's `.mcp.json`).
   - Web product: REA's browser and web-bundle capture tools: screenshots, page structure, network shape.
   - Desktop or Electron app, package or binary: REA's artifact inspection.
2. Gather: layout patterns, information architecture, key flows, visual language (density, type feel, colour mood), feature list. Record evidence for each (a screenshot, a route, a string, a package export). Mark anything inferred as **inferred**.
3. Summarise as "borrow" and "avoid" bullets, a few lines per product.

## Rules
- Never copy a product's brand, logo, copy, assets or code. Describe the pattern ("master-detail with a pinned filter bar"), not the pixels.
- Public pages only. No logins, no bypassing access controls, no private data.
- Save screenshots under `docs/intake/references/` and findings in `docs/intake/references.md`: one section per product with the sections above and the date.

## Push for confirmation
Push a `choices` step with `multi: true`, one option per borrow idea (`id`, `name`, `reason`, `image` from `--asset` screenshots). The owner ticks what to borrow; the design directions and the sample build on the confirmed ones.

## If REA is unavailable
The MCP is not connected or the target cannot be reached: take a plain browser screenshot (design-studio:verifying-ui-in-browser, or the Chrome tools), describe what is visible, label everything as observed or inferred, and tell the owner REA was not used.
