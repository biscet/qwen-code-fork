/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CheckIcon,
  CircleDotIcon,
  GitBranchIcon,
  GitForkIcon,
  XIcon,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import styles from './GitModePopover.module.css';

export type SessionGitIntent =
  | { mode: 'current' }
  | { mode: 'branch'; name: string }
  | { mode: 'worktree'; slug?: string };

// Byte-length caps mirroring the server predicate in session.ts; keep in sync.
// git creates loose refs as files, so each `/`-separated component is bounded
// by the filesystem's per-component name limit (~255 bytes minus git's `.lock`
// suffix). Count UTF-8 bytes, not code points, since Unicode is allowed.
const MAX_BRANCH_NAME_BYTES = 1000;
const MAX_BRANCH_COMPONENT_BYTES = 200;

const branchNameEncoder = new TextEncoder();

// UX-only validation; the server re-validates in POST /session (session.ts).
// Keep the two predicates in sync.
export function validateBranchName(name: string): boolean {
  if (!name) return false;
  return !(
    /[^\p{L}\p{N}._/-]/u.test(name) ||
    name.includes('..') ||
    name.includes('//') ||
    name.startsWith('.') ||
    name.startsWith('-') ||
    name.startsWith('/') ||
    name.endsWith('/') ||
    name.endsWith('.') ||
    name.endsWith('.git') ||
    name.includes('@{') ||
    name.split('/').some((c) => c.startsWith('.') || c.endsWith('.lock')) ||
    name.toUpperCase() === 'HEAD' ||
    branchNameEncoder.encode(name).length > MAX_BRANCH_NAME_BYTES ||
    name
      .split('/')
      .some(
        (c) => branchNameEncoder.encode(c).length > MAX_BRANCH_COMPONENT_BYTES,
      )
  );
}

interface GitModePopoverProps {
  branch: string;
  compact?: boolean;
  intent: SessionGitIntent;
  onIntentChange: (intent: SessionGitIntent) => void;
}

