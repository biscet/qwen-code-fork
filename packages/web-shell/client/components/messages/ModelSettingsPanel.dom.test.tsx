// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, getByLabelText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaemonModelSettingsEntry } from '@qwen-code/sdk/daemon';
import { I18nProvider } from '../../i18n';
import {
  ModelSettingsPanel,
  type ModelSettingsPanelProps,
} from './ModelSettingsPanel';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const local: DaemonModelSettingsEntry = {
  providerId: 'openai',
  authType: 'openai',
  modelId: 'local-coder',
  name: 'Windows Qwen',
  baseUrl: 'http://127.0.0.1:1235/v1',
  envKey: 'LOCAL_QWEN_API_KEY',
  hasApiKey: true,
  contextWindowSize: 131072,
  maxTokens: 8192,
  temperature: 1,
  thinking: true,
  reasoningEffort: 'medium',
};

describe('ModelSettingsPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: ModelSettingsPanelProps;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    props = {
      actions: {
        loadModelSettings: vi.fn().mockResolvedValue({ models: [local] }),
        loadProviders: vi.fn().mockResolvedValue({
          providers: [
            {
              authType: 'openai',
              models: [
                {
                  baseModelId: 'local-coder',
                  modelId: 'qwen-route:local',
                  baseUrl: local.baseUrl,
                  isCurrent: true,
                },
              ],
            },
          ],
        }),
        deleteModelSettings: vi.fn().mockResolvedValue({
          runtimeSync: { status: 'applied' },
          models: [],
        }),
        saveModelSettings: vi.fn().mockResolvedValue({
          runtimeSync: { status: 'applied' },
          models: [local],
        }),
        checkModelLimits: vi.fn().mockResolvedValue({
          checkedAt: '2026-09-05T10:00:00Z',
          status: 'ok',
          windows: [],
        }),
      },
      currentModelId: 'local-coder',
      onSelectModel: vi.fn(),
      onSaved: vi.fn(),
    };
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  async function render(scope: 'user' | 'workspace' = 'workspace') {
    await act(async () => {
      root.render(
        <I18nProvider language="en">
          <ModelSettingsPanel key={scope} {...props} scope={scope} />
        </I18nProvider>,
      );
    });
  }
  async function click(name: string) {
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name, exact: true }));
    });
  }
  async function change(label: string, value: string) {
    await act(async () => {
      fireEvent.change(getByLabelText(container, label), { target: { value } });
    });
  }
  async function submit() {
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });
  }

  it('shows the current alias, defaults and actual connection without checking quota on load', async () => {
    await render();
    expect(container.textContent).toContain('Windows Qwen');
    expect(container.textContent).toContain('Current');
    expect(container.textContent).toContain('thinkingON');
    expect(container.textContent).toContain('effortmedium');
    expect(
      getByRole(container, 'region', { name: 'Models' }).textContent,
    ).toContain('Windows Qwen');
    const fallback = getByRole(container, 'region', {
      name: 'Fallback free models',
    });
    expect(fallback.textContent).toContain('LLM7 · Codestral and GPT-OSS');
    expect(fallback.textContent).not.toContain('verified');
    expect(fallback.textContent).toContain('Requests per minute10 / 10');
    expect(fallback.textContent).toContain('Requests per hour60 / 60');
    expect(fallback.textContent).toContain('Tokens per day500,000 / 500,000');
    const limitBars = fallback.querySelectorAll('[role="progressbar"]');
    expect(limitBars).toHaveLength(3);
    for (const limitBar of limitBars) {
      expect(limitBar.getAttribute('style')).toContain(
        'background-color: var(--warning-color)',
      );
      expect(limitBar.firstElementChild?.getAttribute('style')).toContain(
        'background-color: var(--success-color)',
      );
    }
    expect(fallback.querySelector('a')?.getAttribute('href')).toBe(
      'https://docs.llm7.io/limits',
    );
    expect(fallback.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain('ModelScope');
    expect(container.textContent).not.toContain('OrcaRouter');
    expect(container.textContent).not.toContain('Other providers');
    expect(props.actions.saveModelSettings).not.toHaveBeenCalled();
    expect(props.onSelectModel).not.toHaveBeenCalled();
    expect(props.actions.checkModelLimits).not.toHaveBeenCalled();
    expect(props.actions.loadModelSettings).toHaveBeenCalledWith('workspace');
  });

  it('hides the built-in Qwen OAuth coder alias from model settings', async () => {
    vi.mocked(props.actions.loadModelSettings).mockResolvedValue({
      models: [
        {
          ...local,
          providerId: 'qwen-oauth',
          authType: 'qwen-oauth',
          modelId: 'coder-model',
          name: 'Qwen 3.7 Max',
          baseUrl: undefined,
        },
        local,
      ],
    });
    await render();
    expect(container.textContent).not.toContain('Qwen 3.7 Max');
    expect(container.textContent).not.toContain('coder-model');
    expect(container.textContent).toContain('Windows Qwen');
  });

  it('saves name and defaults against the original endpoint without sending an empty key', async () => {
    await render();
    await click('Configure Windows Qwen');
    expect(getByLabelText(container, 'API key').getAttribute('type')).toBe(
      'password',
    );
    expect(
      (getByLabelText(container, 'API key') as HTMLInputElement).value,
    ).toBe('');
    await change('Display name', 'My Qwen');
    await change('Maximum response · tokens', '4096');
    await submit();
    expect(props.actions.saveModelSettings).toHaveBeenCalledWith({
      scope: 'workspace',
      target: {
        providerId: 'openai',
        modelId: 'local-coder',
        baseUrl: local.baseUrl,
      },
      model: {
        providerId: 'openai',
        modelId: 'local-coder',
        baseUrl: local.baseUrl,
        name: 'My Qwen',
        envKey: 'LOCAL_QWEN_API_KEY',
        contextWindowSize: 131072,
        maxTokens: 4096,
        temperature: 1,
        thinking: true,
        reasoningEffort: 'medium',
      },
    });
    expect(container.textContent).toContain('Model settings saved.');
    expect(container.querySelector('form')).toBeNull();
  });

  it('retains the editor after a save error and does not report success', async () => {
    vi.mocked(props.actions.saveModelSettings).mockRejectedValue(
      new Error('Cannot save model'),
    );
    await render();
    await click('Configure Windows Qwen');
    await change('Display name', 'Keep draft');
    await submit();
    expect(
      (getByLabelText(container, 'Display name') as HTMLInputElement).value,
    ).toBe('Keep draft');
    expect(getByRole(container, 'alert').textContent).toContain(
      'Cannot save model',
    );
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('clears an unsaved secret and form on a scope change', async () => {
    await render();
    await click('Configure Windows Qwen');
    await change('API key', 'test-only-secret');
    await render('user');
    expect(container.querySelector('input[type=password]')).toBeNull();
    await click('Configure Windows Qwen');
    expect(
      (getByLabelText(container, 'API key') as HTMLInputElement).value,
    ).toBe('');
    expect(props.actions.saveModelSettings).not.toHaveBeenCalled();
    expect(props.actions.loadModelSettings).toHaveBeenLastCalledWith('user');
  });

  it('selects the exact provider route instead of guessing from the alias', async () => {
    props.currentModelId = 'other';
    await render();
    expect(
      getByRole(container, 'button', {
        name: 'Set current Windows Qwen',
      }).getAttribute('data-variant'),
    ).toBe('outline');
    await click('Set current Windows Qwen');
    expect(props.onSelectModel).toHaveBeenCalledWith('qwen-route:local');
  });

  it('keeps selection disabled while a model switch is running', async () => {
    props.currentModelId = 'other';
    props.selectionBusy = true;
    await render();
    expect(
      (
        getByRole(container, 'button', {
          name: 'Set current Windows Qwen',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('matches trailing slashes and preserves a default endpoint while editing', async () => {
    props.currentModelId = 'other';
    vi.mocked(props.actions.loadModelSettings).mockResolvedValue({
      v: 1,
      workspaceCwd: '/workspace',
      scope: 'workspace',
      models: [{ ...local, baseUrl: `${local.baseUrl}/` }],
    });
    await render();
    await click('Set current Windows Qwen');
    expect(props.onSelectModel).toHaveBeenCalledWith('qwen-route:local');
    vi.mocked(props.actions.loadModelSettings).mockResolvedValue({
      v: 1,
      workspaceCwd: '/workspace',
      scope: 'user',
      models: [{ ...local, baseUrl: undefined }],
    });
    vi.mocked(props.actions.loadProviders).mockResolvedValue({
      providers: [
        {
          authType: 'openai',
          models: [
            {
              baseModelId: local.modelId,
              modelId: 'qwen-route:default',
              baseUrl: 'https://api.openai.com/v1',
              registryBaseUrl: null,
            },
          ],
        },
      ],
    } as Awaited<
      ReturnType<ModelSettingsPanelProps['actions']['loadProviders']>
    >);
    await render('user');
    await click('Set current Windows Qwen');
    expect(props.onSelectModel).toHaveBeenLastCalledWith('qwen-route:default');
    await click('Configure Windows Qwen');
    expect(
      (getByLabelText(container, 'API address') as HTMLInputElement).required,
    ).toBe(false);
    await change('Display name', 'Default endpoint');
    await submit();
    expect(props.actions.saveModelSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.not.objectContaining({ baseUrl: expect.any(String) }),
      }),
    );
  });

  it('does not select a workspace override from a user default-endpoint row', async () => {
    props.currentModelId = 'other';
    vi.mocked(props.actions.loadModelSettings).mockResolvedValue({
      v: 1,
      workspaceCwd: '/workspace',
      scope: 'user',
      models: [{ ...local, baseUrl: undefined }],
    });
    await render('user');
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) =>
          button.getAttribute('aria-label') === 'Set current Windows Qwen',
      ),
    ).toBe(false);
    expect(container.textContent).not.toContain('· Current');
  });

  it('confirms deletion of the exact scoped connection', async () => {
    await render();
    await click('Delete Windows Qwen');
    expect(props.actions.deleteModelSettings).not.toHaveBeenCalled();
    await click('Cancel');
    await click('Delete Windows Qwen');
    await click('Confirm');
    expect(props.actions.deleteModelSettings).toHaveBeenCalledWith({
      scope: 'workspace',
      target: {
        providerId: 'openai',
        modelId: local.modelId,
        baseUrl: local.baseUrl,
      },
    });
    expect(container.textContent).toContain('Model removed.');
  });

  it('adds an ordinary model without opening a provider sign-in flow', async () => {
    await render();
    await click('+ Add Model');
    expect(
      (getByLabelText(container, 'Model ID') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (getByLabelText(container, 'API address') as HTMLInputElement).value,
    ).toBe('');
    expect(props.actions.saveModelSettings).not.toHaveBeenCalled();
    await change('Display name', 'Local Qwen 27B');
    await change('Model ID', 'qwen-27b');
    await change('API address', 'http://127.0.0.1:8080/v1');
    await change('API key', 'test-local-key');
    await submit();
    expect(props.actions.saveModelSettings).toHaveBeenCalledWith({
      scope: 'workspace',
      model: {
        providerId: 'openai',
        modelId: 'qwen-27b',
        name: 'Local Qwen 27B',
        baseUrl: 'http://127.0.0.1:8080/v1',
        apiKey: 'test-local-key',
      },
    });
    expect(props.onSelectModel).not.toHaveBeenCalled();
  });

  it('cancels ordinary model creation without saving or switching models', async () => {
    await render();
    await click('+ Add Model');
    await change('Display name', 'Unsaved');
    await click('Cancel');
    expect(container.querySelector('form')).toBeNull();
    expect(props.actions.saveModelSettings).not.toHaveBeenCalled();
    expect(props.onSelectModel).not.toHaveBeenCalled();
  });

  it('shows quota as unknown until explicitly checked and displays a genuine zero', async () => {
    const model = {
      ...local,
      modelId: 'Qwen/Qwen3.8-27B',
      baseUrl: 'https://api-inference.modelscope.cn/v1',
    };
    vi.mocked(props.actions.loadModelSettings).mockResolvedValue({
      v: 1,
      workspaceCwd: '/workspace',
      scope: 'workspace',
      models: [model],
    });
    vi.mocked(props.actions.checkModelLimits).mockResolvedValue({
      checkedAt: '2026-09-05T10:00:00Z',
      status: 'limited',
      windows: [{ label: 'Model', remaining: 0, limit: 200, period: 'day' }],
    });
    await render();
    expect(container.textContent).toContain(
      'Remaining quota has not been checked.',
    );
    expect(container.textContent).not.toContain('200 remaining');
    await click('Check remaining quota');
    expect(props.actions.checkModelLimits).toHaveBeenCalledWith({
      scope: 'workspace',
      target: {
        providerId: 'openai',
        modelId: model.modelId,
        baseUrl: model.baseUrl,
      },
    });
    expect(container.textContent).toContain('0 remaining / 200');
    expect(
      getByRole(container, 'progressbar', { name: 'Model' }).getAttribute(
        'aria-valuenow',
      ),
    ).toBe('0');
    expect(container.textContent).toContain('Usage since then is not included');
  });
});
