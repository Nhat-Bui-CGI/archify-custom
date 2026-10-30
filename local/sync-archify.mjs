#!/usr/bin/env node
// Replays the local brand-mark branch on upstream and installs it for Claude Code and Codex.
//
//   node local/sync-archify.mjs               update, verify, install
//   node local/sync-archify.mjs --no-fetch    rebuild and install the current branch
//   node local/sync-archify.mjs --no-install  update and verify only
//
// Nothing is installed unless every step passes. Each install keeps the previous
// copy under ~/.archify-backups/<timestamp>/.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(repo, 'archify');
const generated = 'archify/renderers/shared/generated-brand-marks.mjs';
const branch = 'local/brand-marks';
const upstream = 'origin/main';
const targets = {
  claude: path.join(os.homedir(), '.claude', 'skills', 'archify'),
  codex: path.join(os.homedir(), '.agents', 'skills', 'archify'),
};
const expectedMarks = { 'Azure Fabric': 'microsoft-fabric', Boomi: 'boomi', 'AX 2012': 'dynamics-ax-2012', d365: 'dynamics-365' };
const flags = new Set(process.argv.slice(2));

function run(command, args, { cwd = repo, allowFailure = false, env } = {}) {
  // npm is a .cmd shim on Windows, which only runs through a shell.
  const viaShell = process.platform === 'win32' && command === 'npm';
  const result = spawnSync(viaShell ? [command, ...args].join(' ') : command, viaShell ? [] : args, {
    cwd,
    encoding: 'utf8',
    shell: viaShell,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  }
  return result;
}

const git = (...args) => run('git', args).stdout.trim();

function step(message) {
  console.log(`- ${message}`);
}

function conflictedFiles() {
  return git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
}

function installDependencies() {
  run('npm', ['ci', '--ignore-scripts'], { cwd: skill });
}

// The bundle is derived from the catalog, so its conflicts are resolved by regenerating it.
// Any other conflict needs a person: the rebase is undone and nothing is installed.
function rebase() {
  let result = run('git', ['rebase', upstream], { allowFailure: true });
  while (result.status !== 0) {
    const conflicts = conflictedFiles();
    if (conflicts.length === 0 || conflicts.some((file) => file !== generated)) {
      run('git', ['rebase', '--abort'], { allowFailure: true });
      throw new Error(`Rebase stopped on conflicts, nothing was installed. Resolve by hand:\n  git rebase ${upstream}\nConflicted files:\n  ${conflicts.join('\n  ') || result.stderr}`);
    }
    run('git', ['checkout', '--theirs', '--', generated]);
    run('npm', ['run', '-s', 'generate:brand-marks'], { cwd: skill });
    run('git', ['add', generated]);
    result = run('git', ['rebase', '--continue'], { allowFailure: true, env: { GIT_EDITOR: 'true' } });
  }
}

function update() {
  if (git('branch', '--show-current') !== branch) throw new Error(`Switch to ${branch} first.`);
  if (git('status', '--porcelain')) throw new Error('The working tree has uncommitted changes. Commit or stash them first.');
  if (flags.has('--no-fetch')) return;
  git('fetch', 'origin', '--tags');
  const behind = git('rev-list', '--count', `HEAD..${upstream}`);
  step(`${behind} new upstream commit(s) on ${upstream}`);
  if (behind === '0') return;
  installDependencies();
  rebase();
}

function verify(stage) {
  installDependencies();
  run('npm', ['run', '-s', 'generate:brand-marks'], { cwd: skill });
  if (git('status', '--porcelain', '--', generated)) {
    git('add', generated);
    git('commit', '-m', 'chore(brand-marks): regenerate bundle after upstream update');
  }
  run('npm', ['run', '-s', 'check:brand-marks'], { cwd: skill });
  run('node', [path.join(repo, 'scripts', 'stage-clean-skill.mjs'), '--root', repo, '--dest', stage,
    '--mode-manifest', `${stage}.modes.json`]);

  const cli = path.join(stage, 'bin', 'archify.mjs');
  run('node', [cli, 'doctor']);
  for (const [query, id] of Object.entries(expectedMarks)) {
    const { marks } = JSON.parse(run('node', [cli, 'brands', query, '--json']).stdout);
    if (!marks.some((mark) => mark.id === id)) throw new Error(`Brand lookup "${query}" no longer finds ${id}.`);
  }
  run('node', [cli, 'validate', 'architecture', path.join(stage, 'examples', 'd365fo-integration.architecture.json')]);
}

function install(stage) {
  const backups = path.join(os.homedir(), '.archify-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backups, { recursive: true });
  for (const [name, target] of Object.entries(targets)) {
    const incoming = `${target}.incoming`;
    fs.cpSync(stage, incoming, { recursive: true });
    if (fs.existsSync(target)) fs.renameSync(target, path.join(backups, name));
    fs.renameSync(incoming, target);
    step(`installed ${target}`);
  }
  step(`previous copies are in ${backups}`);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-sync-'));
try {
  update();
  const stage = path.join(work, 'archify');
  verify(stage);
  step(`verified ${git('rev-parse', '--short', 'HEAD')} on top of ${git('rev-parse', '--short', upstream)}`);
  if (!flags.has('--no-install')) install(stage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
