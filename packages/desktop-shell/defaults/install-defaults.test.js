import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse } from 'jsonc-parser';
import { installDesktopDefaults } from './install-defaults.js';

const source = path.dirname(fileURLToPath(import.meta.url));
const directories = [];
const originalCa = process.env.NODE_EXTRA_CA_CERTS;
const originalHome = process.env.HOME;
afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalCa === undefined) delete process.env.NODE_EXTRA_CA_CERTS;
  else process.env.NODE_EXTRA_CA_CERTS = originalCa;
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  delete process.env.NODE_EXTRA_CA_CERTS;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homecode defaults '));
  directories.push(root);
  process.env.HOME = path.join(root, 'os-home');
  fs.mkdirSync(process.env.HOME);
  const runtimeRoot = path.join(root, 'HomeCode.app', 'runtime');
  const qwenHome = path.join(root, 'user profile');
  const defaults = path.join(runtimeRoot, 'defaults');
  fs.mkdirSync(path.join(defaults, 'skills', 'example'), { recursive: true });
  fs.mkdirSync(path.join(defaults, 'agents'));
  for (const name of [
    'settings.json',
    'home-ai-lan-ca.crt',
    'output-language.md',
  ]) {
    fs.copyFileSync(path.join(source, name), path.join(defaults, name));
  }
  fs.writeFileSync(
    path.join(defaults, 'skills', 'example', 'SKILL.md'),
    'Run node .qwen/skills/example/helper.js',
  );
  fs.writeFileSync(
    path.join(defaults, 'skills', 'example', 'helper.js'),
    'console.log(4);',
  );
  fs.writeFileSync(
    path.join(defaults, 'agents', 'test-engineer.md'),
    'test engineer',
  );
  return { runtimeRoot, qwenHome };
}

