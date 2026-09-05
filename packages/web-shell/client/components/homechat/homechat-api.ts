export interface HomeChatSummary {
  id: string;
  title: string;
  createdAt: string;
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

export interface HomeChatMessage {
  messageId: string;
  chatId: string;
  query: string;
  createdAt: string;
  responseBlocks: HomeChatBlock[];
  status?: string;
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
  | { type: 'messageEnd' }
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
  const response = await fetch(
    endpoint(baseUrl, `/homechat/chats/${encodeURIComponent(chatId)}`),
    { headers: headers(token) },
  );
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { messages?: HomeChatMessage[] };
  return Array.isArray(body.messages) ? body.messages : [];
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

export async function* streamHomeChat(
  baseUrl: string,
  token: string | undefined,
  body: {
    messageId: string;
    chatId: string;
    content: string;
    history: Array<['human' | 'assistant', string]>;
  },
): AsyncGenerator<HomeChatStreamEvent> {
  const response = await fetch(endpoint(baseUrl, '/homechat/chat'), {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw await responseError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
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
