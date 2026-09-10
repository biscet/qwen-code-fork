import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';
import { installDesktopWorkspaceDefaults } from './install-defaults.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
const source = path.dirname(fileURLToPath(import.meta.url));
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homecode workspace '));
  roots.push(root);
  const runtimeRoot = path.join(root, 'HomeCode.app');
  const qwenHome = path.join(root, 'profile');
  const workspaceDir = path.join(root, 'workspace A');
  fs.mkdirSync(qwenHome);
  fs.mkdirSync(workspaceDir);
  const defaults = path.join(runtimeRoot, 'defaults');
  fs.mkdirSync(path.join(defaults, 'skills/example'), { recursive: true });
  fs.mkdirSync(path.join(defaults, 'agents'));
  fs.copyFileSync(
    path.join(source, 'settings.json'),
    path.join(defaults, 'settings.json'),
  );
  fs.copyFileSync(
    path.join(source, 'settings.json'),
    path.join(qwenHome, 'settings.json'),
  );
  fs.writeFileSync(
    path.join(defaults, 'skills/example/SKILL.md'),
    'Run .qwen/skills/example/check.js',
  );
  fs.writeFileSync(
    path.join(defaults, 'skills/example/check.js'),
    'console.log(1)',
  );
  fs.writeFileSync(
    path.join(defaults, 'agents/test-engineer.md'),
    'test engineer',
  );
  return { runtimeRoot, qwenHome, workspaceDir };
}
function settings(options) {
  return parse(
    fs.readFileSync(
      path.join(options.workspaceDir, '.qwen/settings.json'),
      'utf8',
    ),
  );
}

test('provisions local workspace MCPs and independent project skills and agents', () => {
  const options = fixture();
  const managed = installDesktopWorkspaceDefaults(options);
  assert.equal(Object.keys(managed).length, 5);
  for (const name of ['node-repl', 'serena', 'playwright', 'chrome-devtools']) {
    assert.equal(managed[name].command, '${HOMECODE_MCP_NODE}');
    assert.deepEqual(managed[name].args, ['${HOMECODE_MCP_LAUNCHER}', name]);
    assert.equal(managed[name].httpUrl, undefined);
    assert.equal(managed[name].cwd, undefined);
  }
  assert.match(managed['home-ai-research'].httpUrl, /\/research\/mcp$/);
  const second = {
    ...options,
    workspaceDir: path.join(path.dirname(options.workspaceDir), 'workspace B'),
  };
  fs.mkdirSync(second.workspaceDir);
  installDesktopWorkspaceDefaults(second);
  for (const workspace of [options, second]) {
    const text = fs.readFileSync(
      path.join(workspace.workspaceDir, '.qwen/skills/example/SKILL.md'),
      'utf8',
    );
    assert.ok(
      text.includes(
        `${fs.realpathSync(workspace.workspaceDir)}/.qwen/skills/example/check.js`,
      ),
    );
    assert.equal(
      fs.readFileSync(
        path.join(workspace.workspaceDir, '.qwen/agents/test-engineer.md'),
        'utf8',
      ),
      'test engineer',
    );
  }
});

test('preserves JSONC, project and user overrides, and existing agent files', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.workspaceDir, '.qwen/agents'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'),
    'custom',
  );
  fs.writeFileSync(
    path.join(options.workspaceDir, '.qwen/settings.json'),
    '{\n// keep\n"mcpServers":{"serena":{"command":"custom"}}, "model":{"name":"custom"}}',
  );
  fs.writeFileSync(
    path.join(options.workspaceDir, '.mcp.json'),
    JSON.stringify({
      mcpServers: { playwright: { command: 'project-browser' } },
    }),
  );
  const userFile = path.join(options.qwenHome, 'settings.json');
  const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  user.mcpServers['node-repl'] = { command: 'custom-node' };
  fs.writeFileSync(userFile, JSON.stringify(user));
  const managed = installDesktopWorkspaceDefaults(options);
  assert.deepEqual(Object.keys(managed).sort(), [
    'chrome-devtools',
    'home-ai-research',
  ]);
  assert.equal(settings(options).mcpServers.serena.command, 'custom');
  assert.equal(settings(options).model.name, 'custom');
  assert.match(
    fs.readFileSync(
      path.join(options.workspaceDir, '.qwen/settings.json'),
      'utf8',
    ),
    /\/\/ keep/,
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'),
      'utf8',
    ),
    'custom',
  );
});