test('clean installation adds remote MCPs, model, skills and agent without credentials', () => {
  const options = fixture();
  installDesktopDefaults(options);
  const text = fs.readFileSync(
    path.join(options.qwenHome, 'settings.json'),
    'utf8',
  );
  const settings = JSON.parse(text);
  assert.equal(settings.general.outputLanguage, 'Russian');
  assert.match(
    fs.readFileSync(path.join(options.qwenHome, 'output-language.md'), 'utf8'),
    /You MUST always respond in \*\*Russian\*\*/,
  );
  assert.equal(settings.model.name, 'local-coder');
  assert.deepEqual(settings.tools.exclude, ['report_findings']);
  assert.equal(
    settings.modelProviders.openai[0].generationConfig.contextWindowSize,
    131072,
  );
  assert.equal(settings.modelProviders.openai[0].envKey, 'LOCAL_QWEN_API_KEY');
  assert.deepEqual(
    settings.modelProviders.openai.map(({ id }) => id),
    ['local-coder', 'codestral-latest', 'gpt-oss'],
  );
  for (const model of settings.modelProviders.openai.slice(1)) {
    assert.equal(model.baseUrl, 'https://api.llm7.io/v1');
    assert.equal(model.envKey, 'HOMECODE_LLM7_API_KEY');
    assert.equal(settings.env[model.envKey], 'unused');
    assert.equal(model.apiKey, undefined);
  }
  assert.deepEqual(settings.env, { HOMECODE_LLM7_API_KEY: 'unused' });
  assert.deepEqual(Object.keys(settings.mcpServers).sort(), [
    'chrome-devtools',
    'home-ai-research',
    'node-repl',
    'playwright',
    'serena',
  ]);
  for (const name of ['playwright', 'chrome-devtools']) {
    assert.equal(
      settings.mcpServers[name].httpUrl,
      `https://biscet-server.local:9454/${name}/mcp`,
    );
  }
  for (const config of Object.values(settings.mcpServers)) {
    assert.match(config.httpUrl, /^https:\/\/biscet-server\.local:9454\//);
    assert.equal(config.command, undefined);
    assert.equal(config.headers.Authorization, 'Bearer ${LOCAL_QWEN_API_KEY}');
  }
  assert.doesNotMatch(text, /\/Users\/eprokhorov|127\.0\.0\.1/);
  const skill = fs.readFileSync(
    path.join(options.qwenHome, 'skills/example/SKILL.md'),
    'utf8',
  );
  assert.ok(skill.includes(`'${options.qwenHome}/skills/example/helper.js'`));
  assert.equal(
    fs.readFileSync(
      path.join(options.qwenHome, 'agents/test-engineer.md'),
      'utf8',
    ),
    'test engineer',
  );
});

test('v2 upgrade adds Russian without restoring deleted defaults, then preserves later changes', () => {
  const options = fixture();
  fs.mkdirSync(options.qwenHome);
  for (const marker of ['.desktop-defaults-v1', '.desktop-defaults-v2']) {
    fs.writeFileSync(path.join(options.qwenHome, marker), '1\n');
  }
  const settingsPath = path.join(options.qwenHome, 'settings.json');
  const languagePath = path.join(options.qwenHome, 'output-language.md');
  fs.writeFileSync(
    settingsPath,
    '{\n  // existing profile\n  "agents": { "maxParallelAgents": 2 }\n}\n',
  );
  fs.writeFileSync(languagePath, '# Output language preference: auto\n');
  installDesktopDefaults(options);
  const installed = parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(Object.keys(installed.mcpServers).sort(), [
    'chrome-devtools',
    'playwright',
  ]);
  delete installed.mcpServers;
  assert.deepEqual(installed, {
    agents: { maxParallelAgents: 2 },
    general: { outputLanguage: 'Russian' },
  });
  assert.match(fs.readFileSync(languagePath, 'utf8'), /\*\*Russian\*\*/);
  fs.writeFileSync(settingsPath, '{"general":{"outputLanguage":"English"}}');
  fs.writeFileSync(languagePath, 'custom English rule');
  installDesktopDefaults(options);
  assert.equal(fs.readFileSync(languagePath, 'utf8'), 'custom English rule');
  assert.equal(
    JSON.parse(fs.readFileSync(settingsPath, 'utf8')).general.outputLanguage,
    'English',
  );
});

test('language migration preserves an explicit existing language and instruction', () => {
  const options = fixture();
  fs.mkdirSync(options.qwenHome);
  const languagePath = path.join(options.qwenHome, 'output-language.md');
  fs.writeFileSync(
    path.join(options.qwenHome, 'settings.json'),
    '{"general":{"outputLanguage":"auto"}}',
  );
  fs.writeFileSync(languagePath, 'my language instructions');
  installDesktopDefaults(options);
  assert.equal(
    fs.readFileSync(languagePath, 'utf8'),
    'my language instructions',
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(options.qwenHome, 'settings.json'), 'utf8'),
    ).general.outputLanguage,
    'auto',
  );
});

