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
