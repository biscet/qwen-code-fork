import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const pythonVersion = '3.13.15';

export function prepareMcpRuntime({
  packageRoot,
  sourceRoot,
  packageDir,
  target,
}) {
  if (
    target !== 'darwin-arm64' ||
    process.platform !== 'darwin' ||
    process.arch !== 'arm64'
  ) {
    throw new Error(
      'The bundled workspace MCP runtime currently requires a macOS arm64 build host and target',
    );
  }
  const source = path.join(packageDir, 'mcp-runtime');
  const root = path.join(packageRoot, 'mcp');
  fs.mkdirSync(root, { recursive: true });
  for (const file of [
    'package.json',
    'package-lock.json',
    'requirements.txt',
    'launch.mjs',
    'serena-launch.py',
  ]) {
    fs.copyFileSync(path.join(source, file), path.join(root, file));
  }
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'ci',
      '--omit=dev',
      '--ignore-scripts',
      '--workspaces=false',
      '--no-audit',
      '--no-fund',
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  execFileSync(
    process.execPath,
    [path.join(sourceRoot, 'packages/node-repl/build.mjs')],
    {
      cwd: sourceRoot,
      stdio: 'inherit',
    },
  );
  copy(
    path.join(sourceRoot, 'packages/node-repl/dist'),
    path.join(root, 'node-repl'),
  );
  fs.copyFileSync(
    path.join(sourceRoot, 'LICENSE'),
    path.join(root, 'node-repl/LICENSE'),
  );
  fs.copyFileSync(
    path.join(sourceRoot, 'packages/node-repl/package.json'),
    path.join(root, 'node-repl/package.json'),
  );

  const require = createRequire(path.join(root, 'package.json'));
  const playwright = require('playwright');
  const browserExecutable = playwright.chromium.executablePath();
  if (!fs.existsSync(browserExecutable)) {
    execFileSync(
      process.execPath,
      [
        path.join(
          path.dirname(require.resolve('playwright/package.json')),
          'cli.js',
        ),
        'install',
        'chromium',
        '--no-shell',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: '1' },
      },
    );
  }
  // Keep the complete Chromium app, including its frameworks, resources and licenses.
  const browserApp = browserExecutable.slice(
    0,
    browserExecutable.indexOf('.app/') + 4,
  );
  if (!browserApp.endsWith('.app') || !fs.existsSync(browserExecutable)) {
    throw new Error(
      `Missing downloaded Chromium application: ${browserExecutable}`,
    );
  }
  copy(path.dirname(browserApp), path.join(root, 'chromium'));
  const bundledBrowserApp = path.join(
    root,
    'chromium',
    path.basename(browserApp),
  );
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--preserve-metadata=entitlements,requirements,flags',
      bundledBrowserApp,
    ],
    { stdio: 'inherit' },
  );
  execFileSync(
    'codesign',
    ['--verify', '--deep', '--strict', bundledBrowserApp],
    { stdio: 'inherit' },
  );
  const chromiumExecutable = path.join(
    'chromium',
    path.relative(path.dirname(browserApp), browserExecutable),
  );
  const minimumMacOSVersion = execFileSync(
    '/usr/libexec/PlistBuddy',
    [
      '-c',
      'Print :LSMinimumSystemVersion',
      path.join(browserApp, 'Contents/Info.plist'),
    ],
    { encoding: 'utf8' },
  ).trim();

  const pythonSource = findPython();
  const pythonRoot = path.join(root, 'python');
  copy(pythonSource, pythonRoot);
  for (const file of fs.readdirSync(path.join(pythonRoot, 'bin'))) {
    if (!['python', 'python3', 'python3.13'].includes(file)) {
      fs.rmSync(path.join(pythonRoot, 'bin', file), {
        recursive: true,
        force: true,
      });
    }
  }
  const python = path.join(pythonRoot, 'bin/python3.13');
  const sitePackages = path.join(pythonRoot, 'lib/python3.13/site-packages');
  fs.rmSync(sitePackages, { recursive: true, force: true });
  execFileSync(
    'uv',
    [
      'pip',
      'install',
      '--python',
      python,
      '--target',
      sitePackages,
      '--no-deps',
      '--link-mode',
      'copy',
      '--requirement',
      path.join(root, 'requirements.txt'),
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  fs.rmSync(path.join(sitePackages, 'bin'), { recursive: true, force: true });
  const installedSerena = execFileSync(
    python,
    [
      '-c',
      'from importlib.metadata import version; print(version("serena-agent"))',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PYTHONNOUSERSITE: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    },
  ).trim();
  if (installedSerena !== '1.7.0')
    throw new Error('Unexpected bundled Serena version');
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    `${JSON.stringify(
      {
        target,
        pythonVersion,
        serenaVersion: installedSerena,
        chromiumExecutable,
        minimumMacOSVersion,
        packages: JSON.parse(
          fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
        ).dependencies,
      },
      null,
      2,
    )}\n`,
  );
}

function findPython() {
  let executable;
  try {
    executable = execFileSync(
      'uv',
      [
        'python',
        'find',
        '--managed-python',
        '--no-python-downloads',
        pythonVersion,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    const directory = path.join(os.tmpdir(), 'homecode-python-build-cache');
    execFileSync(
      'uv',
      [
        'python',
        'install',
        '--no-bin',
        '--install-dir',
        directory,
        pythonVersion,
      ],
      { stdio: 'inherit' },
    );
    executable = execFileSync(
      'uv',
      ['python', 'find', '--managed-python', pythonVersion],
      {
        encoding: 'utf8',
        env: { ...process.env, UV_PYTHON_INSTALL_DIR: directory },
      },
    ).trim();
  }
  const real = fs.realpathSync(executable);
  const version = execFileSync(
    real,
    [
      '-c',
      'import platform; print(platform.python_version(), platform.machine())',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (version !== `${pythonVersion} arm64`)
    throw new Error(`Unexpected standalone Python runtime: ${version}`);
  return path.dirname(path.dirname(real));
}

function copy(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (file) =>
      !['.DS_Store', '__pycache__'].includes(path.basename(file)) &&
      !file.endsWith('.pyc'),
  });
}
