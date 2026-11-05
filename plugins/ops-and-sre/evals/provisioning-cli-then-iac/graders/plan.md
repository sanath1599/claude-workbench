---
type: llm
weight: 3
---

Pass only if the response (1) checks identity with `az account show` and passes `--subscription` and `--resource-group` explicitly in every proposed `az` command, (2) states the resources, regions and expected monthly cost and asks for the owner's yes before creating anything paid, (3) plans to create dev on the CLI first and then generate Terraform or Bicep from what exists (for example `aztfexport`, or `az group export` with `az bicep decompile`), validate it, and use it to create staging, (4) says infra/ will be updated and logged in infra/CHANGES.md after each round of CLI changes, and (5) puts deployment in `scripts/deploy-<env>.sh` that never prints secrets. Fail if it creates resources without the cost statement, relies on the default subscription, or skips the IaC step.
