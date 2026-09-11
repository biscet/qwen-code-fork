// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaemonWorkspaceProvidersStatus } from '@qwen-code/sdk/daemon';
import { useConfiguredComposerModels } from './useConfiguredComposerModels';

function catalog(
  modelId: string,
  workspaceCwd = '/one',
): DaemonWorkspaceProvidersStatus {
  return {
    v: 1,
    workspaceCwd,
    initialized: true,
    acpChannelLive: true,
    providers: [
      {
        kind: 'model_provider',
        status: 'ok',
        authType: 'openai',
        current: true,
        models: [
          {
            modelId,
            baseModelId: 'qwen',
            name: modelId,
            baseUrl: 'https://one.example/v1',
            registryBaseUrl: 'https://one.example/v1',
          },
        ],
      },
    ],
  };
}

describe('useConfiguredComposerModels', () => {
  let root: Root;
  let container: HTMLDivElement;
  let input: Parameters<typeof useConfiguredComposerModels>[0];
  let result: ReturnType<typeof useConfiguredComposerModels>;
  function Probe() {
    result = useConfiguredComposerModels(input);
    return null;
  }
  const render = () => act(() => root.render(<Probe />));

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    root = createRoot(container);
    input = {
      connection: {
        sessionId: 'session-one',
        models: [{ id: 'old', label: 'old' }],
      },
      currentModel: 'another-model',
      status: catalog('old'),
      workspaceCwd: '/one',
    };
  });
  afterEach(() => act(() => root.unmount()));

  it('retains an unselected model identity through catalog replacement and repeated rename', () => {
    render();
    input = { ...input, status: catalog('first') };
    render();
    input = {
      ...input,
      connection: {
        ...input.connection,
        models: [{ id: 'first', label: 'first' }],
      },
      status: catalog('second'),
    };
    render();
    expect(result.models).toMatchObject([{ id: 'second', label: 'second' }]);
    expect(result.selected).toBeUndefined();
    render();
    expect(result.models).toMatchObject([{ id: 'second', label: 'second' }]);
  });

  it.each(['workspace', 'session'])(
    'drops remembered aliases when the %s owner changes',
    (owner) => {
      render();
      const workspaceCwd = owner === 'workspace' ? '/two' : '/one';
      input = {
        ...input,
        connection: {
          ...input.connection,
          sessionId: owner === 'session' ? 'session-two' : 'session-one',
        },
        currentModel: 'old',
        status: catalog('new', workspaceCwd),
        workspaceCwd,
      };
      render();
      expect(result.models).toEqual([{ id: 'old', label: 'old' }]);
      expect(result.selected).toBeUndefined();
    },
  );
});
