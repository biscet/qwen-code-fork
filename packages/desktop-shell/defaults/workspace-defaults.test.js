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

test('output budget migration upgrades an existing workspace receipt once without changing user or MCP settings', () => {
  for (const wrapped of [false, true]) {
    const options = fixture();
    installDesktopWorkspaceDefaults(options);
    const projectHome = path.join(options.workspaceDir, '.qwen');
    const file = path.join(projectHome, 'settings.json');
    fs.rmSync(path.join(projectHome, '.desktop-output-budget-v1'));
    const receiptDir = path.join(options.qwenHome, 'desktop-workspaces');
    const receiptFile = path.join(receiptDir, fs.readdirSync(receiptDir)[0]);
    const receipt = fs.readFileSync(receiptFile, 'utf8');
    const userFile = path.join(options.qwenHome, 'settings.json');
    const user = fs.readFileSync(userFile, 'utf8');
    const current = settings(options);
    delete current.mcpServers.playwright;
    current.mcpServers.serena.command = 'custom-serena';
    const model = {
      id: 'windows-lmstudio/windows-qwen35-9b',
      baseUrl: 'https://192.168.31.79:9447/v1',
      generationConfig: {
        samplingParams: { max_tokens: 8192 },
        extra_body: { reasoning_format: 'qwen', reasoning_budget_tokens: 8192 },
      },
    };
    current.model = { name: model.id, reasoningEffort: 'xhigh' };
    current.modelProviders = {
      openai: wrapped ? { protocol: 'openai', models: [model] } : [model],
    };
    fs.writeFileSync(
      file,
      `{\n// Keep workspace comment\n${JSON.stringify(current).slice(1, -1)},\n}\n`,
    );
    const managed = installDesktopWorkspaceDefaults(options);
    model.generationConfig.samplingParams.max_tokens = 16384;
    assert.deepEqual(settings(options), current);
    assert.equal(model.generationConfig.thinkingMandatory, undefined);
    assert.equal(managed.playwright, undefined);
    assert.equal(managed.serena, undefined);
    assert.equal(fs.readFileSync(userFile, 'utf8'), user);
    assert.equal(fs.readFileSync(receiptFile, 'utf8'), receipt);
    assert.match(fs.readFileSync(file, 'utf8'), /Keep workspace comment/);
    const stat = fs.statSync(file);
    installDesktopWorkspaceDefaults(options);
    assert.equal(fs.statSync(file).ino, stat.ino);
    assert.equal(fs.statSync(file).mtimeMs, stat.mtimeMs);
    model.generationConfig.samplingParams.max_tokens = 8192;
    const intentional = JSON.stringify(current);
    fs.writeFileSync(file, intentional);
    installDesktopWorkspaceDefaults(options);
    assert.equal(fs.readFileSync(file, 'utf8'), intentional);
    assert.equal(fs.readFileSync(receiptFile, 'utf8'), receipt);
    fs.rmSync(file);
    installDesktopWorkspaceDefaults(options);
    assert.equal(fs.existsSync(file), false);
  }
});

test('output budget migration preserves inherited disabled thinking and deleted workspace models', () => {
  for (const hasModel of [false, true]) {
    const options = fixture();
    const userFile = path.join(options.qwenHome, 'settings.json');
    const user = parse(fs.readFileSync(userFile, 'utf8'));
    user.model.reasoningEffort = 'none';
    fs.writeFileSync(userFile, JSON.stringify(user));
    const projectHome = path.join(options.workspaceDir, '.qwen');
    fs.mkdirSync(projectHome);
    const file = path.join(projectHome, 'settings.json');
    const models = hasModel
      ? [
          {
            id: 'windows-lmstudio/windows-qwen35-9b',
            baseUrl: 'https://192.168.31.79:9447/v1',
            generationConfig: { samplingParams: { max_tokens: 8192 } },
          },
        ]
      : [];
    fs.writeFileSync(
      file,
      JSON.stringify({ modelProviders: { openai: models } }),
    );
    installDesktopWorkspaceDefaults(options);
    assert.deepEqual(settings(options).modelProviders.openai, models);
  }
});

