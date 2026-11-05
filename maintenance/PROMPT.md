# Daily workbench maintenance (instructions for the CI Claude run)

You are maintaining this Claude Code plugin marketplace. A deterministic script already ran and wrote `maintenance/out/report.json` and `report.md`. Read both, then `docs/authoring.md`. Work only inside this repository. You run unattended; the owner reviews your PR later.

## Do, in this order

1. **Vulnerabilities first.** For each item in `majorVulns`, confirm it on osv.dev or the GitHub advisory. Then do two things: in every skill that documents the affected version, add a line saying which version fixes it, and recommend the fixed version in that skill's Versions block. In the PR description, list each one at the top.

2. **Package updates.** For each entry in `updates`:
   - Read the changelog or release notes between `from` and `to` (use the `changelog` URL, GitHub releases, or WebSearch). Use primary sources.
   - Pick out what matters to the owner's stack: breaking changes, deprecations of APIs our skills mention, security fixes, and new features worth adopting.
   - Update the skills listed in `skills`: the Versions line (`name x.y.z (verified YYYY-MM-DD, <url>)`), any instruction an API change invalidates, and short notes on worthwhile new features where they belong.
   - Update `documented` in the matching `maintenance/tracked-packages.d/*.json` entry. For a version pinned in a `.mcp.json` or an assets template, bump that pin too.
   - Record it in `docs/upgrade-notes/<date>.md` as a table of package, from, to, notable changes, what we changed, and what we deliberately did not adopt and why.

3. **Claude Code release** (when `claudeCode.changed` is true): read the Claude Code changelog for the versions since `lastSeen`. Adopt any changes to plugins, skills frontmatter, hooks, MCP, evals or cloud sessions that affect this repo (for example new frontmatter fields, deprecations, new hook events). Note them in the upgrade notes.

4. **Broken links.** Find the new location of each moved page and fix it. If a page is gone, remove the link and keep the instruction if it is still true.

5. **MCP endpoints marked DOWN.** Check the vendor's docs for a new URL. Update the `.mcp.json` and the connector README, or flag it in the PR if there is no replacement.

6. **Stale verification dates.** Re-verify up to 10 of the oldest facts against current docs. Only change a date after you have re-checked the fact.

7. **Learnings inbox.** If `docs/learnings.d/` has files, fold their entries into `docs/learnings.md` (newest first) and delete the inbox files.

## Rules
- Follow `docs/authoring.md`. Integrate changes where they belong; never append dumps.
- Never touch secrets, `.github/workflows/*` permissions, or the hook scripts' safety rules.
- Run `npm test` and `claude plugin validate plugins/<plugin> --strict` for every plugin you changed. If either fails, fix it or revert your change.
- Bump each changed plugin's version: `node scripts/bump-version.mjs <plugin> patch` (minor if you added a skill).
- Commit to the current branch with clear messages. Don't merge or push to main. Don't open more than one PR.
- If nothing needs changing, say so and stop without committing.

## Final message
Five lines at most:
- vulnerabilities, if any;
- packages updated;
- notable features worth adopting in the owner's apps;
- links and endpoints fixed;
- anything that needs the owner.
