#!/usr/bin/env bash
# Switch Claude Code from the third-party plugins to this marketplace.
#   bash scripts/migrate-from-third-party.sh          # dry run: prints what it would do
#   bash scripts/migrate-from-third-party.sh --apply  # does it
# Safe to re-run. Reinstall anything later with: claude plugin install <name>@<marketplace>
set -u
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
run() { if [ $APPLY = 1 ]; then echo "+ $*"; "$@" || echo "  (failed or already done: $*)"; else echo "would run: $*"; fi; }

MARKETPLACE_REPO="sanath1599/claude-workbench"
MARKETPLACE="starter-pack"
OURS=(workbench workflow kickoff stack-web stack-python design-studio engineering-craft ops-and-sre docs-and-data interactive-demos stack-connectors)

THIRD_PARTY=(
  superpowers@claude-plugins-official
  frontend-design@claude-plugins-official
  code-simplifier@claude-plugins-official
  playground@claude-plugins-official
  chrome-devtools-mcp@claude-plugins-official
  pinecone@claude-plugins-official
  postman@claude-plugins-official
  prisma@claude-plugins-official
  remember@claude-plugins-official
  vercel@claude-plugins-official
  imessage@claude-plugins-official
  cloudflare@anthropic-plugin-directory
  resend@anthropic-plugin-directory
  example-skills@anthropic-agent-skills
  ui-ux-pro-max@ui-ux-pro-max-skill
  animation-components@claude-design-skillstack
  authoring-motion@claude-design-skillstack
  core-3d-animation@claude-design-skillstack
  extended-3d-scroll@claude-design-skillstack
  meta-skills@claude-design-skillstack
  turingmind@turingmind
  woz@wozcode-marketplace
)
# Marketplaces that only served the plugins above. The official catalog stays registered.
OLD_MARKETPLACES=(claude-design-skillstack ui-ux-pro-max-skill turingmind wozcode-marketplace anthropic-agent-skills)

echo "1. Add this marketplace and install its plugins (user scope)"
command -v gh >/dev/null && run gh auth setup-git   # private repo: let git use the gh credential
run claude plugin marketplace add "$MARKETPLACE_REPO"
for p in "${OURS[@]}"; do run claude plugin install "$p@$MARKETPLACE" --scope user; done

echo "2. Uninstall third-party plugins"
installed=$(claude plugin list --json 2>/dev/null || echo "[]")
for p in "${THIRD_PARTY[@]}"; do
  if echo "$installed" | grep -q "\"$p\""; then run claude plugin uninstall "$p"; else echo "skip (not installed): $p"; fi
done
# expo is installed at project scope in another repo; uninstall it there if you still have it:
echo "note: expo@expo-plugins is project-scoped and disabled; run 'claude plugin uninstall expo@expo-plugins --scope project' inside that repo if wanted."

echo "3. Remove marketplaces that are no longer used"
for m in "${OLD_MARKETPLACES[@]}"; do run claude plugin marketplace remove "$m"; done

cat <<'EOF'
4. Kept on purpose (see docs/installed-audit.md):
   - ~/.claude/skills/graphify: the full graph pipeline (docs, papers, images) needs this skill; the workbench calls it.
   - ~/.claude/skills/mulmoterminal-*: these ship with the MulmoTerminal app and are rewritten by it.
   - ~/.claude/skills/reverse-engineer-anything: it pairs with the rea MCP server.
   - Synced claude.ai account skills and plugins (engineering, product-management, data, productivity,
     cowork-plugin-management, desktop-commander, anthropic-skills:*). These come from the claude.ai account,
     not from Claude Code. Turn off the ones you no longer want in claude.ai > Settings > Capabilities (Skills).
5. Then: start a new session, run /workbench:setup, and enable auto-update for starter-pack in /plugin > Marketplaces.
EOF
[ $APPLY = 0 ] && echo "Dry run only. Re-run with --apply to make these changes."
