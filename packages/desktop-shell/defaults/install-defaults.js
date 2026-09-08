import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';
import { applyEdits, modify, parse } from 'jsonc-parser';

export function installDesktopDefaults({ runtimeRoot, qwenHome }) {
  configureServerTrust(runtimeRoot, qwenHome);
  const initialMarker = path.join(qwenHome, '.desktop-defaults-v1');
  const previouslyInstalled = fs.existsSync(initialMarker);
  const marker = path.join(qwenHome, '.desktop-defaults-v2');
  if (fs.existsSync(marker)) return;

  const defaultsRoot = path.join(runtimeRoot, 'defaults');
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
  for (const [key, value] of Object.entries(defaults.env)) {
    if (!Object.hasOwn(settings.env ?? {}, key)) set(['env', key], value);
  }
  const provider = settings.modelProviders?.openai;
  const wrapped =
    provider && !Array.isArray(provider) && typeof provider === 'object';
  const models = (wrapped ? provider.models : provider) ?? [];
  for (const model of defaults.modelProviders.openai) {
    if (previouslyInstalled && model.id === 'local-coder') continue;
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
    if (previouslyInstalled) break;
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
    fs.writeFileSync(temporary, text, { mode: 0o600 });
    fs.renameSync(temporary, settingsPath);
    if (!previouslyInstalled)
      fs.writeFileSync(initialMarker, '1\n', { mode: 0o600 });
    fs.writeFileSync(marker, '1\n', { mode: 0o600 });
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
