import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function bundleMacLocal(packageDir, run = execFileSync) {
  const config = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'src-tauri/tauri.conf.json'), 'utf8'),
  );
  const target = path.join(packageDir, 'src-tauri/target');
  const runtime = path.join(packageDir, 'runtime/qwen-code');
  const staging = fs.mkdtempSync(path.join(target, '.local-bundle-'));
  const cargoTarget = path.join(staging, 'target');
  const image = path.join(staging, 'image');
  const app = path.join(image, `${config.productName}.app`);
  const archive = path.join(staging, 'installer.dmg');
  const name = `${config.productName}_${config.version}_${process.arch === 'arm64' ? 'aarch64' : 'x64'}.dmg`;
  const destination = path.join(target, 'release/bundle/dmg', name);
  const options = { cwd: packageDir, stdio: 'inherit' };
  try {
    fs.mkdirSync(path.join(cargoTarget, 'release'), { recursive: true });
    fs.copyFileSync(
      path.join(target, 'release', config.productName),
      path.join(cargoTarget, 'release', config.productName),
    );
    run(
      process.execPath,
      [
        path.join(packageDir, 'node_modules/@tauri-apps/cli/tauri.js'),
        'bundle',
        '--bundles',
        'app',
        '--config',
        'src-tauri/tauri.adhoc.conf.json',
        '--ci',
      ],
      { ...options, env: { ...process.env, CARGO_TARGET_DIR: cargoTarget } },
    );
    fs.mkdirSync(image);
    fs.renameSync(
      path.join(
        cargoTarget,
        'release/bundle/macos',
        `${config.productName}.app`,
      ),
      app,
    );
    const bundledRuntime = path.join(
      app,
      'Contents/Resources/runtime/qwen-code',
    );
    fs.rmSync(bundledRuntime, { recursive: true, force: true });
    fs.cpSync(runtime, bundledRuntime, {
      recursive: true,
      verbatimSymlinks: true,
    });
    const chromium = path.join(
      bundledRuntime,
      'mcp/chromium/Google Chrome for Testing.app',
    );
    if (fs.existsSync(chromium)) {
      run('codesign', ['--verify', '--deep', '--strict', chromium], options);
    }
    run(
      'codesign',
      [
        '--force',
        '--sign',
        '-',
        '--options',
        'runtime',
        '--entitlements',
        'src-tauri/Entitlements.plist',
        app,
      ],
      options,
    );
    run(
      'codesign',
      ['--verify', '--deep', '--strict', '--verbose=2', app],
      options,
    );
    const checksums = JSON.parse(
      fs.readFileSync(path.join(runtime, 'checksums.json'), 'utf8'),
    );
    for (const [relative, expected] of Object.entries(checksums)) {
      const actual = crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(bundledRuntime, relative)))
        .digest('hex');
      if (actual !== expected)
        throw new Error(`Packaged runtime checksum mismatch: ${relative}`);
    }
    fs.symlinkSync('/Applications', path.join(image, 'Applications'));
    run(
      'hdiutil',
      [
        'create',
        '-volname',
        config.productName,
        '-fs',
        'HFS+',
        '-format',
        'UDZO',
        '-srcfolder',
        image,
        archive,
      ],
      options,
    );
    run('hdiutil', ['verify', archive], options);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(archive, destination);
    return destination;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  console.log(`Created local macOS installer: ${bundleMacLocal(packageDir)}`);
}
