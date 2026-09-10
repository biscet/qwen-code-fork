export const HOMECHAT_OPTIONS_CHANGED = 'homechat-options-changed';
export const HOMECHAT_CODEX_PROVIDER = 'homecode-codex';

export interface HomeChatModel {
  providerId: string;
  key: string;
  name: string;
  providerName: string;
  reasoning: boolean;
  reasoningEfforts?: string[];
  defaultReasoningEffort?: string;
}

export interface HomeChatOptions {
  chatModel: { providerId: string; key: string };
  thinking: boolean;
  effort: string;
  optimizationMode: 'speed' | 'balanced' | 'quality';
}

export interface HomeChatModelCatalog {
  models: HomeChatModel[];
  options?: HomeChatOptions;
}

export interface HomeChatConnection {
  apiKeyConfigured: boolean;
  requiresApiKey: boolean;
}

export interface HomeChatSummary {
  id: string;
  title: string;
  createdAt: string;
  archived?: boolean;
  pinned?: boolean;
  engine?: 'codex';
}

export interface HomeChatChunk {
  content: string;
  metadata?: {
    title?: string;
    url?: string;
  };
}

export type HomeChatBlock =
  | { id: string; type: 'text'; data: string }
  | { id: string; type: 'source'; data: HomeChatChunk[] }
  | {
      id: string;
      type: 'research';
      data: {
        subSteps: Array<{
          id: string;
          type: string;
          searching?: string[];
          reading?: HomeChatChunk[];
          reasoning?: string;
        }>;
      };
    }
  | { id: string; type: 'error'; data: { message?: string } }
  | { id: string; type: 'suggestion'; data: string[] }
  | { id: string; type: 'widget'; data: unknown };

export interface HomeChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface HomeChatMessage {
  messageId: string;
  chatId: string;
  query: string;
  createdAt: string;
  responseBlocks: HomeChatBlock[];
  status?: string;
  attachments?: HomeChatAttachment[];
}

interface HomeChatPatch {
  op: string;
  path: string;
  value?: unknown;
}

export type HomeChatStreamEvent =
  | { type: 'block'; block: HomeChatBlock }
  | { type: 'updateBlock'; blockId: string; patch: HomeChatPatch[] }
  | { type: 'researchComplete' }
  | { type: 'messageEnd'; stopped?: boolean }
  | { type: 'error'; data?: unknown };

function headers(token?: string, json = false): HeadersInit {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // The status below is still useful when the daemon returns an empty body.
  }
  return new Error(`HomeChat request failed (${response.status})`);
}

