import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { classifyCommand, handlePostToolUse, handleStop, historyPath, markDone, pendingPath, readPending, redact, truncate } from '../../plugins/ops-and-sre/scripts/iac-sync.mjs';

const SCRIPT = join(process.cwd(), 'plugins/ops-and-sre/scripts/iac-sync.mjs');

function project(config) {
  const dir = mkdtempSync(join(tmpdir(), 'iac-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'workbench.json'), JSON.stringify(config));
  return dir;
}
const bash = (cwd, command) => ({ cwd, tool_name: 'Bash', tool_input: { command } });

test('classifies mutating cloud CLI calls', () => {
  const mutating = [
    'az group create --name rg-app-dev --location westeurope --subscription Dev',
    'az containerapp update -n app -g rg --image x:1',
    'az role assignment create --assignee abc --role Reader',
    'az webapp deploy --name a --src-path a.zip',
    'az keyvault secret set --vault-name kv --name x --value hunter2hunter2',
    'az rest --method put --url https://management.azure.com/x',
    'aws ec2 run-instances --image-id ami-1',
    'aws s3api put-bucket-policy --bucket b --policy file://p.json',
    'aws iam create-role --role-name r',
    'aws rds delete-db-instance --db-instance-identifier x',
    'aws s3 sync ./dist s3://bucket',
    'aws cloudformation deploy --template-file t.yml --stack-name s',
    'gcloud run deploy api --image gcr.io/p/i --project p',
    'gcloud compute instances create vm1 --project p',
    'gcloud projects add-iam-policy-binding p --member=x --role=roles/viewer',
    'gcloud services enable run.googleapis.com --project p',
    'gcloud beta sql instances delete db1 --project p',
  ];
  for (const c of mutating) assert.equal(classifyCommand(c).length, 1, c);
  assert.equal(classifyCommand('az group create -n a && az group create -n b').length, 2);
  assert.equal(classifyCommand('cd infra && AWS_PROFILE=dev aws ec2 stop-instances --instance-ids i-1')[0].cloud, 'aws');
});

test('ignores read-only and local-only cloud CLI calls', () => {
  const readOnly = [
    'az account show',
    'az login --use-device-code',
    'az account set --subscription Dev',
    'az group show -n rg',
    'az containerapp list -g rg',
    'az keyvault secret show --name x --vault-name kv',
    'az deployment group what-if -g rg --template-file main.bicep',
    'az bicep build --file main.bicep',
    'az rest --method get --url https://management.azure.com/x',
    'aws sts get-caller-identity',
    'aws ec2 describe-instances',
    'aws s3 ls',
    'aws s3 sync ./a s3://b --dryrun',
    'aws configure set region eu-west-1',
    'aws eks update-kubeconfig --name c',
    'gcloud auth list',
    'gcloud config set project p',
    'gcloud run services describe api --project p',
    'gcloud compute instances list',
    'ls -la | grep az',
    'terraform apply',
    'echo "az group create"',
  ];
  for (const c of readOnly) assert.equal(classifyCommand(c).length, 0, c);
});

test('redaction masks secrets and the command is truncated to 300 characters', () => {
  const key = 'AKIAABCDEFGHIJKLMNOP';
  assert.ok(!redact(`aws iam create-access-key --key ${key}`).includes(key));
  assert.ok(!redact('az keyvault secret set --name x --value hunter2hunter2').includes('hunter2'));
  assert.ok(!redact('az sql server create --admin-password Sup3rSecretPw!').includes('Sup3rSecretPw'));
  assert.ok(!redact('az webapp config appsettings set --settings API_TOKEN=abcdef123456789').includes('abcdef123456789'));
  assert.ok(!redact('psql postgresql://admin:topsecretpw@db.example.com/x').includes('topsecretpw'));
  assert.equal(redact('az containerapp update --image x:1'), 'az containerapp update --image x:1');
  assert.equal(redact('az keyvault secret set --value $SECRET_FROM_ENV'), 'az keyvault secret set --value $SECRET_FROM_ENV');
  assert.equal(truncate('a'.repeat(500)).length, 300);
});

test('PostToolUse appends a redacted entry when iacSync is on', () => {
  const dir = project({ iacSync: true });
  const now = new Date('2026-11-05T10:00:00.000Z');
  const out = handlePostToolUse(bash(dir, 'az keyvault secret set --name x --vault-name kv --value hunter2hunter2 --subscription Dev'), { now });
  assert.match(out.hookSpecificOutput.additionalContext, /Logged for IaC sync: update infra\/ before finishing this round\./);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  const entries = readPending(dir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].ts, now.toISOString());
  assert.equal(entries[0].cloud, 'az');
  assert.ok(!entries[0].command.includes('hunter2'));
  assert.equal(handlePostToolUse(bash(dir, 'az account show')), null);
  assert.equal(readPending(dir).length, 1);
});

test('PostToolUse does nothing when iacSync is off or absent', () => {
  for (const cfg of [{ iacSync: false }, {}]) {
    const dir = project(cfg);
    assert.equal(handlePostToolUse(bash(dir, 'az group create -n x -l westeurope')), null);
    assert.equal(existsSync(pendingPath(dir)), false);
  }
});

test('Stop blocks with the count, the list and the real script path', () => {
  const dir = project({ iacSync: true });
  for (let i = 0; i < 12; i += 1) handlePostToolUse(bash(dir, `gcloud run deploy svc${i} --project p`));
  const out = handleStop({ cwd: dir }, { CLAUDE_PLUGIN_ROOT: '/plugins/ops-and-sre' });
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /12 infrastructure changes/);
  assert.match(out.reason, /svc0/);
  assert.match(out.reason, /svc9/);
  assert.ok(!out.reason.includes('svc10'));
  assert.match(out.reason, /2 more/);
  assert.match(out.reason, /infra\/CHANGES\.md/);
  assert.ok(out.reason.includes('node "/plugins/ops-and-sre/scripts/iac-sync.mjs" done'));
});

