import type { DaemonWorkspaceSkillStatus } from '@qwen-code/web-shell/daemon-react-sdk';

export type SkillLevelFilter = 'all' | DaemonWorkspaceSkillStatus['level'];
export type SkillStatusFilter = 'all' | 'enabled' | 'disabled';

export function skillExtensionLabel(skill: DaemonWorkspaceSkillStatus): string {
  return skill.extensionDisplayName ?? skill.extensionName ?? '-';
}

export function skillIdentity(skill: DaemonWorkspaceSkillStatus): string {
  return `${skill.level}:${skill.extensionName ?? ''}:${skill.name}`;
}

export function filterSkills(
  skills: readonly DaemonWorkspaceSkillStatus[],
  query: string,
  level: SkillLevelFilter = 'all',
  status: SkillStatusFilter = 'all',
): DaemonWorkspaceSkillStatus[] {
  const normalized = query.trim().toLowerCase();
  return skills.filter((skill) => {
    if (level !== 'all' && skill.level !== level) return false;
    if (status === 'disabled' && skill.status !== 'disabled') return false;
    if (status === 'enabled' && skill.status === 'disabled') return false;
    if (!normalized) return true;
    return skill.name.toLowerCase().includes(normalized);
  });
}

export function preserveSkillSelection(
  identity: string | null,
  skills: readonly DaemonWorkspaceSkillStatus[],
): string | null {
  return identity && skills.some((skill) => skillIdentity(skill) === identity)
    ? identity
    : null;
}