test('repeat launch preserves deletions and refuses ownership of edited definitions', () => {
  const options = fixture();
  installDesktopWorkspaceDefaults(options);
  const current = settings(options);
  delete current.mcpServers.playwright;
  current.mcpServers.serena.args.push('--unexpected');
  fs.writeFileSync(
    path.join(options.workspaceDir, '.qwen/settings.json'),
    JSON.stringify(current),
  );
  fs.rmSync(path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'));
  const managed = installDesktopWorkspaceDefaults(options);
  assert.equal(managed.playwright, undefined);
  assert.equal(managed.serena, undefined);
  assert.equal(settings(options).mcpServers.playwright, undefined);
  assert.equal(
    fs.existsSync(
      path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'),
    ),
    false,
  );
});

test('project copies preserve effective custom user skills and agents', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.qwenHome, 'agents'));
  fs.mkdirSync(path.join(options.qwenHome, 'skills/example'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(options.qwenHome, 'agents/test-engineer.md'),
    'CUSTOM USER AGENT',
  );
  fs.writeFileSync(
    path.join(options.qwenHome, 'skills/example/SKILL.md'),
    'CUSTOM USER SKILL',
  );
  installDesktopWorkspaceDefaults(options);
  assert.equal(
    fs.readFileSync(
      path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'),
      'utf8',
    ),
    'CUSTOM USER AGENT',
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.workspaceDir, '.qwen/skills/example/SKILL.md'),
      'utf8',
    ),
    'CUSTOM USER SKILL',
  );
});

test('project initialization preserves deleted user skills and agents', () => {
  const options = fixture();
  fs.writeFileSync(path.join(options.qwenHome, '.desktop-defaults-v1'), '1\n');
  installDesktopWorkspaceDefaults(options);
  assert.equal(
    fs.existsSync(
      path.join(options.workspaceDir, '.qwen/agents/test-engineer.md'),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(options.workspaceDir, '.qwen/skills/example')),
    false,
  );
});

test('a new workspace preserves MCPs deleted from an initialized user profile', () => {
  const options = fixture();
  fs.writeFileSync(path.join(options.qwenHome, '.desktop-defaults-v1'), '1\n');
  const userPath = path.join(options.qwenHome, 'settings.json');
  const user = JSON.parse(fs.readFileSync(userPath, 'utf8'));
  delete user.mcpServers.serena;
  fs.writeFileSync(userPath, JSON.stringify(user));
  const managed = installDesktopWorkspaceDefaults(options);
  assert.equal(managed.serena, undefined);
  assert.equal(settings(options).mcpServers.serena, undefined);
});

test('moving app preserves portable definitions and installer ownership', () => {
  const options = fixture();
  const before = installDesktopWorkspaceDefaults(options);
  const moved = `${options.runtimeRoot} moved`;
  fs.renameSync(options.runtimeRoot, moved);
  assert.deepEqual(
    installDesktopWorkspaceDefaults({ ...options, runtimeRoot: moved }),
    before,
  );
});

test('an existing matching repository config is not automatically approved', () => {
  const options = fixture();
  const template = installDesktopWorkspaceDefaults(options);
  const other = {
    ...options,
    workspaceDir: path.join(path.dirname(options.workspaceDir), 'unowned'),
  };
  fs.mkdirSync(path.join(other.workspaceDir, '.qwen'), { recursive: true });
  fs.writeFileSync(
    path.join(other.workspaceDir, '.qwen/settings.json'),
    JSON.stringify({ mcpServers: template }),
  );
  assert.deepEqual(installDesktopWorkspaceDefaults(other), {});
});

test('invalid JSONC and symlinked settings fail without replacing user files', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.workspaceDir, '.qwen'));
  const file = path.join(options.workspaceDir, '.qwen/settings.json');
  fs.writeFileSync(file, '{bad');
  assert.throws(() => installDesktopWorkspaceDefaults(options), /invalid/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{bad');
  fs.rmSync(file);
  fs.symlinkSync(path.join(options.qwenHome, 'settings.json'), file);
  assert.throws(() => installDesktopWorkspaceDefaults(options), /symlink/);
});