test('native reasoning migration updates owned workspace routes without changing MCP receipts or overrides', () => {
  for (const baseUrl of [
    'https://biscet-server.local:9454/v1',
    'http://127.0.0.1:1235/v1',
  ]) {
    for (const wrapped of [false, true]) {
      const options = fixture();
      installDesktopWorkspaceDefaults(options);
      const file = path.join(options.workspaceDir, '.qwen/settings.json');
      const receiptDir = path.join(options.qwenHome, 'desktop-workspaces');
      const receiptFile = path.join(receiptDir, fs.readdirSync(receiptDir)[0]);
      const receipt = fs.readFileSync(receiptFile, 'utf8');
      const userFile = path.join(options.qwenHome, 'settings.json');
      const user = fs.readFileSync(userFile, 'utf8');
      const current = settings(options);
      delete current.mcpServers.playwright;
      current.mcpServers.serena.command = 'custom-serena';
      const models = [
        {
          id: 'local-coder',
          baseUrl,
          generationConfig: {
            temperature: 0.21,
            extra_body: { reasoning_format: 'none', custom: false },
          },
        },
      ];
      current.modelProviders = {
        openai: wrapped ? { protocol: 'openai', models } : models,
      };
      fs.writeFileSync(
        file,
        `{\n// keep workspace comment\n${JSON.stringify(current).slice(1, -1)},\n}\n`,
      );

      const managed = installDesktopWorkspaceDefaults(options);
      models[0].generationConfig.extra_body.reasoning_format = 'qwen';
      models[0].generationConfig.thinkingMandatory = true;
      assert.deepEqual(settings(options), current);
      assert.equal(managed.playwright, undefined);
      assert.equal(managed.serena, undefined);
      assert.equal(fs.readFileSync(receiptFile, 'utf8'), receipt);
      assert.equal(fs.readFileSync(userFile, 'utf8'), user);
      const migrated = fs.readFileSync(file, 'utf8');
      assert.match(migrated, /\/\/ keep workspace comment/);
      const stat = fs.statSync(file);
      installDesktopWorkspaceDefaults(options);
      assert.equal(fs.readFileSync(file, 'utf8'), migrated);
      assert.equal(fs.statSync(file).mtimeMs, stat.mtimeMs);
      assert.equal(fs.statSync(file).ino, stat.ino);
      assert.equal(fs.readFileSync(receiptFile, 'utf8'), receipt);
    }
  }
});

test('mandatory thinking migration respects inherited and overridden user effort', () => {
  for (const [workspaceEffort, mandatory] of [
    [undefined, undefined],
    ['none', undefined],
    ['high', true],
  ]) {
    const options = fixture();
    installDesktopWorkspaceDefaults(options);
    const userFile = path.join(options.qwenHome, 'settings.json');
    const user = parse(fs.readFileSync(userFile, 'utf8'));
    user.model.reasoningEffort = 'none';
    const userText = JSON.stringify(user);
    fs.writeFileSync(userFile, userText);
    const file = path.join(options.workspaceDir, '.qwen/settings.json');
    const current = settings(options);
    current.model = { reasoningEffort: workspaceEffort };
    current.modelProviders = {
      openai: [
        {
          id: 'local-coder',
          baseUrl: 'https://biscet-server.local:9454/v1',
          generationConfig: { extra_body: { reasoning_format: 'none' } },
        },
      ],
    };
    fs.writeFileSync(file, JSON.stringify(current));

    installDesktopWorkspaceDefaults(options);

    const migrated = settings(options);
    const generation = migrated.modelProviders.openai[0].generationConfig;
    assert.equal(generation.extra_body.reasoning_format, 'qwen');
    assert.equal(generation.thinkingMandatory, mandatory);
    assert.equal(migrated.model.reasoningEffort, workspaceEffort);
    assert.equal(fs.readFileSync(userFile, 'utf8'), userText);
  }
});

test('native reasoning migration preserves custom workspace routes and does not restore deleted settings', () => {
  const options = fixture();
  installDesktopWorkspaceDefaults(options);
  const file = path.join(options.workspaceDir, '.qwen/settings.json');
  const models = [
    { id: 'local-coder', baseUrl: 'https://custom.example/v1' },
    { id: 'other-model', baseUrl: 'http://127.0.0.1:1235/v1' },
    {
      id: 'local-coder',
      baseUrl: 'http://127.0.0.1:1235/v1',
      generationConfig: { extra_body: { reasoning_format: 'custom' } },
    },
  ];
  const original = `// keep custom routes\n${JSON.stringify({ modelProviders: { openai: models } })}\n`;
  fs.writeFileSync(file, original);
  const stat = fs.statSync(file);
  assert.deepEqual(installDesktopWorkspaceDefaults(options), {});
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(fs.statSync(file).mtimeMs, stat.mtimeMs);
  assert.equal(fs.statSync(file).ino, stat.ino);
  fs.rmSync(file);
  assert.deepEqual(installDesktopWorkspaceDefaults(options), {});
  assert.equal(fs.existsSync(file), false);
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

test('adopts copied exact bundled workspace definitions on another profile', () => {
  const options = fixture();
  const template = installDesktopWorkspaceDefaults(options);
  const other = fixture();
  fs.mkdirSync(path.join(other.workspaceDir, '.qwen'), { recursive: true });
  fs.writeFileSync(
    path.join(other.workspaceDir, '.qwen/settings.json'),
    JSON.stringify({ mcpServers: template }),
  );
  assert.deepEqual(installDesktopWorkspaceDefaults(other), template);
});

test('adopts exact definitions when an older launch recorded an empty receipt', () => {
  const options = fixture();
  const managed = installDesktopWorkspaceDefaults(options);
  const receiptDir = path.join(options.qwenHome, 'desktop-workspaces');
  const receipt = path.join(receiptDir, fs.readdirSync(receiptDir)[0]);
  fs.writeFileSync(receipt, JSON.stringify({ installedMcpNames: [] }));
  assert.deepEqual(installDesktopWorkspaceDefaults(options), managed);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(receipt)).installedMcpNames.sort(),
    Object.keys(managed).sort(),
  );
});