test('existing JSONC, provider selection, MCP, edited files and later deletions survive', () => {
  const options = fixture();
  fs.mkdirSync(path.join(options.qwenHome, 'skills/example'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(options.qwenHome, 'skills/example/SKILL.md'),
    'my skill',
  );
  const settingsPath = path.join(options.qwenHome, 'settings.json');
  fs.writeFileSync(
    settingsPath,
    `{
  // Keep my profile and credential.
  "$version": 4,
  "model": { "name": "other", "baseUrl": "https://example.com/v1" },
  "security": { "auth": { "selectedType": "anthropic" } },
  "modelProviders": { "openai": [{ "id": "local-coder", "baseUrl": "https://custom.example/v1" }] },
  "mcpServers": { "serena": { "command": "my-serena", "disabled": true } },
  "skills": { "disabled": ["example"] },
  "env": { "LOCAL_QWEN_API_KEY": "private-test-value" },
}\n`,
  );
  installDesktopDefaults(options);
  const installed = fs.readFileSync(settingsPath, 'utf8');
  assert.match(installed, /Keep my profile and credential/);
  const settings = parse(installed);
  assert.equal(settings.model.name, 'other');
  assert.equal(settings.model.baseUrl, 'https://example.com/v1');
  assert.equal(settings.security.auth.selectedType, 'anthropic');
  assert.deepEqual(settings.modelProviders.openai[0], {
    id: 'local-coder',
    baseUrl: 'https://custom.example/v1',
  });
  assert.deepEqual(settings.mcpServers.serena, {
    command: 'my-serena',
    disabled: true,
  });
  assert.deepEqual(settings.skills.disabled, ['example']);
  assert.equal(settings.env.LOCAL_QWEN_API_KEY, 'private-test-value');
  assert.equal(
    fs.readFileSync(
      path.join(options.qwenHome, 'skills/example/SKILL.md'),
      'utf8',
    ),
    'my skill',
  );
  delete settings.mcpServers['node-repl'];
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  fs.unlinkSync(path.join(options.qwenHome, 'agents/test-engineer.md'));
  installDesktopDefaults(options);
  assert.equal(
    parse(fs.readFileSync(settingsPath, 'utf8')).mcpServers['node-repl'],
    undefined,
  );
  assert.equal(
    fs.existsSync(path.join(options.qwenHome, 'agents/test-engineer.md')),
    false,
  );
});

test('invalid settings are never overwritten or marked installed', () => {
  const options = fixture();
  fs.mkdirSync(options.qwenHome);
  const settingsPath = path.join(options.qwenHome, 'settings.json');
  fs.writeFileSync(settingsPath, '{ broken');
  assert.throws(() => installDesktopDefaults(options), /invalid/);
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), '{ broken');
  assert.equal(
    fs.existsSync(path.join(options.qwenHome, '.desktop-defaults-v1')),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(options.qwenHome, '.desktop-defaults-v2')),
    false,
  );
});

test('legacy profiles retain their selection and still undergo CLI migration', () => {
  for (const legacy of [
    { selectedAuthType: 'anthropic', disableAutoUpdate: true },
    { model: 'my-model', selectedAuthType: 'anthropic' },
  ]) {
    const options = fixture();
    fs.mkdirSync(options.qwenHome);
    const settingsPath = path.join(options.qwenHome, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(legacy));
    installDesktopDefaults(options);
    const installed = parse(fs.readFileSync(settingsPath, 'utf8'));
    for (const [key, value] of Object.entries(legacy)) {
      assert.deepEqual(installed[key], value);
    }
    assert.equal(installed.$version, undefined);
    assert.equal(installed.security, undefined);
  }
});

test('v5 wrapped providers retain their model entries and migration version', () => {
  const options = fixture();
  fs.mkdirSync(options.qwenHome);
  const settingsPath = path.join(options.qwenHome, 'settings.json');
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      $version: 5,
      model: { name: 'existing' },
      modelProviders: {
        openai: { protocol: 'openai', models: [{ id: 'existing' }] },
      },
    }),
  );
  installDesktopDefaults(options);
  const installed = parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(installed.$version, 5);
  assert.equal(installed.model.name, 'existing');
  assert.equal(installed.modelProviders.openai.protocol, 'openai');
  assert.deepEqual(
    installed.modelProviders.openai.models.map(({ id }) => id),
    ['existing', 'local-coder', 'codestral-latest', 'gpt-oss'],
  );
});

