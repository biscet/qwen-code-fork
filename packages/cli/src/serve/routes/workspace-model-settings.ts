/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Application, Request, RequestHandler, Response } from 'express';
import { loadSettings } from '../../config/settings.js';
import {
  buildModelSettingsWrites,
  buildModelSettingsDeleteWrites,
  checkModelLimits,
  findSettingsModel,
  ModelSettingsInputError,
  modelSettingsSnapshot,
  parseModelScope,
  parseModelTarget,
  record,
  settingScope,
  type ModelSettingsScope,
} from '../model-settings.js';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';
import type {
  WorkspaceSettingsWrite,
  ServeModelProviderReplacement,
} from '../workspace-service/types.js';
import { WorkspaceSettingsPartialPersistError } from '../workspace-service/types.js';
import {
  requireTrustedWorkspaceRuntime,
  resolveWorkspaceRuntimeFromParam,
  sendGenerationClosedError,
  sendWorkspaceRuntimeUnavailable,
} from '../workspace-route-runtime.js';
import { parseAndValidateWorkspaceClientId } from '../server/request-helpers.js';

interface ModelSettingsRouteDeps {
  workspaceRegistry: WorkspaceRegistry;
  mutate: (opts?: { strict?: boolean }) => RequestHandler;
  persistSettings: (
    workspace: string,
    writes: WorkspaceSettingsWrite[],
    assertGenerationOpen?: () => void,
  ) => Promise<void>;
  request?: typeof fetch;
}

// User-scoped model edits share one file across all selected runtimes.
const writesInFlight = new Map<string, Promise<unknown>>();

