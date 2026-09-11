import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { refreshDesktopSkillReferences } from './skill-references.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop skill paths '));
  roots.push(root);
  const defaultsRoot = path.join(root, 'defaults');
  const qwenHome = path.join(root, "New Mac's project", '.qwen');
  for (const directory of ['skills/example', 'skills/helper', 'agents'])
    fs.mkdirSync(path.join(defaultsRoot, directory), { recursive: true });
  const template =
    'Run .qwen/skills/example/check.js and .qwen/skills/helper/check.js\n';
  fs.writeFileSync(
    path.join(defaultsRoot, 'skills/example/SKILL.md'),
    template,
  );
  fs.writeFileSync(path.join(defaultsRoot, 'skills/example/check.js'), 'stock');
  fs.writeFileSync(path.join(defaultsRoot, 'skills/helper/check.js'), 'stock');
  fs.writeFileSync(path.join(defaultsRoot, 'agents/test.md'), template);
  fs.cpSync(defaultsRoot, qwenHome, { recursive: true });
  const file = path.join(qwenHome, 'skills/example/SKILL.md');
  return { defaultsRoot, qwenHome, file, template };
}

function rendered(template, qwenHome) {
  return template.replace(
    /\.qwen\/(skills\/[\w./-]+)/g,
    (_match, relative) =>
      `'${path.join(qwenHome, relative).replaceAll("'", "'\\''")}'`,
  );
}

test('resolves fresh stock skill and agent references and leaves missing references unchanged', () => {
  const options = fixture();
  const missing = 'Missing .qwen/skills/example/missing.js\n';
  for (const root of [options.defaultsRoot, options.qwenHome])
    fs.appendFileSync(path.join(root, 'skills/example/SKILL.md'), missing);
  refreshDesktopSkillReferences(options);
  assert.equal(
    fs.readFileSync(options.file, 'utf8'),
    rendered(options.template, options.qwenHome) + missing,
  );
  assert.equal(
    fs.readFileSync(path.join(options.qwenHome, 'agents/test.md'), 'utf8'),
    rendered(options.template, options.qwenHome),
  );
});

test('rebases exact stock markdown copied from another Mac and is idempotent', () => {
  const options = fixture();
  fs.writeFileSync(
    options.file,
    rendered(options.template, "/Users/Old Mac's name/.qwen"),
  );
  refreshDesktopSkillReferences(options);
  assert.equal(
    fs.readFileSync(options.file, 'utf8'),
    rendered(options.template, options.qwenHome),
  );
  const before = fs.statSync(options.file);
  refreshDesktopSkillReferences(options);
  assert.equal(fs.statSync(options.file).mtimeMs, before.mtimeMs);
  assert.equal(fs.statSync(options.file).ino, before.ino);
});

test('preserves customized markdown, scripts, and intentional deletions', () => {
  const options = fixture();
  const custom =
    rendered(options.template, '/Users/old/.qwen') + 'Custom instruction.\n';
  fs.writeFileSync(options.file, custom);
  const script = path.join(options.qwenHome, 'skills/example/check.js');
  fs.writeFileSync(script, 'custom script');
  fs.rmSync(path.join(options.qwenHome, 'agents/test.md'));
  refreshDesktopSkillReferences(options);
  assert.equal(fs.readFileSync(options.file, 'utf8'), custom);
  assert.equal(fs.readFileSync(script, 'utf8'), 'custom script');
  assert.equal(
    fs.existsSync(path.join(options.qwenHome, 'agents/test.md')),
    false,
  );
});

test('does not follow symlinked files or skill directories', () => {
  const options = fixture();
  const outside = path.join(path.dirname(options.defaultsRoot), 'outside.md');
  fs.writeFileSync(outside, options.template);
  fs.rmSync(options.file);
  fs.symlinkSync(outside, options.file);
  const agentDir = path.join(options.qwenHome, 'agents');
  fs.rmSync(agentDir, { recursive: true });
  fs.symlinkSync(path.join(options.defaultsRoot, 'agents'), agentDir);
  refreshDesktopSkillReferences(options);
  assert.equal(fs.readFileSync(outside, 'utf8'), options.template);
  assert.equal(
    fs.readFileSync(path.join(agentDir, 'test.md'), 'utf8'),
    options.template,
  );
});