test('Stop never blocks when stop_hook_active is true, nothing is pending, or sync is off', () => {
  const dir = project({ iacSync: true });
  assert.equal(handleStop({ cwd: dir }), null);
  handlePostToolUse(bash(dir, 'aws ec2 run-instances --image-id ami-1'));
  assert.equal(handleStop({ cwd: dir, stop_hook_active: true }), null);
  assert.equal(handleStop({ cwd: dir }).decision, 'block');
  const off = project({ iacSync: false });
  mkdirSync(join(off, '.workbench'));
  writeFileSync(pendingPath(off), `${JSON.stringify({ ts: 'x', cloud: 'aws', command: 'aws ec2 run-instances' })}\n`);
  assert.equal(handleStop({ cwd: off }), null);
});

test('done moves pending entries to history and empties the file', () => {
  const dir = project({ iacSync: true });
  handlePostToolUse(bash(dir, 'az group create -n rg -l westeurope'));
  handlePostToolUse(bash(dir, 'az group delete -n rg --yes'));
  const n = markDone(dir, { note: 'round 1', now: new Date('2026-11-05T11:00:00.000Z') });
  assert.equal(n, 2);
  assert.equal(readPending(dir).length, 0);
  assert.equal(readFileSync(pendingPath(dir), 'utf8'), '');
  const history = readFileSync(historyPath(dir), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(history.length, 2);
  assert.equal(history[0].synced, '2026-11-05T11:00:00.000Z');
  assert.equal(history[0].note, 'round 1');
  assert.equal(handleStop({ cwd: dir }), null);
});

test('CLI: post-tool-use via stdin, status, done', () => {
  const dir = project({ iacSync: true });
  const run = (args, input) => spawnSync('node', [SCRIPT, ...args], { cwd: dir, input, encoding: 'utf8' });
  const post = run(['post-tool-use'], JSON.stringify(bash(dir, 'aws s3api create-bucket --bucket b')));
  assert.equal(post.status, 0);
  assert.match(JSON.parse(post.stdout).hookSpecificOutput.additionalContext, /IaC sync/);
  assert.match(run(['status']).stdout, /create-bucket/);
  const stop = run(['stop'], JSON.stringify({ cwd: dir }));
  assert.equal(JSON.parse(stop.stdout).decision, 'block');
  assert.match(run(['done', '--note', 'ok']).stdout, /Marked 1 change/);
  assert.match(run(['status']).stdout, /No pending/);
  assert.equal(run(['stop'], JSON.stringify({ cwd: dir })).stdout, '');
});

test('hooks.json wires PostToolUse (Bash) and Stop to the script', () => {
  const h = JSON.parse(readFileSync('plugins/ops-and-sre/hooks/hooks.json', 'utf8')).hooks;
  assert.equal(h.PostToolUse[0].matcher, 'Bash');
  assert.match(h.PostToolUse[0].hooks[0].command, /iac-sync\.mjs" post-tool-use/);
  assert.match(h.Stop[0].hooks[0].command, /iac-sync\.mjs" stop/);
});