export async function loadHomeChatModels(
  baseUrl: string,
  token?: string,
): Promise<HomeChatModelCatalog> {
  const response = await fetch(endpoint(baseUrl, '/homechat/models'), {
    headers: headers(token),
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<HomeChatModelCatalog>;
}

export async function loadHomeChatConnection(
  baseUrl: string,
  token?: string,
): Promise<HomeChatConnection> {
  const response = await fetch(endpoint(baseUrl, '/homechat/connection'), {
    headers: headers(token),
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<HomeChatConnection>;
}

export async function saveHomeChatConnection(
  baseUrl: string,
  token: string | undefined,
  apiKey: string,
): Promise<HomeChatConnection> {
  const response = await fetch(endpoint(baseUrl, '/homechat/connection'), {
    method: 'PUT',
    headers: headers(token, true),
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw await responseError(response);
  globalThis.dispatchEvent?.(new Event(HOMECHAT_OPTIONS_CHANGED));
  return response.json() as Promise<HomeChatConnection>;
}

export async function saveHomeChatOptions(
  baseUrl: string,
  token: string | undefined,
  options: HomeChatOptions,
): Promise<void> {
  const response = await fetch(endpoint(baseUrl, '/homechat/options'), {
    method: 'PUT',
    headers: headers(token, true),
    body: JSON.stringify(options),
  });
  if (!response.ok) throw await responseError(response);
  globalThis.dispatchEvent?.(new Event(HOMECHAT_OPTIONS_CHANGED));
}

export async function updateHomeChat(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
  flags: { archived?: boolean; pinned?: boolean },
): Promise<void> {
  const response = await fetch(
    endpoint(baseUrl, `/homechat/chats/${encodeURIComponent(chatId)}`),
    {
      method: 'PATCH',
      headers: headers(token, true),
      body: JSON.stringify(flags),
    },
  );
  if (!response.ok) throw await responseError(response);
}

export async function loadHomeChatList(
  baseUrl: string,
  token?: string,
): Promise<HomeChatSummary[]> {
  const response = await fetch(endpoint(baseUrl, '/homechat/chats'), {
    headers: headers(token),
  });
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { chats?: HomeChatSummary[] };
  return Array.isArray(body.chats) ? body.chats : [];
}

export async function loadHomeChat(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
): Promise<HomeChatMessage[]> {
  return (await loadHomeChatDetails(baseUrl, token, chatId)).messages ?? [];
}

export async function loadHomeChatDetails(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
): Promise<{
  messages: HomeChatMessage[];
  options?: HomeChatOptions;
  engine?: 'codex';
}> {
  const response = await fetch(
    endpoint(baseUrl, `/homechat/chats/${encodeURIComponent(chatId)}`),
    { headers: headers(token) },
  );
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as {
    messages?: HomeChatMessage[];
    options?: HomeChatOptions;
    engine?: 'codex';
  };
  return {
    ...body,
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
}

export async function stopHomeChat(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
): Promise<void> {
  const response = await fetch(
    endpoint(baseUrl, `/homechat/chats/${encodeURIComponent(chatId)}/stop`),
    { method: 'POST', headers: headers(token) },
  );
  if (!response.ok) throw await responseError(response);
}

export async function deleteHomeChat(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
): Promise<void> {
  const response = await fetch(
    endpoint(baseUrl, `/homechat/chats/${encodeURIComponent(chatId)}`),
    { method: 'DELETE', headers: headers(token) },
  );
  if (!response.ok) throw await responseError(response);
}

export async function uploadHomeChatAttachment(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
  file: File,
  signal?: AbortSignal,
): Promise<HomeChatAttachment> {
  const response = await fetch(
    endpoint(
      baseUrl,
      `/homechat/chats/${encodeURIComponent(chatId)}/attachments?name=${encodeURIComponent(file.name)}`,
    ),
    {
      method: 'POST',
      headers: {
        ...headers(token),
        'Content-Type': 'application/octet-stream',
      },
      body: file,
      signal,
    },
  );
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<HomeChatAttachment>;
}

export async function removeHomeChatUpload(
  baseUrl: string,
  token: string | undefined,
  chatId: string,
  id: string,
): Promise<void> {
  const response = await fetch(
    endpoint(
      baseUrl,
      `/homechat/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(id)}`,
    ),
    {
      method: 'DELETE',
      headers: headers(token),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) throw await responseError(response);
}

export async function* streamHomeChat(
  baseUrl: string,
  token: string | undefined,
  body: {
    messageId: string;
    chatId: string;
    content: string;
    history: Array<['human' | 'assistant', string]>;
    options?: HomeChatOptions;
    attachments?: string[];
  },
  signal?: AbortSignal,
): AsyncGenerator<HomeChatStreamEvent> {
  const attempts =
    body.options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let ended = false;
    try {
      for await (const event of streamHomeChatOnce(
        baseUrl,
        token,
        body,
        signal,
      )) {
        if (event.type === 'messageEnd' || event.type === 'error') ended = true;
        yield event;
      }
      if (ended || attempts === 1) return;
      if (attempt + 1 === attempts)
        throw new Error(
          'Соединение Codex прервано. Запрос сохранён и не отправлен повторно.',
        );
    } catch (error) {
      if (
        signal?.aborted ||
        !(error instanceof TypeError || error instanceof SyntaxError) ||
        attempt + 1 === attempts
      )
        throw error;
    }
  }
}

async function* streamHomeChatOnce(
  baseUrl: string,
  token: string | undefined,
  body: {
    messageId: string;
    chatId: string;
    content: string;
    history: Array<['human' | 'assistant', string]>;
    options?: HomeChatOptions;
    attachments?: string[];
  },
  signal?: AbortSignal,
): AsyncGenerator<HomeChatStreamEvent> {
  const response = await fetch(endpoint(baseUrl, '/homechat/chat'), {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) throw await responseError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as HomeChatStreamEvent;
      }
      if (chunk.done) break;
    }
    if (pending.trim()) yield JSON.parse(pending) as HomeChatStreamEvent;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function applyHomeChatEvent(
  blocks: HomeChatBlock[],
  event: HomeChatStreamEvent,
): HomeChatBlock[] {
  if (event.type === 'block') {
    const existing = blocks.findIndex((block) => block.id === event.block.id);
    return existing === -1
      ? [...blocks, event.block]
      : blocks.map((block, index) =>
          index === existing ? event.block : block,
        );
  }
  if (event.type !== 'updateBlock') return blocks;
  return blocks.map((block) => {
    if (block.id !== event.blockId) return block;
    let next = block;
    for (const patch of event.patch) {
      if (patch.op !== 'replace') continue;
      if (patch.path === '/data') {
        next = { ...next, data: patch.value } as HomeChatBlock;
      } else if (
        patch.path === '/data/subSteps' &&
        next.type === 'research' &&
        Array.isArray(patch.value)
      ) {
        next = { ...next, data: { subSteps: patch.value } } as HomeChatBlock;
      }
    }
    return next;
  });
}

export function messageText(message: HomeChatMessage): string {
  return message.responseBlocks
    .filter(
      (block): block is Extract<HomeChatBlock, { type: 'text' }> =>
        block.type === 'text',
    )
    .map((block) => block.data)
    .join('\n\n');
}