export function GitModePopover({
  branch,
  compact = false,
  intent,
  onIntentChange,
}: GitModePopoverProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<
    'current' | 'branch' | 'worktree'
  >(intent.mode);
  const [branchName, setBranchName] = useState(
    intent.mode === 'branch' ? intent.name : '',
  );

  const contentRef = useRef<HTMLDivElement>(null);

  const branchValid = useMemo(
    () => validateBranchName(branchName),
    [branchName],
  );

  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (v) {
        setSelectedMode(intent.mode);
        setBranchName(intent.mode === 'branch' ? intent.name : '');
      }
    },
    [intent],
  );

  const handleSelectCurrent = useCallback(() => {
    onIntentChange({ mode: 'current' });
    setOpen(false);
  }, [onIntentChange]);

  const handleConfirmBranch = useCallback(() => {
    if (!branchName || !branchValid) return;
    onIntentChange({ mode: 'branch', name: branchName });
    setOpen(false);
  }, [branchName, branchValid, onIntentChange]);

  const handleConfirmWorktree = useCallback(() => {
    onIntentChange({ mode: 'worktree' });
    setOpen(false);
  }, [onIntentChange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onIntentChange({ mode: 'current' });
      setOpen(false);
    },
    [onIntentChange],
  );

  const isBranch = intent.mode === 'branch';
  const isWorktree = intent.mode === 'worktree';
  const chipLabel = isBranch
    ? `→ ${intent.name}`
    : isWorktree
      ? t('gitMode.worktree')
      : branch;

  return (
    <span className={styles.wrap}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${styles.chip} ${isBranch ? styles.chipBranch : ''} ${isWorktree ? styles.chipWorktree : ''} ${compact ? styles.chipCompact : ''}`}
            data-web-shell-git-branch
            data-testid="git-mode-chip"
            aria-label={`${t('gitMode.title')}: ${chipLabel}`}
          >
            <span className={styles.chipIcon}>
              {isWorktree ? (
                <GitForkIcon size={14} strokeWidth={1.5} />
              ) : (
                <GitBranchIcon size={15} strokeWidth={1.5} />
              )}
            </span>
            {!compact && <span className={styles.chipText}>{chipLabel}</span>}
            <svg
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
              viewBox="0 0 16 16"
              fill="currentColor"
              width={9}
              height={9}
              aria-hidden="true"
            >
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z" />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          side="top"
          align="end"
          sideOffset={8}
          className={styles.popover}
          // The content is portaled out of the composer, but React synthetic
          // clicks still bubble through the React tree to the composer
          // surface's onClick, which calls core.focus() and steals focus out of
          // the popover — Radix then dismisses it via focus-outside. Stop the
          // bubble so option clicks keep focus inside (mirrors the composer
          // ToolbarPopover pattern in ChatEditor).
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // The portal container fools Radix's dismissable-layer into
            // thinking clicks inside the popover are "outside". Only
            // prevent dismissal when the target is genuinely inside.
            if (contentRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          <div className={styles.header}>{t('gitMode.title')}</div>

          <div
            className={styles.options}
            role="radiogroup"
            aria-label={t('gitMode.title')}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selectedMode === 'current'}
              className={`${styles.option} ${selectedMode === 'current' ? styles.optionSelected : ''}`}
              onClick={handleSelectCurrent}
            >
              <span className={styles.optionIcon}>
                <CircleDotIcon size={15} strokeWidth={1.6} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionName}>
                  {t('gitMode.current')}
                </span>
                <span className={styles.optionDesc}>
                  {t('gitMode.currentDesc', { branch })}
                </span>
              </span>
              {selectedMode === 'current' && (
                <CheckIcon className={styles.check} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={selectedMode === 'branch'}
              className={`${styles.option} ${selectedMode === 'branch' ? styles.optionSelected : ''}`}
              onClick={() => setSelectedMode('branch')}
            >
              <span className={styles.optionIcon}>
                <GitBranchIcon size={15} strokeWidth={1.6} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionName}>{t('gitMode.branch')}</span>
                <span className={styles.optionDesc}>
                  {t('gitMode.branchDesc', { branch })}
                </span>
              </span>
              {selectedMode === 'branch' && (
                <CheckIcon className={styles.check} aria-hidden="true" />
              )}
            </button>

            {selectedMode === 'branch' && (
              <div className={styles.branchBox}>
                <label
                  className={styles.branchLabel}
                  htmlFor="git-mode-branch-input"
                >
                  {t('gitMode.branchLabel')}
                </label>
                <span className={styles.branchInputWrap}>
                  <input
                    className={`${styles.branchInput} ${branchName && !branchValid ? styles.branchInputInvalid : ''} ${branchName && branchValid ? styles.branchInputValid : ''}`}
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && branchName && branchValid)
                        handleConfirmBranch();
                    }}
                    placeholder={t('gitMode.branchPlaceholder')}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    id="git-mode-branch-input"
                    data-testid="git-mode-branch-input"
                  />
                  {branchName && (
                    <span
                      className={`${styles.branchStatus} ${branchValid ? styles.branchStatusValid : styles.branchStatusInvalid}`}
                      aria-hidden="true"
                    >
                      {branchValid ? (
                        <CheckIcon size={13} strokeWidth={2} />
                      ) : (
                        <XIcon size={13} strokeWidth={2} />
                      )}
                    </span>
                  )}
                </span>
                <div
                  className={`${styles.branchHint} ${branchName && !branchValid ? styles.branchHintError : ''}`}
                >
                  {branchName && !branchValid
                    ? t('gitMode.branchInvalidName')
                    : t('gitMode.branchHint')}
                </div>
                {branchName && branchValid && (
                  <div className={styles.branchHint}>
                    {t('gitMode.branchConflictWarning')}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              role="radio"
              aria-checked={selectedMode === 'worktree'}
              className={`${styles.option} ${selectedMode === 'worktree' ? styles.optionSelected : ''}`}
              onClick={() => setSelectedMode('worktree')}
            >
              <span className={styles.optionIcon}>
                <GitForkIcon size={15} strokeWidth={1.6} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionName}>
                  {t('gitMode.worktree')}
                </span>
                <span className={styles.optionDesc}>
                  {t('gitMode.worktreeDesc')}
                </span>
              </span>
              {selectedMode === 'worktree' && (
                <CheckIcon className={styles.check} aria-hidden="true" />
              )}
            </button>
          </div>

          {selectedMode !== 'current' && (
            <div className={styles.footer}>
              {selectedMode === 'branch' && (
                <button
                  type="button"
                  className={styles.confirmButton}
                  disabled={!branchName || !branchValid}
                  onClick={handleConfirmBranch}
                  data-testid="git-mode-confirm-branch"
                >
                  {t('gitMode.confirmBranch')}
                </button>
              )}
              {selectedMode === 'worktree' && (
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={handleConfirmWorktree}
                  data-testid="git-mode-confirm-worktree"
                >
                  {t('gitMode.confirmWorktree')}
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {(isBranch || isWorktree) && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label={t('gitMode.resetToCurrent')}
          title={t('gitMode.resetToCurrent')}
          data-testid="git-mode-clear"
        >
          <XIcon size={11} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
