/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import type {
  ServeSkillLevel,
  ServeWorkspaceSkillsStatus,
} from '@qwen-code/acp-bridge/status';

export interface WorkspaceSkillIdentity {
  name: string;
  level: ServeSkillLevel;
  extensionName?: string;
}

export interface WorkspaceSkillDetail {
  v: 1;
  workspaceCwd: string;
  name: string;
  level: ServeSkillLevel;
  extensionName?: string;
  markdown: string;
}

export class WorkspaceSkillDetailError extends Error {
  constructor(
    readonly code: 'skill_not_found' | 'skill_content_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceSkillDetailError';
  }
}

export function extractSkillMarkdown(content: string): string {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)([\s\S]*)$/);
  return (match?.[1] ?? normalized).trim();
}

export async function readWorkspaceSkillDetail(
  status: ServeWorkspaceSkillsStatus,
  identity: WorkspaceSkillIdentity,
): Promise<WorkspaceSkillDetail> {
  const skill = status.skills.find(
    (candidate) =>
      candidate.name === identity.name &&
      candidate.level === identity.level &&
      (candidate.level !== 'extension' ||
        candidate.extensionName === identity.extensionName),
  );
  if (!skill) {
    throw new WorkspaceSkillDetailError(
      'skill_not_found',
      `Skill ${identity.name} was not found`,
    );
  }
  if (!skill.installedPath) {
    throw new WorkspaceSkillDetailError(
      'skill_content_unavailable',
      `Skill ${identity.name} has no readable SKILL.md path`,
    );
  }

  try {
    const content = await readFile(skill.installedPath, 'utf8');
    return {
      v: 1,
      workspaceCwd: status.workspaceCwd,
      name: skill.name,
      level: skill.level,
      ...(skill.extensionName ? { extensionName: skill.extensionName } : {}),
      markdown: extractSkillMarkdown(content),
    };
  } catch (error) {
    throw new WorkspaceSkillDetailError(
      'skill_content_unavailable',
      error instanceof Error
        ? error.message
        : `Unable to read SKILL.md for ${identity.name}`,
    );
  }
}
