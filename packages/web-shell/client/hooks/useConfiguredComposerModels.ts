import { useEffect, useMemo, useRef } from 'react';
import type { DaemonWorkspaceProvidersStatus } from '@qwen-code/sdk/daemon';
import type {
  DaemonConnectionState,
  DaemonModelInfo,
} from '../daemon/session/types';
import { mapProviderStatus } from '../daemon/session/mappers';
import { findConfiguredComposerModel } from '../utils/composerModels';

export function useConfiguredComposerModels({
  connection,
  currentModel,
  status,
  workspaceCwd,
}: {
  connection: Pick<DaemonConnectionState, 'sessionId' | 'models' | 'providers'>;
  currentModel: string | undefined;
  status: DaemonWorkspaceProvidersStatus | undefined;
  workspaceCwd: string | undefined;
}) {
  const previousCatalog = useRef<
    | {
        sessionId?: string;
        workspaceCwd?: string;
        models: DaemonModelInfo[];
      }
    | undefined
  >(undefined);
  const result = useMemo(() => {
    const remembered = previousCatalog.current;
    const previous = [
      ...mapProviderStatus(connection.providers).models,
      ...(remembered?.sessionId === connection.sessionId &&
      remembered?.workspaceCwd === workspaceCwd
        ? (remembered?.models ?? [])
        : []),
    ];
    const configured =
      workspaceCwd && status?.workspaceCwd === workspaceCwd
        ? mapProviderStatus(status).models
        : [];
    const identities = new Map(previous.map((model) => [model.id, model]));
    for (const model of configured) identities.set(model.id, model);
    return {
      models: (connection.models ?? []).map((model) => {
        const updated = findConfiguredComposerModel(
          model,
          previous,
          configured,
        );
        return updated
          ? {
              ...model,
              id: updated.id,
              label: updated.label,
              reasoningPreview: updated.reasoningPreview,
            }
          : model;
      }),
      selected: findConfiguredComposerModel(
        { id: currentModel ?? '', label: '' },
        previous,
        configured,
      ),
      identities: [...identities.values()],
    };
  }, [
    connection.models,
    connection.providers,
    connection.sessionId,
    currentModel,
    status,
    workspaceCwd,
  ]);
  useEffect(() => {
    previousCatalog.current = {
      sessionId: connection.sessionId,
      workspaceCwd,
      models: result.identities,
    };
  }, [connection.sessionId, workspaceCwd, result.identities]);
  return result;
}
