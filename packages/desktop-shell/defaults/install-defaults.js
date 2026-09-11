import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual, parseEnv } from 'node:util';
import { applyEdits, modify, parse } from 'jsonc-parser';
import { refreshDesktopSkillReferences } from './skill-references.js';

export function installDesktopDefaults({ runtimeRoot, qwenHome }) {
  configureServerTrust(runtimeRoot, qwenHome);
  const defaultsRoot = path.join(runtimeRoot, 'defaults');
  refreshDesktopSkillReferences({ defaultsRoot, qwenHome });
  migrateNativeReasoning(path.join(qwenHome, 'settings.json'));
  const initialMarker = path.join(qwenHome, '.desktop-defaults-v1');
  const previouslyInstalled = fs.existsSync(initialMarker);
  const previousMarker = path.join(qwenHome, '.desktop-defaults-v2');
  const languageMarker = path.join(qwenHome, '.desktop-defaults-v3');
  const marker = path.join(qwenHome, '.desktop-defaults-v4');
  if (fs.existsSync(marker)) return;

  const defaults = JSON.parse(
    fs.readFileSync(path.join(defaultsRoot, 'settings.json'), 'utf8'),
  );
  const settingsPath = path.join(qwenHome, 'settings.json');
  const hasUserSettings = fs.existsSync(settingsPath);
  let text = hasUserSettings ? fs.readFileSync(settingsPath, 'utf8') : '{}\n';
  const errors = [];
  const settings = parse(text, errors, { allowTrailingComma: true });
  if (
    errors.length ||
    !settings ||
    typeof settings !== 'object' ||
    Array.isArray(settings)
  ) {
    throw new Error(
      `Cannot initialize desktop defaults: invalid ${settingsPath}`,
    );
  }
  const set = (keys, value) => {
    text = applyEdits(
      text,
      modify(text, keys, value, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  };
  const initializeLanguage =
    !fs.existsSync(languageMarker) &&
    settings.general?.outputLanguage === undefined;
  if (initializeLanguage) {
    set(['general', 'outputLanguage'], defaults.general.outputLanguage);
  }
  for (const [key, value] of Object.entries(defaults.env)) {
    if (fs.existsSync(previousMarker)) break;
    if (!Object.hasOwn(settings.env ?? {}, key)) set(['env', key], value);
  }
  const provider = settings.modelProviders?.openai;
  const wrapped =
    provider && !Array.isArray(provider) && typeof provider === 'object';
  const models = (wrapped ? provider.models : provider) ?? [];
  for (const model of defaults.modelProviders.openai) {
    if (previouslyInstalled || fs.existsSync(previousMarker)) break;
    if (!models.some((existing) => existing.id === model.id)) {
      models.push(model);
      set(
        wrapped
          ? ['modelProviders', 'openai', 'models']
          : ['modelProviders', 'openai'],
        models,
      );
    }
  }
  for (const [name, config] of Object.entries(defaults.mcpServers)) {
    if (
      previouslyInstalled &&
      name !== 'playwright' &&
      name !== 'chrome-devtools'
    )
      continue;
    if (!Object.hasOwn(settings.mcpServers ?? {}, name)) {
      set(['mcpServers', name], config);
    }
  }
  if (
    !previouslyInstalled &&
    typeof settings.model !== 'string' &&
    !settings.model?.name &&
    !settings.selectedAuthType &&
    !settings.security?.auth?.selectedType
  ) {
    set(['model', 'name'], defaults.model.name);
    set(
      ['security', 'auth', 'selectedType'],
      defaults.security.auth.selectedType,
    );
    set(
      ['tools', 'exclude'],
      [
        ...new Set([
          ...(settings.tools?.exclude ?? []),
          ...defaults.tools.exclude,
        ]),
      ],
    );
  }
  if (!hasUserSettings && !previouslyInstalled)
    set(['$version'], defaults.$version);

  fs.mkdirSync(qwenHome, { recursive: true });
  for (const kind of ['skills', 'agents']) {
    if (previouslyInstalled) break;
    const sourceDir = path.join(defaultsRoot, kind);
    const targetDir = path.join(qwenHome, kind);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const name of fs.readdirSync(sourceDir)) {
      const destination = path.join(targetDir, name);
      if (fs.existsSync(destination)) continue;
      fs.cpSync(path.join(sourceDir, name), destination, { recursive: true });
      resolveSkillReferences(destination, qwenHome, defaultsRoot);
    }
  }
  const temporary = `${settingsPath}.desktop-${process.pid}.tmp`;
  try {
    if (initializeLanguage) {
      fs.copyFileSync(
        path.join(defaultsRoot, 'output-language.md'),
        path.join(qwenHome, 'output-language.md'),
      );
    }
    fs.writeFileSync(temporary, text, { mode: 0o600 });
    fs.renameSync(temporary, settingsPath);
    if (!previouslyInstalled)
      fs.writeFileSync(initialMarker, '1\n', { mode: 0o600 });
    fs.writeFileSync(previousMarker, '1\n', { mode: 0o600 });
    fs.writeFileSync(languageMarker, '1\n', { mode: 0o600 });
    fs.writeFileSync(marker, '1\n', { mode: 0o600 });
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function installDesktopWorkspaceDefaults({
  runtimeRoot,
  qwenHome,
  workspaceDir,
  rejectedMcpNames = [],
}) {
  const workspace = fs.realpathSync(workspaceDir);
  const projectHome = path.join(workspace, '.qwen');
  const defaultsRoot = path.join(runtimeRoot, 'defaults');
  const defaults = readSettings(path.join(defaultsRoot, 'settings.json'));
  const settingsPath = path.join(projectHome, 'settings.json');
  const receiptPath = path.join(
    qwenHome,
    'desktop-workspaces',
    `${createHash('sha256').update(workspace).digest('hex')}.json`,
  );
  for (const destination of [projectHome, settingsPath]) {
    if (
      fs.lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink()
    ) {
      throw new Error(
        `Cannot initialize workspace defaults through symlink: ${destination}`,
      );
    }
  }
  const userSettings = readSettings(path.join(qwenHome, 'settings.json'));
  migrateNativeReasoning(settingsPath, userSettings.model?.reasoningEffort);
  const definitions = Object.fromEntries(
    Object.entries(defaults.mcpServers).map(([name, server]) => [
      name,
      name === 'home-ai-research'
        ? server
        : {
            command: '${HOMECODE_MCP_NODE}',
            args: ['${HOMECODE_MCP_LAUNCHER}', name],
            timeout: 120000,
            description: {
              'node-repl':
                'Локальный Node.js REPL в выбранном рабочем пространстве.',
              serena:
                'Локальная Serena: семантическая навигация и редактирование выбранного проекта.',
              playwright:
                'Локальный Playwright: браузерная проверка проекта, включая localhost.',
              'chrome-devtools':
                'Локальный Chrome DevTools: навигация, JavaScript и снимки экрана.',
            }[name],
            ...(server.includeTools
              ? { includeTools: server.includeTools }
              : {}),
          },
    ]),
  );
  const settings = readSettings(settingsPath);
  const projectMcp = readSettings(path.join(workspace, '.mcp.json'));
  const canInherit = (name) => {
    const inherited = userSettings.mcpServers?.[name];
    if (inherited === undefined) {
      return !fs.existsSync(path.join(qwenHome, '.desktop-defaults-v1'));
    }
    return isDeepStrictEqual(
      { ...inherited, description: undefined },
      { ...defaults.mcpServers[name], description: undefined },
    );
  };
  let receipt;
  if (fs.existsSync(receiptPath)) {
    receipt = readSettings(receiptPath);
  } else {
    const names = Object.keys(definitions).filter((name) => {
      if (
        Object.hasOwn(settings.mcpServers ?? {}, name) ||
        Object.hasOwn(projectMcp.mcpServers ?? {}, name) ||
        rejectedMcpNames.includes(name)
      )
        return false;
      return canInherit(name);
    });
    let text = fs.existsSync(settingsPath)
      ? fs.readFileSync(settingsPath, 'utf8')
      : '{}\n';
    for (const name of names) {
      text = applyEdits(
        text,
        modify(text, ['mcpServers', name], definitions[name], {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    }
    fs.mkdirSync(projectHome, { recursive: true });
    for (const kind of ['skills', 'agents']) {
      const target = path.join(projectHome, kind);
      if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
        throw new Error(
          `Cannot initialize workspace defaults through symlink: ${target}`,
        );
      }
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(path.join(defaultsRoot, kind))) {
        const destination = path.join(target, name);
        if (fs.lstatSync(destination, { throwIfNoEntry: false })) continue;
        const inherited = path.join(qwenHome, kind, name);
        const hasInherited = fs.existsSync(inherited);
        if (
          !hasInherited &&
          fs.existsSync(path.join(qwenHome, '.desktop-defaults-v1'))
        )
          continue;
        // Upgrade the stock v4 agent without changing custom tool restrictions.
        const legacyTestEngineer =
          kind === 'agents' &&
          name === 'test-engineer.md' &&
          hasInherited &&
          createHash('sha256')
            .update(fs.readFileSync(inherited))
            .digest('hex') ===
            '11c41de1d3ebbd7329c84a09b4603d141234f1f8975709393fe651298550bd95';
        const useInherited = hasInherited && !legacyTestEngineer;
        fs.cpSync(
          useInherited ? inherited : path.join(defaultsRoot, kind, name),
          destination,
          {
            recursive: true,
          },
        );
        if (!useInherited)
          resolveSkillReferences(destination, projectHome, defaultsRoot);
      }
    }
    if (names.length) writeJsonText(settingsPath, text);
    receipt = { installedMcpNames: names };
    writeJsonText(receiptPath, `${JSON.stringify(receipt)}\n`);
  }
  const currentSettings = readSettings(settingsPath);
  const managedNames = new Set(receipt.installedMcpNames ?? []);
  let text = fs.existsSync(settingsPath)
    ? fs.readFileSync(settingsPath, 'utf8')
    : '{}\n';
  let migrated = false;
  for (const [name, definition] of Object.entries(definitions)) {
    if (
      rejectedMcpNames.includes(name) ||
      Object.hasOwn(projectMcp.mcpServers ?? {}, name) ||
      (!managedNames.has(name) && !canInherit(name))
    )
      continue;
    const current = currentSettings.mcpServers?.[name];
    if (isDeepStrictEqual(current, definition)) {
      managedNames.add(name);
    } else if (
      name !== 'home-ai-research' &&
      isDeepStrictEqual(current, defaults.mcpServers[name])
    ) {
      text = applyEdits(
        text,
        modify(text, ['mcpServers', name], definition, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
      currentSettings.mcpServers[name] = definition;
      managedNames.add(name);
      migrated = true;
    }
  }
  if (migrated) writeJsonText(settingsPath, text);
  if (managedNames.size !== (receipt.installedMcpNames?.length ?? 0)) {
    receipt.installedMcpNames = [...managedNames];
    writeJsonText(receiptPath, `${JSON.stringify(receipt)}\n`);
  }
  refreshDesktopSkillReferences({ defaultsRoot, qwenHome: projectHome });
  return Object.fromEntries(
    Object.entries(definitions).filter(
      ([name, definition]) =>
        managedNames.has(name) &&
        !rejectedMcpNames.includes(name) &&
        !Object.hasOwn(projectMcp.mcpServers ?? {}, name) &&
        isDeepStrictEqual(currentSettings.mcpServers?.[name], definition),
    ),
  );
}

function migrateNativeReasoning(settingsPath, inheritedReasoningEffort) {
  const settings = readSettings(settingsPath);
  const provider = settings.modelProviders?.openai;
  const wrapped =
    provider && !Array.isArray(provider) && typeof provider === 'object';
  if (
    wrapped &&
    provider.protocol !== undefined &&
    provider.protocol !== 'openai'
  )
    return;
  const models = wrapped ? provider.models : provider;
  if (!Array.isArray(models)) return;
  const original = fs.readFileSync(settingsPath, 'utf8');
  let text = original;
  for (const [index, model] of models.entries()) {
    if (
      model?.id !== 'local-coder' ||
      ![
        'https://biscet-server.local:9454/v1',
        'http://127.0.0.1:1235/v1',
      ].includes(model.baseUrl)
    )
      continue;
    const generation = model.generationConfig;
    const extra = generation?.extra_body;
    if (
      (generation !== undefined &&
        (!generation ||
          typeof generation !== 'object' ||
          Array.isArray(generation))) ||
      (extra !== undefined &&
        (!extra || typeof extra !== 'object' || Array.isArray(extra))) ||
      ![undefined, 'none', 'auto', 'deepseek', 'qwen'].includes(
        extra?.reasoning_format,
      )
    )
      continue;
    const keys = [
      'modelProviders',
      'openai',
      ...(wrapped ? ['models'] : []),
      index,
      'generationConfig',
    ];
    if (extra?.reasoning_format !== 'qwen') {
      text = applyEdits(
        text,
        modify(text, [...keys, 'extra_body', 'reasoning_format'], 'qwen', {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    }
    const disablesThinking =
      (settings.model?.reasoningEffort ?? inheritedReasoningEffort) ===
        'none' ||
      generation?.reasoning === false ||
      [
        extra,
        generation?.samplingParams,
        extra?.chat_template_kwargs,
        generation?.samplingParams?.chat_template_kwargs,
      ].some(
        (options) =>
          options?.enable_thinking === false ||
          options?.reasoning_effort === 'none',
      );
    if (generation?.thinkingMandatory === undefined && !disablesThinking) {
      text = applyEdits(
        text,
        modify(text, [...keys, 'thinkingMandatory'], true, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    }
  }
  if (text !== original) writeJsonText(settingsPath, text);
}

function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  const errors = [];
  const value = parse(fs.readFileSync(file, 'utf8'), errors, {
    allowTrailingComma: true,
  });
  if (
    errors.length ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(`Cannot initialize desktop defaults: invalid ${file}`);
  }
  return value;
}

function writeJsonText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.desktop-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, text, { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function configureServerTrust(runtimeRoot, qwenHome) {
  const certificatePath = path.join(
    runtimeRoot,
    'defaults',
    'home-ai-lan-ca.crt',
  );
  const certificate = fs.readFileSync(certificatePath, 'utf8');
  let existing = process.env.NODE_EXTRA_CA_CERTS;
  if (!existing) {
    for (const file of [
      path.join(qwenHome, '.env'),
      path.join(os.homedir(), '.qwen', '.env'),
      path.join(os.homedir(), '.env'),
    ]) {
      if (!fs.existsSync(file)) continue;
      existing = parseEnv(fs.readFileSync(file, 'utf8')).NODE_EXTRA_CA_CERTS;
      if (existing) break;
    }
  }
  if (!existing || existing === certificatePath) {
    process.env.NODE_EXTRA_CA_CERTS = certificatePath;
  } else {
    const combined = path.join(qwenHome, '.desktop-ca.pem');
    const previous = fs.readFileSync(existing, 'utf8');
    fs.mkdirSync(qwenHome, { recursive: true });
    fs.writeFileSync(
      combined,
      previous.includes(certificate.trim())
        ? previous
        : `${previous}\n${certificate}`,
    );
    process.env.NODE_EXTRA_CA_CERTS = combined;
  }
}

function resolveSkillReferences(file, qwenHome, defaultsRoot) {
  if (fs.statSync(file).isDirectory()) {
    for (const name of fs.readdirSync(file)) {
      resolveSkillReferences(path.join(file, name), qwenHome, defaultsRoot);
    }
  } else if (file.endsWith('.md')) {
    const text = fs
      .readFileSync(file, 'utf8')
      .replace(/\.qwen\/(skills\/[\w./-]+)/g, (reference, relative) => {
        if (
          !fs
            .statSync(path.join(defaultsRoot, relative), {
              throwIfNoEntry: false,
            })
            ?.isFile()
        )
          return reference;
        return `'${path.join(qwenHome, relative).replaceAll("'", "'\\''")}'`;
      });
    fs.writeFileSync(file, text);
  }
}
