---
name: update-skill
description: Use when the owner states a durable preference or rule ("from now on", "always", "never", "remember this", "I prefer"), corrects Claude in a way that would recur, or a session turns up a useful finding (a new library feature, a gotcha, a better pattern) worth keeping. Not for one-off task details or facts about a single project, which belong in that project's CLAUDE.md or memory.
---

# Update the workbench with what was learned

The workbench is the owner's long-term memory for how Claude should work. When something durable is said or found, fold it in right after handling the request. Update the closest existing skill; create a new skill only when nothing fits. Then validate, commit and push, and tell the owner in one line.

## When to use
- A stated preference, rule or correction meant to last ("use X, not Y", "stop doing Z").
- A finding with reuse value: an API change, a version gotcha, a pattern that worked, a failure that cost time.
- The UserPromptSubmit hook added a note suggesting this skill.

## When not to use
- The detail matters only to this project (a file path, a client's name, a one-time decision). Put it in the project's CLAUDE.md or Claude's memory instead.
- A change to the owner's email, domain or accounts. Use workbench:setup.
- Anything containing a secret or client-confidential data. Never store those.

## Procedure

1. **Distil.** Write the learning as one standing rule plus its reason: what, why (quote the owner in 20 words or fewer if they said it), scope (universal, stack-specific or project-specific), and today's date.
   **Done when:** you can say it in two sentences. If it is project-specific, stop here and save it to the project instead.

2. **Choose the home** with this order of preference:

   | The learning is... | It goes in |
   |---|---|
   | Mechanically checkable (a banned import, a command pattern) | a hook rule in `plugins/workbench/scripts/guard-*.mjs` plus a test |
   | A cross-cutting rule that must apply in every session | `plugins/workbench/rules.md`. Keep that file short; replace rather than append. |
   | About a topic an existing skill covers | that skill, in the section where it applies |
   | A new topic with reuse value | a new skill in the best-fitting plugin |
   | A package version or API fact | the skill's `## Versions` block and `maintenance/tracked-packages.json` |

3. **Open the repo.** Use `{{wb.workbench_local_path}}` if it exists and its remote is `{{wb.workbench_repo}}`. Otherwise (for example in a cloud session) run `gh repo clone {{wb.workbench_repo}} "$TMPDIR/workbench"`. Then run `git pull --ff-only`.

4. **Find the skill.** Run `node scripts/find-skill.mjs "<3-6 keywords>"` from the repo root. It ranks skills by name, description and body. Read the top three candidates' SKILL.md files and pick the one whose "When to use" already covers the situation.
   **Done when:** you have named the target file, or decided on a new skill and its plugin.

5. **Edit by integrating, not appending.** Put the rule where a reader of that section would look: a Procedure step, a Quick reference row, a Rationalizations row, a Versions line. If the new rule contradicts an old one, the newer statement wins. Rewrite the old rule and keep a dated "Changed YYYY-MM-DD" note only when the history matters. If the trigger needs new words, extend the description, staying within the authoring rules. For a new skill, follow `docs/authoring.md` exactly and add an eval case when the skill changes default behaviour. For a changed discipline skill, run its pressure prompt before and after the edit (see `workbench:creating-skills`, step 4) and confirm the behaviour changed.

6. **Log it.** Add one line to `docs/learnings.md`: `YYYY-MM-DD · plugin:skill · summary · source (session, project or link)`.

7. **Validate and ship:**
   ```bash
   npm test
   claude plugin validate plugins/<plugin> --strict
   node scripts/bump-version.mjs <plugin> patch      # minor for a new skill
   git add -A && git commit -m "learn: <summary>" && git push
   claude plugin marketplace update starter-pack 2>/dev/null || true
   ```
   The secret-scan hook checks the commit and the push. The current session picks up changes after `/reload-plugins`. A rendered personal package needs `/workbench:setup --refresh`.
   **Done when:** the push succeeded. Show the commit hash.

8. **Tell the owner** in one line: `Saved to <plugin>:<skill> — <summary> (<hash>).`

## Rationalizations

| Excuse | Instead |
|---|---|
| "It's small, not worth a skill edit." | If the owner said always or never, it recurs. Save it. |
| "I'll batch these at the end of the session." | Sessions end without warning. Save it right after the request is handled. |
| "I'll add a Learnings section at the bottom." | Dumps get skipped. Integrate it where the rule applies. |
| "The old rule might still matter." | The newer statement wins. Update the old rule, and note the change if history matters. |
| "I'll put the client's details in for context." | Keep skills generic. Client specifics go in that client's repo. |

## Verification
- [ ] The rule reads as a standing instruction, in the house style.
- [ ] No secrets, personal data or client-confidential details.
- [ ] Tests and validation passed; the version was bumped; the push succeeded.
- [ ] The owner got the one-line summary with the hash.