test('migrates only exact stock remote defaults to local workspace servers', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.workspaceDir, '.qwen'));
  const servers = JSON.parse(
    fs.readFileSync(path.join(options.qwenHome, 'settings.json')),
  ).mcpServers;
  servers.serena.headers.Authorization = 'Bearer custom';
  servers['chrome-devtools'].includeTools = ['custom_tool'];
  const file = path.join(options.workspaceDir, '.qwen/settings.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ mcpServers: servers, mcp: { excluded: ['playwright'] } }),
  );
  const managed = installDesktopWorkspaceDefaults(options);
  assert.equal(managed['node-repl'].command, '${HOMECODE_MCP_NODE}');
  assert.equal(managed.playwright.command, '${HOMECODE_MCP_NODE}');
  assert.equal(
    managed['home-ai-research'].httpUrl,
    servers['home-ai-research'].httpUrl,
  );
  assert.deepEqual(settings(options).mcp.excluded, ['playwright']);
  assert.deepEqual(settings(options).mcpServers.serena, servers.serena);
  assert.deepEqual(
    settings(options).mcpServers['chrome-devtools'],
    servers['chrome-devtools'],
  );
  assert.equal(managed.serena, undefined);
});

test('preserves rejected remote definitions and project MCP collisions even with a receipt', () => {
  const options = fixture();
  installDesktopWorkspaceDefaults(options);
  const current = settings(options);
  const defaults = JSON.parse(
    fs.readFileSync(path.join(options.qwenHome, 'settings.json')),
  ).mcpServers;
  current.mcpServers.serena = defaults.serena;
  fs.writeFileSync(
    path.join(options.workspaceDir, '.qwen/settings.json'),
    JSON.stringify(current),
  );
  fs.writeFileSync(
    path.join(options.workspaceDir, '.mcp.json'),
    JSON.stringify({
      mcpServers: { playwright: { command: 'custom-project' } },
    }),
  );
  const managed = installDesktopWorkspaceDefaults({
    ...options,
    rejectedMcpNames: ['serena'],
  });
  assert.equal(managed.serena, undefined);
  assert.equal(managed.playwright, undefined);
  assert.deepEqual(settings(options).mcpServers.serena, defaults.serena);
});

test('does not adopt copied definitions for customized or deleted user defaults', () => {
  const options = fixture();
  const managed = installDesktopWorkspaceDefaults(options);
  const receiptDir = path.join(options.qwenHome, 'desktop-workspaces');
  fs.writeFileSync(
    path.join(receiptDir, fs.readdirSync(receiptDir)[0]),
    JSON.stringify({ installedMcpNames: [] }),
  );
  fs.writeFileSync(path.join(options.qwenHome, '.desktop-defaults-v1'), '1\n');
  const userFile = path.join(options.qwenHome, 'settings.json');
  const user = JSON.parse(fs.readFileSync(userFile));
  delete user.mcpServers.serena;
  user.mcpServers['node-repl'] = { command: 'custom-node' };
  fs.writeFileSync(userFile, JSON.stringify(user));
  const adopted = installDesktopWorkspaceDefaults(options);
  assert.equal(adopted.serena, undefined);
  assert.equal(adopted['node-repl'], undefined);
  assert.deepEqual(settings(options).mcpServers, managed);
});

test('invalid JSONC and symlinked settings fail without replacing user files', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.workspaceDir, '.qwen'));
  const file = path.join(options.workspaceDir, '.qwen/settings.json');
  fs.writeFileSync(file, '{bad');
  assert.throws(() => installDesktopWorkspaceDefaults(options), /invalid/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{bad');
  fs.rmSync(file);
  const userFile = path.join(options.qwenHome, 'settings.json');
  const user = parse(fs.readFileSync(userFile, 'utf8'));
  user.modelProviders.openai[0].generationConfig.samplingParams.max_tokens = 8192;
  const userText = JSON.stringify(user);
  fs.writeFileSync(userFile, userText);
  fs.symlinkSync(path.join(options.qwenHome, 'settings.json'), file);
  assert.throws(() => installDesktopWorkspaceDefaults(options), /symlink/);
  assert.equal(fs.readFileSync(userFile, 'utf8'), userText);
  assert.equal(
    fs.existsSync(
      path.join(options.workspaceDir, '.qwen/.desktop-output-budget-v1'),
    ),
    false,
  );
});
