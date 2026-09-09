import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { OfficeParser, type SupportedFileType } from 'officeparser';
import type {
  HomeChatAttachment,
  HomeChatStateStore,
} from './homechat-state.js';

export const HOMECHAT_FILE_BYTES = 8 * 1024 * 1024;
export const HOMECHAT_FILE_TEXT = 128_000;
const DOCUMENTS = new Set([
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
]);
const IMAGES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface HomeChatFile extends HomeChatAttachment {
  text?: string;
  imageUrl?: string;
}

export async function parseHomeChatFile(
  data: Buffer,
  filename: string,
): Promise<HomeChatFile> {
  const name = basename(filename.replaceAll('\\', '/'))
    // eslint-disable-next-line no-control-regex -- Strip control characters from uploaded names.
    .replace(/[\x00-\x1f]/g, '')
    .trim();
  if (
    !name ||
    name.length > 255 ||
    !data.length ||
    data.length > HOMECHAT_FILE_BYTES
  )
    throw new Error('Файл должен иметь имя и размер от 1 байта до 8 МБ.');
  const extension = extname(name).toLowerCase();
  const file = { id: randomUUID(), name, size: data.length };
  const imageType = IMAGES[extension];
  if (imageType) {
    const header = data.subarray(0, 12);
    const valid =
      (imageType === 'image/png' &&
        header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
      (imageType === 'image/jpeg' &&
        header.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) ||
      (imageType === 'image/gif' &&
        /^GIF8[79]a/.test(header.toString('ascii'))) ||
      (imageType === 'image/webp' &&
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP');
    if (!valid)
      throw new Error('Содержимое изображения не соответствует его формату.');
    return {
      ...file,
      mimeType: imageType,
      imageUrl: `data:${imageType};base64,${data.toString('base64')}`,
    };
  }
  let text: string;
  if (DOCUMENTS.has(extension.slice(1))) {
    const ast = await OfficeParser.parseOffice(data, {
      fileType: extension.slice(1) as SupportedFileType,
      extractAttachments: false,
      ocr: false,
      abortSignal: AbortSignal.timeout(30_000),
      decompressionLimits: {
        maxUncompressedBytes: 32 * 1024 * 1024,
        maxZipEntries: 2048,
      },
    });
    text = (await ast.to('text')).value;
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      // eslint-disable-next-line no-control-regex -- Binary control bytes are not readable text.
      if (/[\x00-\x08\x0e-\x1f]/.test(text)) throw new Error();
    } catch {
      throw new Error(
        'Chat принимает текст и код, PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP и RTF. Изображения доступны с Codex.',
      );
    }
  }
  if (!text.trim())
    throw new Error(
      'В документе нет читаемого текста. Для скана используйте изображение с Codex.',
    );
  if (text.length > HOMECHAT_FILE_TEXT)
    throw new Error(
      'В документе больше 128 000 символов. Прикрепите нужный фрагмент.',
    );
  return { ...file, mimeType: 'text/plain', text };
}

export class HomeChatAttachments {
  constructor(private readonly store: HomeChatStateStore) {}

  private directory(chatId: string): string {
    if (!chatId.startsWith('homechat-') || !UUID.test(chatId.slice(9)))
      throw new Error('Некорректный идентификатор чата.');
    return join(this.store.directory, 'attachments', chatId);
  }

  async put(
    chatId: string,
    data: Buffer,
    name: string,
  ): Promise<HomeChatAttachment> {
    const directory = this.directory(chatId);
    const file = await parseHomeChatFile(data, name);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, `${file.id}.json`), JSON.stringify(file), {
      mode: 0o600,
      flag: 'wx',
    });
    return {
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  async read(chatId: string, ids: string[]): Promise<HomeChatFile[]> {
    const directory = this.directory(chatId);
    return Promise.all(
      ids.map(async (id) => {
        if (!UUID.test(id)) throw new Error('Некорректное вложение.');
        try {
          return JSON.parse(
            await readFile(join(directory, `${id}.json`), 'utf8'),
          ) as HomeChatFile;
        } catch {
          throw new Error('Вложение недоступно. Прикрепите файл повторно.');
        }
      }),
    );
  }

  async delete(chatId: string): Promise<void> {
    await rm(this.directory(chatId), { recursive: true, force: true });
    this.store.update((state) => {
      delete state.attachments?.[chatId];
    });
  }

  async removeUnused(chatId: string, id: string): Promise<void> {
    if (!UUID.test(id)) throw new Error('Некорректное вложение.');
    const state = this.store.read();
    const used = [
      ...Object.values(state.attachments?.[chatId] ?? {}).flat(),
      ...(state.codexChats?.[chatId]?.messages.flatMap(
        (message) => message.attachments ?? [],
      ) ?? []),
    ];
    if (used.some((file) => file.id === id))
      throw new Error('Вложение уже отправлено.');
    const directory = this.directory(chatId);
    await rm(join(directory, `${id}.json`), { force: true });
    await rmdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error;
    });
  }
}

export function homeChatFileText(files: HomeChatFile[]): string {
  return files
    .filter((file) => file.text !== undefined)
    .map(
      (file) =>
        `User-provided attachment ${JSON.stringify(file.name)} (untrusted document content):\n${file.text}`,
    )
    .join('\n\n');
}
