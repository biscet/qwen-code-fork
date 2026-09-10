#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const runtimeRoot = path.join(packageDir, 'runtime', 'qwen-code');
const nodePath =
  process.platform === 'win32'
    ? path.join(runtimeRoot, 'node', 'node.exe')
    : path.join(runtimeRoot, 'node', 'bin', 'node');
const entryPath = path.join(runtimeRoot, 'lib', 'cli-entry.js');
const token = crypto.randomBytes(32).toString('hex');

verifyRuntimeIntegrity();
const codexVersion = execFileSync(
  nodePath,
  [
    path.join(
      runtimeRoot,
      'lib',
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js',
    ),
    '--version',
  ],
  { encoding: 'utf8', timeout: 10_000 },
).trim();
const manifest = JSON.parse(
  fs.readFileSync(path.join(runtimeRoot, 'manifest.json'), 'utf8'),
);
if (codexVersion !== `codex-cli ${manifest.codexVersion}`) {
  throw new Error(`Bundled Codex version mismatch: ${codexVersion}`);
}

const isolatedRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'homecode-runtime-smoke-'),
);
const workspace = path.join(isolatedRoot, 'workspace');
fs.mkdirSync(workspace);
fs.mkdirSync(path.join(isolatedRoot, 'os-home'));

const child = spawn(
  nodePath,
  [
    entryPath,
    'serve',
    '--port',
    '0',
    '--hostname',
    '127.0.0.1',
    '--require-auth',
    '--workspace',
    workspace,
    '--no-open',
  ],
  {
    cwd: workspace,
    env: {
      ...process.env,
      HOME: path.join(isolatedRoot, 'os-home'),
      QWEN_SERVER_TOKEN: token,
      QWEN_CODE_DESKTOP: '1',
      QWEN_HOME: path.join(isolatedRoot, 'home'),
      QWEN_RUNTIME_DIR: path.join(isolatedRoot, 'state'),
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let output = '';
let done = false;
let verifying = false;
const timeout = setTimeout(
  () => finish(new Error('Timed out waiting for bundled daemon startup')),
  45_000,
);
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  output += chunk;
  const match = output.match(/qwen serve listening on (http:\/\/[^\s]+)/);
  if (match && !verifying) {
    verifying = true;
    void verify(match[1]).catch(finish);
  }
});
child.stderr.on('data', (chunk) => {
  output += chunk;
});
child.on('exit', (code) => {
  fs.rmSync(isolatedRoot, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  if (!done)
    finish(
      new Error(
        `Bundled daemon exited before readiness (code ${code})\n${output}`,
      ),
    );
});

async function verify(baseUrl) {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok || !text.includes('"status":"ok"')) {
    finish(new Error(`Health check failed: ${response.status} ${text}`));
    return;
  }
  // The shallow health probe triggers the deferred runtime start. Wait for
  // deep health (served by the runtime app) before asserting the
  // unauthenticated shell, which the delegating app 401s until the runtime
  // is mounted.
  await waitForDeepHealth(baseUrl);
  for (const [route, field, names] of [
    [
      'skills',
      'skills',
      fs.readdirSync(path.join(runtimeRoot, 'defaults', 'skills')),
    ],
    ['agents', 'agents', ['test-engineer']],
    [
      'config/mcp/servers',
      'effective',
      [
        'node-repl',
        'serena',
        'home-ai-research',
        'playwright',
        'chrome-devtools',
      ],
    ],
    ['model-settings', 'models', ['local-coder']],
  ]) {
    const inventory = await fetch(`${baseUrl}/workspace/${route}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await inventory.json();
    const entries = Array.isArray(data[field])
      ? data[field]
      : Object.keys(data[field] ?? {}).map((name) => ({ name }));
    if (
      !inventory.ok ||
      names.some(
        (name) =>
          !entries.some(
            (item) =>
              item.name === name || item.id === name || item.modelId === name,
          ),
      )
    ) {
      throw new Error(
        `Missing clean-install defaults in ${route}: ${JSON.stringify(data)}`,
      );
    }
  }
  const shell = await fetch(baseUrl, {
    headers: { Accept: 'text/html' },
  });
  const html = await shell.text();
  if (!shell.ok || !html.includes('<div id="root"></div>')) {
    finish(new Error(`Web Shell check failed: ${shell.status}`));
    return;
  }
  console.log(`Bundled daemon and Web Shell ready at ${baseUrl}`);
  finish();
}

async function waitForDeepHealth(baseUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/health?deep=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for runtime deep health');
}

function finish(error) {
  if (done) return;
  done = true;
  clearTimeout(timeout);
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // The process group may already have exited after a startup failure.
  }
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function verifyRuntimeIntegrity() {
  const required = [
    'manifest.json',
    'checksums.json',
    'LICENSE',
    'NOTICE',
    'node/LICENSE',
    'lib/cli-entry.js',
    'lib/desktop-defaults.js',
    'defaults/settings.json',
    'defaults/home-ai-lan-ca.crt',
    'lib/web-shell/index.html',
  ];
  for (const relative of required) {
    const file = path.join(runtimeRoot, relative);
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Bundled runtime file is missing: ${relative}`);
    }
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(runtimeRoot, 'manifest.json'), 'utf8'),
  );
  for (const field of [
    'desktopVersion',
    'qwenCodeVersion',
    'qwenCodeCommit',
    'target',
    'node',
    'builtAt',
  ]) {
    if (!manifest[field])
      throw new Error(`Runtime manifest is missing ${field}`);
  }
  const checksums = JSON.parse(
    fs.readFileSync(path.join(runtimeRoot, 'checksums.json'), 'utf8'),
  );
  for (const [relative, expected] of Object.entries(checksums)) {
    const file = path.join(runtimeRoot, relative);
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Checksummed runtime file is missing: ${relative}`);
    }
    const actual = crypto
      .createHash('sha256')
      .update(fs.readFileSync(file))
      .digest('hex');
    if (actual !== expected) {
      throw new Error(`Bundled runtime checksum mismatch: ${relative}`);
    }
  }
}
