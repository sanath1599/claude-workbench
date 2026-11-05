---
name: provisioning-on-hyperscalers
description: Use when a project's deploymentTier is enterprise, or the owner asks to create or change resources on Azure, AWS or Google Cloud with the cloud CLI, keep infrastructure as Terraform or Bicep, or stand up the next environment. Not for Azure Functions and Logic Apps mechanics (deploying-to-azure), the approval gate (releasing-safely) or Vercel.
---

# Provisioning on hyperscalers

Build on the cloud CLI first, where feedback is fast, then turn what exists into Terraform (or Bicep on Azure) so it can be validated and repeated for the next environment. Every command names its target explicitly, nothing paid exists before the owner has seen the cost, and when `iacSync` is on the code is updated after every round of CLI changes.

## When to use
- `.claude/workbench.json` has `deploymentTier: enterprise`, or the owner names Azure, AWS or Google Cloud for the project.
- Creating, changing or deleting cloud resources; generating infrastructure code from existing resources; creating staging or production from dev.
- Writing `scripts/deploy-<env>.sh` for a project with no CI/CD pipeline.

## When not to use
- Function apps, Logic Apps, VNet-restricted resources, 403s on `az` writes: `ops-and-sre:deploying-to-azure` (this skill covers the generic flow; that one the Azure mechanics).
- The production gate, backups, rollback: `ops-and-sre:releasing-safely`. The owner-facing cost approval is the same gate (`workbench:shipping-to-production`).
- Pipeline authoring for an existing system: `ops-and-sre:setting-up-ci`.
- Dev or internal tiers: run locally or use Vercel (`stack-web:deploying-on-vercel`).

## Procedure

1. **Read the settings.** Open `.claude/workbench.json`: `cloud`, `cicd` (`none` or a system name), `iac` (`cli-then-iac`, `terraform`, `bicep`, `cli-only`), `iacTool`, `iacSync`. Missing keys mean ask once. **Done when:** you can state cloud, pipeline and IaC approach in one line.
2. **Tooling check.** Verify the CLI is installed and logged in, and pin the target (table below). If the owner has the official plugin, prefer its MCP tools for reads; recommend one only from the list under "Plugins". Say which subscription, account or project you will act in and wait for a correction. **Done when:** the identity command printed and the target is named.
3. **Cost statement, then the gate.** List each resource with its SKU or size, region and monthly cost, and what is free. Get the owner's yes before the first paid resource (`releasing-safely` step 4). Dev environments use the smallest SKUs and are deleted when idle. **Done when:** the owner's reply names the spend.
4. **Create on the CLI.** One environment first (dev). Follow the conventions below. Keep the exact commands in `scripts/` (not in chat) so they can be replayed. **Done when:** the resources exist and a read-only command (`show`, `describe`) proves each.
5. **Sync the IaC after each round** (when `iac` is `cli-then-iac`, so `iacSync` is true): generate or update `infra/` for what changed (section below), validate, append a dated entry to `infra/CHANGES.md` (what changed, the commands, the validation output, anything the export could not express), then run `node "<ops-and-sre>/scripts/iac-sync.mjs" done`. The Stop hook blocks once until pending changes are cleared. **Done when:** `node .../iac-sync.mjs status` reports none pending.
6. **Create the next environment from the IaC.** staging, then prod, with a variables file per environment. Run `plan`, read it, and apply only after the gate. Same artifact each time. **Done when:** the plan for the new environment shows only expected resources, and the apply output was shown.
7. **Deploy the app.** With `cicd: none`, use `scripts/deploy-<env>.sh` (below). With an existing pipeline, add the deploy job to it and keep the secrets in its store. **Done when:** the version marker served by the environment equals the commit shipped.

## Target, login and plugins

| | Azure | AWS | Google Cloud |
|---|---|---|---|
| Install | `brew install azure-cli` | AWS CLI v2 installer or `brew install awscli` | `brew install --cask gcloud-cli` |
| Who am I | `az account show` | `aws sts get-caller-identity` | `gcloud auth list` |
| Pin the target | `--subscription <name> --resource-group <rg>` | `--profile <name> --region <r>` | `--project <id> --region <r>` |
| Login | `az login` (device code in cloud sessions) | `aws sso login --profile <name>` | `gcloud auth login` |

Never rely on the default subscription, profile or project; a laptop's default is whatever it was last. Use a short-lived credential (SSO, device code, workload identity), never a long-lived key pasted into a command.

