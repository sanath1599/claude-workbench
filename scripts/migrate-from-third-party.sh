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
OURS=(workbench workflow kickoff stack-web stack-python stack-mobile design-studio engineering-craft ops-and-sre docs-and-data interactive-demos stack-connectors toolbelt)

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

echo "4. Personal skills now bundled in the toolbelt plugin: move the old copies to a backup"
BACKUP="$HOME/.claude/skills-backup/$(date +%Y-%m-%d)"
for s in graphify reverse-engineer-anything; do
  if [ -d "$HOME/.claude/skills/$s" ]; then run mkdir -p "$BACKUP"; run mv "$HOME/.claude/skills/$s" "$BACKUP/$s"; fi
done
if claude mcp get rea >/dev/null 2>&1; then run claude mcp remove rea -s user; fi   # toolbelt bundles the rea MCP server
echo "5. graphify CLI, system-wide"
if command -v pipx >/dev/null; then run sh -c "pipx upgrade graphifyy || pipx install graphifyy"; else echo "install pipx, then: pipx install graphifyy"; fi

cat <<'EOF'
6. Notes:
   - ~/.claude/skills/mulmoterminal-*: the MulmoTerminal app rewrites these when it starts, so they come back even if
     removed. toolbelt carries the same skills; if both show up, that is the app's copy and it is harmless.
   - Synced claude.ai account skills and plugins (engineering, product-management, data, productivity,
     cowork-plugin-management, desktop-commander, anthropic-skills:*). These come from the claude.ai account,
     not from Claude Code. Turn off the ones you no longer want in claude.ai > Settings > Capabilities (Skills).
7. Then: start a new session, run /workbench:setup, and enable auto-update for starter-pack in /plugin > Marketplaces.
EOF
[ $APPLY = 0 ] && echo "Dry run only. Re-run with --apply to make these changes."
