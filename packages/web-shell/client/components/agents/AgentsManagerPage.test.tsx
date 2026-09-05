/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DaemonWorkspaceAgentDetail,
  DaemonWorkspaceAgentSummary,
} from '@qwen-code/web-shell/daemon-react-sdk';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { state, getAgent, reload, deleteAgent } = vi.hoisted(() => ({
  state: {
    agents: [] as DaemonWorkspaceAgentSummary[],
    detail: null as DaemonWorkspaceAgentDetail | null,
  },
  getAgent: vi.fn(),
  reload: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock('@qwen-code/web-shell/daemon-react-sdk', () => ({
  DAEMON_APPROVAL_MODES: ['inherit', 'default', 'auto_edit', 'yolo'],
  useAgents: () => ({
    agents: state.agents,
    loading: false,
    error: undefined,
    reload,
    getAgent,
    deleteAgent,
  }),
  useMcp: vi.fn(),
  useSettings: vi.fn(),
  useTools: vi.fn(),
}));

const { AgentsManagerPage } = await import('./AgentsManagerPage');
const { resolveAgentColor } = await import('./agent-color');
const { I18nProvider } = await import('../../i18n');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state.agents = [];
  state.detail = null;
  getAgent.mockReset().mockImplementation(async () => state.detail);
  reload.mockReset();
  deleteAgent.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AgentsManagerPage', () => {
  it('shows the same automatic color in the list and detail view', async () => {
    const summary: DaemonWorkspaceAgentSummary = {
      kind: 'agent',
      name: 'review-agent',
      description: 'Review code',
      level: 'builtin',
      isBuiltin: true,
      hasTools: true,
    };
    state.agents = [summary];
    state.detail = {
      ...summary,
      systemPrompt: 'Review the change.',
    };
    const expected = resolveAgentColor(summary.name).color;

    await act(async () => {
      root.render(
        <I18nProvider language="ru">
          <AgentsManagerPage onClose={vi.fn()} />
        </I18nProvider>,
      );
    });
    const row = container.querySelector<HTMLButtonElement>(
      '[aria-label="review-agent"]',
    );
    expect(row).not.toBeNull();
    const listColor =
      row!.querySelector<HTMLElement>('[style]')?.style.backgroundColor;
    expect(listColor).toBeTruthy();

    await act(async () => {
      row!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Распределён автоматически');
    expect(container.textContent).toContain(expected);
    expect(
      Array.from(container.querySelectorAll<HTMLElement>('[style]')).some(
        (element) => element.style.backgroundColor === listColor,
      ),
    ).toBe(true);
  });
});