Plugins (checked against the `claude-plugins-official` catalog on 2026-11-05; install with `claude plugin install <name>@claude-plugins-official`): Azure has `azure` (Azure MCP server and skills). AWS has `aws-core` (infrastructure-as-code authoring and core services) and `deploy-on-aws` (architecture, cost estimates, IaC deployment). Terraform has `terraform` (Terraform MCP server). Google Cloud has no general-purpose plugin there; only service-specific ones such as `cloud-sql-postgresql` and `google-cloud-storage`, so use the CLI alone. Run `claude plugin details <name>@claude-plugins-official` after adding the marketplace to confirm before recommending.

## Conventions

- **Names:** `<project>-<env>-<resource>`, lowercase, for example `fieldnotes-dev-api`. Azure prefixes follow the resource type (`rg-`, `ca-`, `kv-`, `psql-`); storage account and Key Vault names are global and short, so add a suffix.
- **Tags or labels on everything:** `project`, `env` (dev, staging, prod), `owner` (a team alias, never a personal address), `managed-by` (`cli` until imported, then `terraform` or `bicep`). Label on GCP.
- **Region:** the one closest to users that has every service you need and satisfies data residency. One region per environment unless the brief says otherwise; record the choice and the reason in the design spec.
- **Identities:** one per environment and per workload, least privilege, scoped to the resource group, project or specific resources. Managed identity (Azure), IAM roles for tasks (AWS) and service accounts bound to the workload (GCP) over keys. No owner or admin roles for apps.
- **Secrets:** Key Vault, Secrets Manager or Secret Manager; the app reads them by reference. Never print a value; set secrets from a file or stdin, not as a command argument.

## From CLI to infrastructure code

State goes in a remote backend (Azure storage, S3, GCS) with locking, never in git. Generated code is a starting point: read it, remove defaults and computed fields, replace literals with variables, and run `plan` until it reports no changes.

| Cloud | Generate |
|---|---|
| Azure, Terraform | `aztfexport resource-group <rg>` (add `--non-interactive`, `-o <dir>`, `--hcl-only`, `--append` as needed) |
| Azure, Bicep | `az group export --name <rg> --subscription <name> > template.json`, then `az bicep decompile --file template.json`; fix the warnings; check with `az bicep build --file main.bicep` |
| AWS | write `import` blocks (`to`, `id`) for each resource, then `terraform plan -generate-config-out=generated.tf` (Terraform 1.5 or newer) |
| Google Cloud | `gcloud beta resource-config bulk-export --project <id> --resource-format=terraform --path <dir>` where the resource type is supported; otherwise `import` blocks as for AWS |

Validate: `terraform init && terraform validate && terraform plan` (expect no changes against the existing environment), or `az bicep build` plus `az deployment group what-if`. Keep one folder per environment or one module plus `<env>.tfvars`.

## No pipeline: deploy scripts

When `cicd` is `none`, write `scripts/deploy-<env>.sh`: `set -euo pipefail`; takes no secrets as arguments; prints the pinned subscription, account or project before acting; builds, pushes the image, updates the service, then reads back the served version marker. Production scripts refuse to run without an explicit `--yes` and the owner's approval in the conversation. Never `set -x`, never echo a variable that holds a secret, and read values from the secret store or the environment.

## Quick reference

| Symptom | Likely cause |
|---|---|
| Resource appeared in the wrong subscription, account or project | A command ran without the explicit target flag |
| `plan` wants to replace everything after an export | Names or IDs differ from the live resource; fix the import ID or the name expression |
| Export drops secrets or app settings | Exports omit secret values by design; reference the secret store |
| Stop hook blocks repeatedly | Pending changes remain; update `infra/`, then run `iac-sync.mjs done` |
| 403 on a write | Missing role; stop and ask (`deploying-to-azure` permissions section) |

## Verification
- [ ] Every command named its subscription, account or project; production steps had a yes.
- [ ] Cost statement approved before anything paid was created.
- [ ] With `iacSync`: `infra/` validates, `infra/CHANGES.md` has a dated entry, `iac-sync.mjs status` shows nothing pending.
- [ ] The next environment came from the IaC and its plan was reviewed.
- [ ] No secret in scripts, state, logs or CHANGES.md.

## Versions
- terraform 1.17.1 (verified 2026-11-05, https://github.com/hashicorp/terraform/releases)
- aztfexport 0.20.0 (verified 2026-11-05, https://github.com/Azure/aztfexport/releases)

Read the current docs before relying on a flag: https://learn.microsoft.com/azure/developer/terraform/azure-export-for-terraform/ , https://developer.hashicorp.com/terraform/language/import/generating-configuration , https://cloud.google.com/sdk/gcloud/reference/beta/resource-config/bulk-export . Bulk export is a beta command and covers only some resource types. AWS App Runner no longer accepts new customers (verified 2026-11-05, https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html); use ECS.
