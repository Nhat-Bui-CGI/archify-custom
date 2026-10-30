#!/usr/bin/env node
// Replays the local brand-mark branch on upstream and installs the archify and azure-diagram
// skills for Claude Code and Codex. See local/README.md for setting up another computer.
//
//   node local/sync-archify.mjs               update, verify, install, push
//   node local/sync-archify.mjs --no-fetch    rebuild and install the current branch
//   node local/sync-archify.mjs --no-install  update and verify only
//
// Nothing is installed unless every step passes for both skills. Each install keeps the
// previous copies under ~/.archify-backups/<timestamp>/<skill>/{claude,codex}.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(repo, 'archify');
const generated = 'archify/renderers/shared/generated-brand-marks.mjs';
const branch = 'local/brand-marks';
const upstreamUrl = 'https://github.com/tt-a1i/archify';
const upstream = 'upstream/main';
const shared = `origin/${branch}`;
const azureDiagram = path.join(repo, 'azure-diagram');
const skillRoots = {
  claude: path.join(os.homedir(), '.claude', 'skills'),
  codex: path.join(os.homedir(), '.agents', 'skills'),
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

// Another computer may have rebased and force-pushed the branch. Its copy replaces this
// one only when every local commit is already in it, so no local work can be lost.
function adoptSharedBranch() {
  const unique = git('cherry', shared, 'HEAD').split('\n').filter((line) => line.startsWith('+'));
  if (unique.length > 0 && git('rev-list', '--count', `HEAD..${shared}`) !== '0') {
    throw new Error(`This branch and ${shared} both have new commits. Rebase onto ${shared} by hand, then rerun.`);
  }
  if (unique.length === 0) git('reset', '--hard', shared);
}

// Upstream history is rewritten on every rebase, so the shared branch needs a guarded force-push.
function publish() {
  if (git('rev-parse', 'HEAD') === git('rev-parse', shared)) return;
  git('push', '--force-with-lease', 'origin', branch);
  step(`pushed ${branch} to origin`);
}

function update() {
  if (git('branch', '--show-current') !== branch) throw new Error(`Switch to ${branch} first.`);
  if (git('status', '--porcelain')) throw new Error('The working tree has uncommitted changes. Commit or stash them first.');
  if (flags.has('--no-fetch')) return;
  if (!git('remote').split('\n').includes('upstream')) git('remote', 'add', 'upstream', upstreamUrl);
  git('fetch', 'upstream', '--tags');
  git('fetch', 'origin');
  adoptSharedBranch();
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

// The icons are ignored by Git and built here, so the stage holds exactly what is committed.
function verifyAzureDiagram(stage) {
  fs.cpSync(azureDiagram, stage, {
    recursive: true,
    filter: (source) => path.relative(azureDiagram, source).split(path.sep)[0] !== 'icons',
  });
  run('node', [path.join(stage, 'scripts', 'build-icons.mjs'), '--source', path.join(skill, 'brand-marks'),
    '--out', path.join(stage, 'icons')]);
  run('node', ['--test', path.join('test', 'azure-diagram.test.mjs')], { cwd: stage });
  const sample = path.join(`${stage}-sample`, 'example');
  run('node', [path.join(stage, 'bin', 'azure-diagram.mjs'), 'render',
    path.join(stage, 'examples', 'd365-integration.json'), '--out', sample]);
  for (const extension of ['svg', 'html', 'drawio']) {
    if (!fs.statSync(`${sample}.${extension}`).size) throw new Error(`azure-diagram wrote an empty .${extension} file.`);
  }
}

function install(stages) {
  const backups = path.join(os.homedir(), '.archify-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  for (const [skillName, stage] of Object.entries(stages)) {
    for (const [name, root] of Object.entries(skillRoots)) {
      const target = path.join(root, skillName);
      const incoming = `${target}.incoming`;
      fs.mkdirSync(root, { recursive: true });
      fs.cpSync(stage, incoming, { recursive: true });
      if (fs.existsSync(target)) {
        fs.mkdirSync(path.join(backups, skillName), { recursive: true });
        fs.renameSync(target, path.join(backups, skillName, name));
      }
      fs.renameSync(incoming, target);
      step(`installed ${target}`);
    }
  }
  step(`previous copies are in ${backups}`);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-sync-'));
try {
  update();
  const stages = { archify: path.join(work, 'archify'), 'azure-diagram': path.join(work, 'azure-diagram') };
  verify(stages.archify);
  verifyAzureDiagram(stages['azure-diagram']);
  step(`verified ${git('rev-parse', '--short', 'HEAD')} on top of ${git('rev-parse', '--short', upstream)}`);
  if (!flags.has('--no-install')) {
    install(stages);
    if (!flags.has('--no-fetch')) publish();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
