/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface HomeChatModelSelection {
  providerId: string;
  key: string;
}

export interface HomeChatOptions {
  chatModel: HomeChatModelSelection;
  thinking: boolean;
  effort: string;
  optimizationMode: 'speed' | 'balanced' | 'quality';
}

export interface HomeChatFlags {
  archived?: boolean;
  pinned?: boolean;
}

export interface HomeChatResponseBlock {
  id: string;
  type: 'text' | 'source' | 'error';
  data:
    | string
    | Array<{ content: string; metadata: { title: string; url: string } }>
    | { message: string };
}

export interface HomeChatCodexMessage {
  messageId: string;
  chatId: string;
  query: string;
  createdAt: string;
  responseBlocks: HomeChatResponseBlock[];
  status: 'answering' | 'completed' | 'stopped' | 'error';
  turnId?: string;
}

export interface HomeChatCodexChat {
  id: string;
  title: string;
  createdAt: string;
  threadId?: string;
  options: HomeChatOptions;
  messages: HomeChatCodexMessage[];
}

interface HomeChatState {
  chats: Record<string, HomeChatFlags>;
  options?: HomeChatOptions;
  codexChats?: Record<string, HomeChatCodexChat>;
}

export class HomeChatStateStore {
  constructor(
    private readonly directory = join(
      process.env['QWEN_HOME'] || join(homedir(), '.qwen'),
      'homechat',
    ),
  ) {}

  read(): HomeChatState {
    try {
      return JSON.parse(
        readFileSync(join(this.directory, 'state.json'), 'utf8'),
      ) as HomeChatState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { chats: {} };
      }
      throw error;
    }
  }

  update(change: (state: HomeChatState) => void): void {
    const state = this.read();
    change(state);
    const target = join(this.directory, 'state.json');
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, target);
  }
}

export function parseHomeChatOptions(
  value: unknown,
): HomeChatOptions | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const options = value as Record<string, unknown>;
  if (
    Object.keys(options).length !== 4 ||
    typeof options['thinking'] !== 'boolean' ||
    typeof options['effort'] !== 'string' ||
    !options['effort'].length ||
    options['effort'].length > 64 ||
    typeof options['optimizationMode'] !== 'string' ||
    !['speed', 'balanced', 'quality'].includes(options['optimizationMode'])
  )
    return;
  const model = options['chatModel'];
  if (!model || typeof model !== 'object' || Array.isArray(model)) return;
  const selection = model as Record<string, unknown>;
  if (
    Object.keys(selection).length !== 2 ||
    typeof selection['providerId'] !== 'string' ||
    !selection['providerId'] ||
    selection['providerId'].length > 256 ||
    typeof selection['key'] !== 'string' ||
    !selection['key'] ||
    selection['key'].length > 512
  )
    return;
  return value as HomeChatOptions;
}
