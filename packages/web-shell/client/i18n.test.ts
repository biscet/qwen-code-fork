/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getMissingTranslationKeys,
  getTranslator,
  languageLabel,
  languageSettingToWebShellLanguage,
  normalizeLanguage,
  WEB_SHELL_LANGUAGES,
} from './i18n';
import { RU } from './i18n.ru';

describe('Russian Web Shell localization', () => {
  it('registers Russian as a bundled language', () => {
    expect(WEB_SHELL_LANGUAGES).toEqual(['en', 'zh-CN', 'ru']);
    expect(languageLabel('ru')).toBe('Русский [ru]');
  });

  it.each(['ru', 'ru-RU', 'ru_RU', 'russian', 'русский'])(
    'normalizes %s to Russian',
    (language) => {
      expect(normalizeLanguage(language)).toBe('ru');
      expect(languageSettingToWebShellLanguage(language)).toBe('ru');
    },
  );

  it('covers every bundled Web Shell message key', () => {
    expect(getMissingTranslationKeys('ru')).toEqual([]);
  });

  it('translates static, dynamic, settings, and tool-name messages', () => {
    const t = getTranslator('ru');
    expect(t('settings.title')).toBe('Настройки');
    expect(t('git.currentBranch', { branch: 'main' })).toBe(
      'Текущая ветка Git: main',
    );
    expect(t('toolName.read_file')).toBe('Чтение файла');
    expect(t('language.usage')).toContain('ru');
  });

  it('translates every schema-derived setting string shown by Web Shell', () => {
    const keys = [
      'settings.label.review.attribution',
      'settings.description.review.attribution',
      'settings.label.review.sandbox',
      'settings.description.review.sandbox',
      'settings.option.review.sandbox.off',
      'settings.option.review.sandbox.auto',
      'settings.option.review.sandbox.required',
      'settings.label.review.effort',
      'settings.description.review.effort',
      'settings.option.review.effort.auto',
      'settings.option.review.effort.low',
      'settings.option.review.effort.medium',
      'settings.option.review.effort.high',
      'settings.label.review.comment',
      'settings.description.review.comment',
      'settings.label.review.severityFloor',
      'settings.description.review.severityFloor',
      'settings.option.review.severityFloor.auto',
      'settings.option.review.severityFloor.critical',
      'settings.option.review.severityFloor.suggestion',
      'settings.label.review.reverseAuditRounds',
      'settings.description.review.reverseAuditRounds',
      'settings.label.review.approachRounds',
      'settings.description.review.approachRounds',
      'settings.label.output.showTimestamps',
      'settings.description.output.showTimestamps',
      'settings.label.ui.disableWorkflowKeywordTrigger',
      'settings.description.ui.disableWorkflowKeywordTrigger',
      'settings.label.ui.showStatusInTitle',
      'settings.description.ui.showStatusInTitle',
      'settings.label.ui.showResponseTokensPerSecond',
      'settings.description.ui.showResponseTokensPerSecond',
      'settings.label.advisorModel',
      'settings.description.advisorModel',
      'settings.label.modelFallbacks',
      'settings.description.modelFallbacks',
      'settings.label.voiceModel',
      'settings.description.voiceModel',
      'settings.label.tools.webSearch.enabled',
      'settings.description.tools.webSearch.enabled',
      'settings.label.tools.webSearch.model',
      'settings.description.tools.webSearch.model',
      'settings.label.tools.webSearch.webExtractor',
      'settings.description.tools.webSearch.webExtractor',
      'settings.label.tools.toolSearch.threshold',
      'settings.description.tools.toolSearch.threshold',
      'settings.label.tools.listDirectory.enabled',
      'settings.description.tools.listDirectory.enabled',
      'settings.label.tools.workflowsEnabled',
      'settings.description.tools.workflowsEnabled',
      'settings.label.goals.modelProposed',
      'settings.description.goals.modelProposed',
      'settings.option.goals.modelProposed.alwaysAsk',
      'settings.option.goals.modelProposed.disabled',
      'settings.label.experimental.cron',
      'settings.description.experimental.cron',
      'settings.label.experimental.sessionWriterLease',
      'settings.description.experimental.sessionWriterLease',
      'settings.label.experimental.agentTeam',
      'settings.description.experimental.agentTeam',
      'settings.label.experimental.artifact',
      'settings.description.experimental.artifact',
    ];
    const t = getTranslator('ru');

    for (const key of keys) {
      expect(t(key)).not.toBe(key);
    }
  });

  it('does not expose translation-pipeline artifacts', () => {
    const renderedMessages = Object.values(RU).map((message) =>
      typeof message === 'function' ? message() : message,
    );
    expect(renderedMessages.join('\n')).not.toMatch(/sourceLanguage|\{"key"/);
  });

  it('uses Russian plural forms', () => {
    const t = getTranslator('ru');
    expect(t('git.untracked', { count: 1 })).toBe('1 неотслеживаемый файл');
    expect(t('git.untracked', { count: 2 })).toBe('2 неотслеживаемых файла');
    expect(t('git.untracked', { count: 5 })).toBe('5 неотслеживаемых файлов');
  });
});

// getTranslator returns the raw key when EN has no entry. SettingsMessage
// translateSettingText then substitutes the settingsSchema.ts description,
// which still says Enter accepts into the input buffer — wrong in Web Shell,
// where Enter accepts and submits (#9521). A missing EN override is therefore
// silent in the UI and in tests unless the catalog itself is pinned.
const FOLLOWUP_SETTING_KEYS = [
  'settings.label.ui.enableFollowupSuggestions',
  'settings.description.ui.enableFollowupSuggestions',
] as const;

describe('web-shell i18n catalog', () => {
  it('keeps the follow-up suggestion setting copy overridden in EN', () => {
    const t = getTranslator('en');
    for (const key of FOLLOWUP_SETTING_KEYS) {
      expect(t(key)).not.toBe(key);
    }
  });
});
