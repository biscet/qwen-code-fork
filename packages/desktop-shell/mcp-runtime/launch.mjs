import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const node = path.resolve(root, '../node/bin/node');
const python = path.join(root, 'python/bin/python3.13');
const packages = path.join(root, 'node_modules');
const metadata = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
);
const browser = path.join(root, metadata.chromiumExecutable);
const env = {
  ...process.env,
  PATH: `${path.dirname(node)}:${path.dirname(python)}:${process.env.PATH || '/usr/bin:/bin'}`,
  PYTHONNOUSERSITE: '1',
  PYTHONDONTWRITEBYTECODE: '1',
  CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
  CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1',
};
delete env.PYTHONHOME;
delete env.PYTHONPATH;
const servers = {
  'node-repl': [node, [path.join(root, 'node-repl/index.js')]],
  playwright: [
    node,
    [
      path.join(packages, '@playwright/mcp/cli.js'),
      '--headless',
      '--isolated',
      '--executable-path',
      browser,
    ],
  ],
  'chrome-devtools': [
    node,
    [
      path.join(
        packages,
        'chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js',
      ),
      '--headless',
      '--isolated',
      '--slim',
      '--no-usage-statistics',
      '--no-performance-crux',
      '--executablePath',
      browser,
    ],
  ],
  serena: [
    python,
    [
      path.join(root, 'serena-launch.py'),
      process.argv[3] === '--initialize-project'
        ? 'initialize-project'
        : 'start-mcp-server',
      '--context',
      'ide-assistant',
      '--add-mode',
      'no-memories',
      '--project',
      process.cwd(),
      '--enable-web-dashboard',
      'false',
      '--enable-gui-log-window',
      'false',
      '--open-web-dashboard',
      'false',
      '--log-level',
      'ERROR',
    ],
  ],
};
const server = servers[process.argv[2]];
if (!server) throw new Error('Unknown bundled workspace MCP server');
if (process.argv[2] === 'serena') {
  env.SERENA_HOME = path.join(process.cwd(), '.qwen', '.mcp', 'serena');
}
const child = spawn(server[0], server[1], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => child.kill(signal));
}
child.once('error', (error) => {
  process.stderr.write(`Bundled MCP failed to start: ${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
