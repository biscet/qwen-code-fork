// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import archiver from 'archiver';
import { describe, expect, it } from 'vitest';
import {
  HomeChatAttachments,
  parseHomeChatFile,
} from './homechat-attachments.js';
import { HomeChatStateStore } from './homechat-state.js';

function pdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(value.length);
    value += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = value.length;
  value += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(value);
}

describe('HomeChat attachment content', () => {
  it('extracts real PDF and DOCX text without workspace tools', async () => {
    expect(
      (await parseHomeChatFile(pdf('PDF probe amber'), 'probe.pdf')).text,
    ).toContain('PDF probe amber');
    const zip = archiver('zip');
    const chunks: Buffer[] = [];
    zip.on('data', (chunk: Buffer) => chunks.push(chunk));
    const ended = new Promise<void>((resolve, reject) => {
      zip.on('end', resolve);
      zip.on('error', reject);
    });
    zip.append(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      { name: '[Content_Types].xml' },
    );
    zip.append(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX probe violet</w:t></w:r></w:p></w:body></w:document>',
      { name: 'word/document.xml' },
    );
    await zip.finalize();
    await ended;
    expect(
      (await parseHomeChatFile(Buffer.concat(chunks), 'probe.docx')).text,
    ).toContain('DOCX probe violet');
  });

  it('accepts extensionless code and rejects binary, empty and oversized content', async () => {
    expect(
      (await parseHomeChatFile(Buffer.from('FROM node:22\n'), 'Dockerfile'))
        .text,
    ).toBe('FROM node:22\n');
    await expect(
      parseHomeChatFile(Buffer.from([0, 255]), 'archive.zip'),
    ).rejects.toThrow('Chat принимает');
    await expect(
      parseHomeChatFile(Buffer.alloc(0), 'empty.txt'),
    ).rejects.toThrow('8 МБ');
    await expect(
      parseHomeChatFile(Buffer.alloc(8 * 1024 * 1024 + 1), 'large.txt'),
    ).rejects.toThrow('8 МБ');
    await expect(
      parseHomeChatFile(Buffer.from('a'.repeat(128_001)), 'large.txt'),
    ).rejects.toThrow('128 000');
  });

  it('persists only uploaded context and never resolves another chat or local paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'homechat-files-'));
    const chat = 'homechat-018f0ec4-31c4-4f2f-9c1f-5f47e6be37f1';
    const other = 'homechat-018f0ec4-31c4-4f2f-9c1f-5f47e6be37f2';
    try {
      const files = new HomeChatAttachments(new HomeChatStateStore(directory));
      const uploaded = await files.put(
        chat,
        Buffer.from('unique private probe'),
        '../../probe.txt',
      );
      expect(uploaded.name).toBe('probe.txt');
      const restored = new HomeChatAttachments(
        new HomeChatStateStore(directory),
      );
      expect((await restored.read(chat, [uploaded.id]))[0]?.text).toBe(
        'unique private probe',
      );
      await expect(restored.read(other, [uploaded.id])).rejects.toThrow(
        'недоступно',
      );
      await expect(restored.read(chat, ['../../state.json'])).rejects.toThrow(
        'Некорректное',
      );
      await files.delete(chat);
      await expect(restored.read(chat, [uploaded.id])).rejects.toThrow(
        'недоступно',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
