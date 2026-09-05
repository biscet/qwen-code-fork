/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ServeWorkspaceSkillsStatus } from '@qwen-code/acp-bridge/status';
import {
  extractSkillMarkdown,
  readWorkspaceSkillDetail,
} from './workspace-skill-detail.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('workspace skill detail', () => {
  it('returns only the Markdown body for the exact skill identity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qwen-skill-detail-'));
    tempDirectories.push(directory);
    const firstPath = join(directory, 'first.md');
    const secondPath = join(directory, 'second.md');
    await writeFile(
      firstPath,
      '---\nname: duplicate\ndescription: First\n---\n# First body\n',
    );
    await writeFile(
      secondPath,
      '---\nname: duplicate\ndescription: Second\n---\n# Second body\n',
    );
    const status: ServeWorkspaceSkillsStatus = {
      v: 1,
      workspaceCwd: '/workspace',
      initialized: true,
      skills: [
        {
          kind: 'skill',
          status: 'ok',
          name: 'duplicate',
          description: 'First',
          level: 'extension',
          modelInvocable: true,
          extensionName: 'first-extension',
          installedPath: firstPath,
        },
        {
          kind: 'skill',
          status: 'ok',
          name: 'duplicate',
          description: 'Second',
          level: 'extension',
          modelInvocable: true,
          extensionName: 'second-extension',
          installedPath: secondPath,
        },
      ],
    };

    await expect(
      readWorkspaceSkillDetail(status, {
        name: 'duplicate',
        level: 'extension',
        extensionName: 'second-extension',
      }),
    ).resolves.toMatchObject({
      name: 'duplicate',
      extensionName: 'second-extension',
      markdown: '# Second body',
    });
  });

  it('does not expose a same-name skill from another extension', async () => {
    const status: ServeWorkspaceSkillsStatus = {
      v: 1,
      workspaceCwd: '/workspace',
      initialized: true,
      skills: [],
    };

    await expect(
      readWorkspaceSkillDetail(status, {
        name: 'duplicate',
        level: 'extension',
        extensionName: 'missing-extension',
      }),
    ).rejects.toMatchObject({ code: 'skill_not_found' });
  });

  it('preserves plain Markdown files without frontmatter', () => {
    expect(extractSkillMarkdown('# Plain skill\r\n\r\nInstructions')).toBe(
      '# Plain skill\n\nInstructions',
    );
  });
});