test('v1 upgrade adds missing free models once and preserves existing choices and deletions', () => {
  for (const wrapped of [false, true]) {
    const options = fixture();
    fs.mkdirSync(options.qwenHome);
    fs.writeFileSync(
      path.join(options.qwenHome, '.desktop-defaults-v1'),
      '1\n',
    );
    const customModel = {
      id: 'codestral-latest',
      name: 'My Codestral',
      baseUrl: 'https://custom.example/v1',
      envKey: 'MY_MODEL_KEY',
    };
    const settingsPath = path.join(options.qwenHome, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        $version: wrapped ? 5 : 4,
        model: { name: 'codestral-latest' },
        modelProviders: {
          openai: wrapped
            ? { protocol: 'openai', models: [customModel] }
            : [customModel],
        },
        mcpServers: {},
        tools: { exclude: [] },
        env: { HOMECODE_LLM7_API_KEY: 'my-existing-test-value' },
      }),
    );
    installDesktopDefaults(options);
    const installed = parse(fs.readFileSync(settingsPath, 'utf8'));
    const models = wrapped
      ? installed.modelProviders.openai.models
      : installed.modelProviders.openai;
    assert.deepEqual(
      models.map(({ id }) => id),
      ['codestral-latest', 'gpt-oss'],
    );
    assert.deepEqual(models[0], customModel);
    assert.equal(installed.model.name, 'codestral-latest');
    assert.equal(installed.security, undefined);
    assert.deepEqual(Object.keys(installed.mcpServers).sort(), [
      'chrome-devtools',
      'playwright',
    ]);
    assert.deepEqual(installed.tools.exclude, []);
    assert.equal(installed.env.HOMECODE_LLM7_API_KEY, 'my-existing-test-value');
    assert.equal(fs.existsSync(path.join(options.qwenHome, 'skills')), false);
    assert.equal(fs.existsSync(path.join(options.qwenHome, 'agents')), false);
    if (wrapped)
      assert.equal(installed.modelProviders.openai.protocol, 'openai');
    models.pop();
    fs.writeFileSync(settingsPath, JSON.stringify(installed));
    const afterDeletion = fs.readFileSync(settingsPath, 'utf8');
    installDesktopDefaults(options);
    assert.equal(fs.readFileSync(settingsPath, 'utf8'), afterDeletion);
  }
});

for (const version of [1, 2, 3]) {
  for (const customName of ['playwright', 'chrome-devtools']) {
    test(`v${version} upgrade preserves custom ${customName} and adds only the missing browser MCP once`, () => {
      const options = fixture();
      fs.mkdirSync(options.qwenHome);
      for (let marker = 1; marker <= version; marker++) {
        fs.writeFileSync(
          path.join(options.qwenHome, `.desktop-defaults-v${marker}`),
          '1\n',
        );
      }
      const customMcp = { command: `my-${customName}`, disabled: true };
      const settingsPath = path.join(options.qwenHome, 'settings.json');
      fs.writeFileSync(
        settingsPath,
        `{
  // Keep the custom browser and deleted legacy defaults.
  "model": { "name": "my-model" },
  "mcpServers": ${JSON.stringify({ [customName]: customMcp })}
}\n`,
      );
      installDesktopDefaults(options);
      const text = fs.readFileSync(settingsPath, 'utf8');
      assert.match(text, /Keep the custom browser and deleted legacy defaults/);
      const installed = parse(text);
      assert.deepEqual(installed.mcpServers[customName], customMcp);
      assert.deepEqual(Object.keys(installed.mcpServers).sort(), [
        'chrome-devtools',
        'playwright',
      ]);
      const addedName =
        customName === 'playwright' ? 'chrome-devtools' : 'playwright';
      assert.equal(
        installed.mcpServers[addedName].httpUrl,
        `https://biscet-server.local:9454/${addedName}/mcp`,
      );
      assert.equal(
        installed.mcpServers[addedName].headers.Authorization,
        'Bearer ${LOCAL_QWEN_API_KEY}',
      );
      assert.deepEqual(installed.model, { name: 'my-model' });
      assert.equal(fs.existsSync(path.join(options.qwenHome, 'skills')), false);
      if (version >= 2) {
        assert.equal(installed.modelProviders, undefined);
        assert.equal(installed.env, undefined);
      }
      if (version === 3) {
        assert.equal(installed.general, undefined);
        assert.equal(
          fs.existsSync(path.join(options.qwenHome, 'output-language.md')),
          false,
        );
      }
      assert.equal(
        fs.existsSync(path.join(options.qwenHome, '.desktop-defaults-v4')),
        true,
      );
      delete installed.mcpServers;
      fs.writeFileSync(settingsPath, JSON.stringify(installed));
      const afterDeletion = fs.readFileSync(settingsPath, 'utf8');
      installDesktopDefaults(options);
      assert.equal(fs.readFileSync(settingsPath, 'utf8'), afterDeletion);
    });
  }
}

