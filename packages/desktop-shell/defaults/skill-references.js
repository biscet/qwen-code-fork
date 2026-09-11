import fs from 'node:fs';
import path from 'node:path';

function renderReferences(text, qwenHome, defaultsRoot) {
  return text.replace(/\.qwen\/(skills\/[\w./-]+)/g, (reference, relative) => {
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
}

export function refreshDesktopSkillReferences({ defaultsRoot, qwenHome }) {
  const visit = (relative) => {
    const source = path.join(defaultsRoot, relative);
    const destination = path.join(qwenHome, relative);
    const targetStat = fs.lstatSync(destination, { throwIfNoEntry: false });
    if (!targetStat || targetStat.isSymbolicLink()) return;
    const sourceStat = fs.lstatSync(source);
    if (sourceStat.isDirectory() && targetStat.isDirectory()) {
      for (const name of fs.readdirSync(source))
        visit(path.join(relative, name));
      return;
    }
    if (
      !sourceStat.isFile() ||
      !targetStat.isFile() ||
      !relative.endsWith('.md')
    )
      return;
    const template = fs.readFileSync(source, 'utf8');
    const current = fs.readFileSync(destination, 'utf8');
    const next = renderReferences(template, qwenHome, defaultsRoot);
    if (current === next) return;
    let managed = current === template;
    for (const match of current.matchAll(
      /'((?:[^'\r\n]|'\\'')*\/skills\/[\w./-]+)'/g,
    )) {
      const oldPath = match[1].replaceAll("'\\''", "'");
      const oldHome = oldPath.slice(0, oldPath.lastIndexOf('/skills/'));
      if (
        path.isAbsolute(oldHome) &&
        current === renderReferences(template, oldHome, defaultsRoot)
      ) {
        managed = true;
        break;
      }
    }
    if (managed) fs.writeFileSync(destination, next);
  };
  for (const kind of ['skills', 'agents']) visit(kind);
}
