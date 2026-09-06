// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import { I18nProvider } from '../../i18n';
import type { HomeChatOptions } from '../homechat/homechat-api';
import { VaneSettingsPanel } from './VaneSettingsPanel';

vi.mock('@qwen-code/web-shell/daemon-react-sdk', () => ({
  useWorkspace: () => ({ baseUrl: 'http://localhost', token: 'test-token' }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

const options: HomeChatOptions = {
  chatModel: { providerId: 'local', key: 'reasoner' },
  thinking: true,
  effort: 'high',
  optimizationMode: 'balanced',
};
const models = [
  {
    providerId: 'local',
    key: 'reasoner',
    name: 'Reasoner',
    providerName: 'Local',
    reasoning: true,
  },
  {
    providerId: 'remote',
    key: 'reasoner',
    name: 'Simple',
    providerName: 'Remote',
    reasoning: false,
  },
];
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function render() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider language="en">
        <VaneSettingsPanel />
      </I18nProvider>,
    ),
  );
}

describe('VaneSettingsPanel', () => {
  it('saves Chat options with authentication and preserves unrelated values', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_url, init) =>
        init?.method === 'PUT' ? response({}) : response({ models, options }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await render();
    await act(async () =>
      getByRole(container, 'switch', { name: 'Thinking' }).click(),
    );
    const [url, init] = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )!;
    expect(url).toBe('http://localhost/homechat/options');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(JSON.parse(String(init?.body))).toEqual({
      ...options,
      thinking: false,
    });
    expect(getByRole(container, 'switch').getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(
      getByRole(container, 'combobox', {
        name: 'Reasoning effort',
      }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('keeps saved values when a write fails and lets the user retry', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_url, init) =>
        init?.method === 'PUT'
          ? response({ error: 'Save failed' }, 502)
          : response({ models, options }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await render();
    await act(async () => getByRole(container, 'switch').click());
    expect(getByRole(container, 'alert').textContent).toContain('Save failed');
    expect(getByRole(container, 'switch').getAttribute('aria-checked')).toBe(
      'true',
    );
    fetchMock.mockResolvedValue(response({}));
    await act(async () => getByRole(container, 'switch').click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(getByRole(container, 'switch').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('preserves provider identity and disables thinking when selecting a model without reasoning', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_url, init) =>
        init?.method === 'PUT' ? response({}) : response({ models, options }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await render();
    await act(async () =>
      fireEvent.keyDown(
        getByRole(container, 'combobox', { name: 'Chat model' }),
        { key: 'Enter' },
      ),
    );
    await act(async () =>
      fireEvent.click(
        getByRole(document.body, 'option', { name: 'Simple · Remote' }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    )!;
    expect(JSON.parse(String(init?.body))).toEqual({
      ...options,
      chatModel: { providerId: 'remote', key: 'reasoner' },
      thinking: false,
    });
    expect(getByRole(container, 'switch').hasAttribute('disabled')).toBe(true);
  });

  it('recovers from a catalog load failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: 'Vane offline' }, 502))
      .mockImplementation(async () => response({ models, options }));
    vi.stubGlobal('fetch', fetchMock);
    await render();
    expect(getByRole(container, 'alert').textContent).toContain('Vane offline');
    await act(async () =>
      getByRole(container, 'button', { name: 'Retry' }).click(),
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(
      getByRole(container, 'combobox', { name: 'Chat model' }).textContent,
    ).toContain('Reasoner');
  });
});