test('extra CA certificates are preserved across restarts and app relocation', () => {
  const options = fixture();
  const existing = path.join(path.dirname(options.qwenHome), 'existing.pem');
  fs.writeFileSync(existing, 'existing-public-ca\n');
  process.env.NODE_EXTRA_CA_CERTS = existing;
  installDesktopDefaults(options);
  const combined = process.env.NODE_EXTRA_CA_CERTS;
  const first = fs.readFileSync(combined, 'utf8');
  assert.match(first, /^existing-public-ca/);
  assert.match(first, /BEGIN CERTIFICATE/);
  const moved = `${options.runtimeRoot} moved`;
  fs.renameSync(options.runtimeRoot, moved);
  installDesktopDefaults({ ...options, runtimeRoot: moved });
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, combined);
  assert.equal(fs.readFileSync(combined, 'utf8'), first);
});

test('home-scoped CA settings preserve profile and process precedence', () => {
  for (const scope of ['home', 'profile', 'process']) {
    const options = fixture();
    fs.mkdirSync(options.qwenHome);
    const homeCa = path.join(process.env.HOME, 'operator.pem');
    const profileCa = path.join(options.qwenHome, 'operator.pem');
    const processCa = path.join(options.qwenHome, 'process.pem');
    fs.writeFileSync(homeCa, 'home-public-ca\n');
    fs.writeFileSync(profileCa, 'profile-public-ca\n');
    fs.writeFileSync(processCa, 'process-public-ca\n');
    fs.writeFileSync(
      path.join(process.env.HOME, '.env'),
      `NODE_EXTRA_CA_CERTS="${homeCa}"\n`,
    );
    if (scope !== 'home') {
      fs.writeFileSync(
        path.join(options.qwenHome, '.env'),
        `NODE_EXTRA_CA_CERTS="${profileCa}"\n`,
      );
    }
    if (scope === 'process') process.env.NODE_EXTRA_CA_CERTS = processCa;
    installDesktopDefaults(options);
    const combined = fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS, 'utf8');
    assert.ok(combined.startsWith(`${scope}-public-ca\n`));
    assert.match(combined, /BEGIN CERTIFICATE/);
  }
});

test('production desktop entry initializes resolved QWEN_HOME and loads CA before CLI', async () => {
  const options = fixture();
  const lib = path.join(options.runtimeRoot, 'lib');
  fs.mkdirSync(lib);
  fs.writeFileSync(
    path.join(lib, 'package.json'),
    '{"type":"module","version":"0.0.0-test"}',
  );
  fs.copyFileSync(
    path.resolve(source, '../../..', 'scripts/cli-entry.js'),
    path.join(lib, 'cli-entry.js'),
  );
  await build({
    entryPoints: [path.join(source, 'install-defaults.js')],
    outfile: path.join(lib, 'desktop-defaults.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    mainFields: ['module', 'main'],
  });
  fs.writeFileSync(
    path.join(lib, 'cli.js'),
    `import fs from 'node:fs'; import tls from 'node:tls'; console.log(JSON.stringify({ settings: JSON.parse(fs.readFileSync(process.env.QWEN_HOME + '/settings.json')), extraCAs: tls.getCACertificates('extra').length }));`,
  );
  const home = path.join(path.dirname(options.qwenHome), 'home');
  fs.mkdirSync(home);
  fs.writeFileSync(
    path.join(home, '.env'),
    `QWEN_HOME="${options.qwenHome}"\n`,
  );
  const env = { ...process.env, HOME: home, QWEN_CODE_DESKTOP: '1' };
  delete env.QWEN_HOME;
  delete env.NODE_EXTRA_CA_CERTS;
  const result = spawnSync(
    process.execPath,
    [path.join(lib, 'cli-entry.js'), 'serve'],
    { env, encoding: 'utf8', timeout: 15000 },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.settings.model.name, 'local-coder');
  assert.ok(output.extraCAs > 0);
});