export function registerWorkspaceModelSettingsRoutes(
  app: Application,
  deps: ModelSettingsRouteDeps,
): void {
  const resolve = (req: Request, res: Response): WorkspaceRuntime | null => {
    const runtime = req.params['workspace']
      ? resolveWorkspaceRuntimeFromParam(deps.workspaceRegistry, req, res)
      : deps.workspaceRegistry.primaryEntry.state === 'active'
        ? deps.workspaceRegistry.primaryEntry.current?.runtime
        : undefined;
    if (!runtime) {
      if (!res.headersSent) sendWorkspaceRuntimeUnavailable(res);
      return null;
    }
    return requireTrustedWorkspaceRuntime(runtime, res) ? runtime : null;
  };
  const load = (runtime: WorkspaceRuntime) =>
    loadSettings(runtime.workspaceCwd, {
      skipLoadEnvironment: true,
      workspaceTrusted: runtime.trusted,
      skipWorkspaceSettings: !runtime.trusted,
    });
  const respondError = (res: Response, error: unknown) => {
    if (sendGenerationClosedError(res, error)) return;
    res
      .status(error instanceof ModelSettingsInputError ? error.status : 500)
      .json({
        error:
          error instanceof ModelSettingsInputError
            ? error.message
            : 'Не удалось обновить настройки модели.',
        code:
          error instanceof ModelSettingsInputError
            ? 'invalid_model_settings'
            : 'model_settings_failed',
      });
  };
  const synchronize = async (
    runtime: WorkspaceRuntime,
    scope: ModelSettingsScope,
    replacement?: ServeModelProviderReplacement,
    method = 'PUT',
  ) => {
    const runtimes =
      scope === 'user'
        ? deps.workspaceRegistry
            .listAll()
            .filter((item) => item.trusted && !item.generationGuard?.closed)
        : [runtime];
    const results = await Promise.allSettled(
      runtimes.map(async (item) =>
        item.workspaceService.reloadModelProviders(
          {
            route: `${method} /workspaces/:workspace/model-settings`,
            workspaceCwd: item.workspaceCwd,
          },
          replacement &&
            (scope === 'workspace' ||
              parseModelScope(undefined, load(item)) === 'user')
            ? replacement
            : undefined,
        ),
      ),
    );
    runtime.generationGuard?.assertOpen();
    let notificationFailed = false;
    for (const item of runtimes) {
      if (!item.generationGuard?.closed) {
        try {
          item.bridge.publishWorkspaceEvent({
            type: 'settings_changed',
            data: { key: 'modelProviders', value: null, scope },
          });
        } catch {
          notificationFailed = true;
        }
      }
    }
    return {
      status:
        notificationFailed ||
        results.some(
          (result) =>
            result.status === 'rejected' || result.value.status === 'failed',
        )
          ? ('failed' as const)
          : results.some(
                (result) =>
                  result.status === 'fulfilled' &&
                  result.value.status === 'applied',
              )
            ? ('applied' as const)
            : ('deferred' as const),
    };
  };

  const paths = [
    '/workspace/model-settings',
    '/workspaces/:workspace/model-settings',
  ];
  app.get(paths, (req, res) => {
    const runtime = resolve(req, res);
    if (!runtime) return;
    try {
      runtime.generationGuard?.assertOpen();
      const settings = load(runtime);
      const scope = parseModelScope(req.query['scope'], settings);
      res.json(
        modelSettingsSnapshot(
          settings,
          runtime.workspaceCwd,
          scope,
          runtime.env.effectiveEnv ?? {},
        ),
      );
    } catch (error) {
      respondError(res, error);
    }
  });

  const saveOrDelete: RequestHandler = async (req, res) => {
    const runtime = resolve(req, res);
    if (!runtime) return;
    if (parseAndValidateWorkspaceClientId(req, res, runtime.bridge) === null)
      return;
    try {
      const body = record(req.body);
      const scope = parseModelScope(body['scope']);
      const lockKey = scope === 'user' ? 'user' : runtime.workspaceCwd;
      const execute = async () => {
        const assertOpen = () => runtime.generationGuard?.assertOpen();
        assertOpen();
        const { writes, replacement } = (
          req.method === 'DELETE'
            ? buildModelSettingsDeleteWrites
            : buildModelSettingsWrites
        )(load(runtime), body);
        try {
          await deps.persistSettings(runtime.workspaceCwd, writes, assertOpen);
        } catch (error) {
          if (error instanceof WorkspaceSettingsPartialPersistError)
            await synchronize(runtime, scope, undefined, req.method);
          throw error;
        }
        assertOpen();
        const runtimeSync = await synchronize(
          runtime,
          scope,
          replacement,
          req.method,
        );
        return {
          ...modelSettingsSnapshot(
            load(runtime),
            runtime.workspaceCwd,
            scope,
            runtime.env.effectiveEnv ?? {},
          ),
          runtimeSync,
        };
      };
      const previous = writesInFlight.get(lockKey) ?? Promise.resolve();
      const pending = previous.then(execute, execute);
      writesInFlight.set(lockKey, pending);
      try {
        res.json(await pending);
      } finally {
        if (writesInFlight.get(lockKey) === pending)
          writesInFlight.delete(lockKey);
      }
    } catch (error) {
      respondError(res, error);
    }
  };
  app.put(paths, deps.mutate({ strict: true }), saveOrDelete);
  app.delete(paths, deps.mutate({ strict: true }), saveOrDelete);

  app.post(
    paths.map((path) => `${path}/check`),
    deps.mutate({ strict: true }),
    async (req, res) => {
      const runtime = resolve(req, res);
      if (!runtime) return;
      if (parseAndValidateWorkspaceClientId(req, res, runtime.bridge) === null)
        return;
      try {
        runtime.generationGuard?.assertOpen();
        const body = record(req.body);
        const scope = parseModelScope(body['scope']);
        const settings = load(runtime);
        const scoped = settings.forScope(settingScope(scope)).settings;
        const { model } = findSettingsModel(
          scoped.modelProviders ??
            (scope === 'workspace'
              ? settings.merged.modelProviders
              : undefined) ??
            {},
          parseModelTarget(body['target']),
        );
        const apiKey = model.envKey
          ? (scoped.env?.[model.envKey] ??
            (scope === 'workspace'
              ? settings.merged.env?.[model.envKey]
              : undefined) ??
            (scope === 'workspace' ||
            parseModelScope(undefined, settings) === scope
              ? runtime.env.effectiveEnv?.[model.envKey]
              : undefined))
          : undefined;
        const result = await checkModelLimits(model, apiKey, deps.request);
        runtime.generationGuard?.assertOpen();
        res.json(result);
      } catch (error) {
        respondError(res, error);
      }
    },
  );
}
