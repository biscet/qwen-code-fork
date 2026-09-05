import type { ComponentPropsWithoutRef } from 'react';
import styles from './HomeCodeBrand.module.css';

type BrandSvgProps = ComponentPropsWithoutRef<'svg'>;

const WORDMARK_CELL = 20;
const WORDMARK_GAP = 12;

type WordmarkGlyph = {
  letter: string;
  tone: 'home' | 'code' | 'chat';
  rows: readonly string[];
  insets: ReadonlyArray<readonly [number, number, number, number]>;
};

type WordmarkGlyphShape = Omit<WordmarkGlyph, 'letter' | 'tone'>;

const WORDMARK_GLYPH_SHAPES: Record<string, WordmarkGlyphShape> = {
  h: {
    rows: ['1000', '1000', '1111', '1001', '1001', '1001'],
    insets: [[1, 4, 2, 2]],
  },
  o: {
    rows: ['0000', '1111', '1001', '1001', '1001', '1111'],
    insets: [[1, 3, 2, 2]],
  },
  m: {
    rows: ['00000', '11111', '10101', '10101', '10101', '10101'],
    insets: [
      [1, 3, 1, 3],
      [3, 3, 1, 3],
    ],
  },
  e: {
    rows: ['0000', '1111', '1000', '1111', '1000', '1111'],
    insets: [[1, 4, 3, 1]],
  },
  c: {
    rows: ['0000', '1111', '1000', '1000', '1000', '1111'],
    insets: [[1, 3, 3, 2]],
  },
  d: {
    rows: ['0001', '1111', '1001', '1001', '1001', '1111'],
    insets: [[1, 3, 2, 2]],
  },
  a: {
    rows: ['0000', '1111', '0001', '1111', '1001', '1111'],
    insets: [[1, 4, 2, 1]],
  },
  t: {
    rows: ['0100', '1111', '0100', '0100', '0100', '0011'],
    insets: [],
  },
};

type PositionedWordmarkGlyph = WordmarkGlyph & {
  x: number;
  path: string;
};

function buildWordmarkLayout(
  word: string,
  productTone: 'code' | 'chat',
): PositionedWordmarkGlyph[] {
  const glyphs: WordmarkGlyph[] = [...word].map((letter, index) => ({
    letter,
    tone: index < 4 ? 'home' : productTone,
    ...WORDMARK_GLYPH_SHAPES[letter],
  }));
  return glyphs.reduce<PositionedWordmarkGlyph[]>((layout, glyph) => {
    const previous = layout.at(-1);
    const x = previous
      ? previous.x + previous.rows[0].length * WORDMARK_CELL + WORDMARK_GAP
      : 0;
    const path = glyph.rows
      .flatMap((row, rowIndex) =>
        [...row].flatMap((cell, columnIndex) =>
          cell === '1'
            ? [
                `M${x + columnIndex * WORDMARK_CELL} ${
                  rowIndex * WORDMARK_CELL
                }h${WORDMARK_CELL}v${WORDMARK_CELL}h-${WORDMARK_CELL}z`,
              ]
            : [],
        ),
      )
      .join('');
    layout.push({ ...glyph, x, path });
    return layout;
  }, []);
}

function wordmarkWidth(layout: PositionedWordmarkGlyph[]): number {
  const last = layout.at(-1)!;
  return last.x + last.rows[0].length * WORDMARK_CELL;
}

const HOMECODE_WORDMARK_LAYOUT = buildWordmarkLayout('homecode', 'code');
const HOMECHAT_WORDMARK_LAYOUT = buildWordmarkLayout('homechat', 'chat');

function Wordmark({
  layout,
  className,
  ...props
}: BrandSvgProps & { layout: PositionedWordmarkGlyph[] }) {
  return (
    <svg
      {...props}
      className={`${styles.wordmark} ${className ?? ''}`.trim()}
      viewBox={`0 0 ${wordmarkWidth(layout)} ${WORDMARK_CELL * 6}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      {layout.map((glyph, index) => (
        <g key={`${glyph.letter}-${index}`}>
          <path
            className={
              glyph.tone === 'home'
                ? styles.wordmarkHome
                : glyph.tone === 'chat'
                  ? styles.wordmarkChat
                  : styles.wordmarkCode
            }
            d={glyph.path}
          />
          {glyph.insets.map(([column, row, width, height], insetIndex) => (
            <rect
              className={styles.wordmarkInset}
              key={insetIndex}
              x={glyph.x + column * WORDMARK_CELL}
              y={row * WORDMARK_CELL}
              width={width * WORDMARK_CELL}
              height={height * WORDMARK_CELL}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function HomeCodeWordmark({ className, ...props }: BrandSvgProps) {
  return (
    <Wordmark
      {...props}
      className={className}
      layout={HOMECODE_WORDMARK_LAYOUT}
      data-homecode-wordmark
    />
  );
}

export function HomeChatWordmark({ className, ...props }: BrandSvgProps) {
  return (
    <Wordmark
      {...props}
      className={className}
      layout={HOMECHAT_WORDMARK_LAYOUT}
      data-homechat-wordmark
    />
  );
}

function PixelMarkPaths({ loading = false }: { loading?: boolean }) {
  return (
    <>
      <rect
        className={loading ? styles.loaderTile : styles.markTile}
        x="4"
        y="4"
        width="92"
        height="92"
        rx="20"
      />
      <path
        className={loading ? styles.loaderBracketLeft : styles.markBracketLeft}
        d="M56.6 24.7H27.1V63.6H43.5V55H34.9V33.5H56.6V24.7Z"
      />
      <path
        className={
          loading ? styles.loaderBracketRight : styles.markBracketRight
        }
        d="M56.6 40.1H72.9V78.9H43.5V70H65V48.8H56.6V40.1Z"
      />
      <rect
        className={`${loading ? styles.loaderPixel : styles.markPixel} ${
          loading ? styles.loaderPixelTop : ''
        }`}
        x="40.3"
        y="40.1"
        width="8.5"
        height="8.7"
      />
      <rect
        className={`${loading ? styles.loaderPixel : styles.markPixel} ${
          loading ? styles.loaderPixelBottom : ''
        }`}
        x="51.1"
        y="55"
        width="8.6"
        height="8.6"
      />
    </>
  );
}

export function HomeCodeMark({ className, ...props }: BrandSvgProps) {
  return (
    <svg
      {...props}
      className={`${styles.mark} ${className ?? ''}`.trim()}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-homecode-mark
    >
      <PixelMarkPaths />
    </svg>
  );
}

export function HomeChatMark({ className, ...props }: BrandSvgProps) {
  return (
    <svg
      {...props}
      className={`${styles.mark} ${className ?? ''}`.trim()}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      data-homechat-mark
    >
      <rect
        className={styles.markTile}
        x="4"
        y="4"
        width="92"
        height="92"
        rx="20"
      />
      <path
        className={styles.chatBubble}
        d="M23 25H77V65H54L42 77V65H23V25ZM32 34V56H48V63L55 56H68V34H32Z"
      />
      <rect className={styles.chatPixel} x="38" y="42" width="8" height="8" />
      <rect className={styles.chatPixel} x="54" y="42" width="8" height="8" />
    </svg>
  );
}

export function HomeCodeLoader({ className, ...props }: BrandSvgProps) {
  return (
    <svg
      {...props}
      className={`${styles.loader} ${className ?? ''}`.trim()}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-homecode-loader
    >
      <PixelMarkPaths loading />
    </svg>
  );
}

const spinnerCells = Array.from({ length: 16 }, (_, index) => ({
  index,
  x: (index % 4) * 4,
  y: Math.floor(index / 4) * 4,
  hidden: index === 0 || index === 3 || index === 12 || index === 15,
}));

export function HomeCodeSpinner({ className, ...props }: BrandSvgProps) {
  return (
    <svg
      {...props}
      className={`${styles.spinner} ${className ?? ''}`.trim()}
      viewBox="0 0 15 15"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      data-homecode-spinner
    >
      {spinnerCells.map((cell) =>
        cell.hidden ? null : (
          <rect
            className={styles.spinnerCell}
            key={cell.index}
            x={cell.x}
            y={cell.y}
            width="3"
            height="3"
            rx="1"
          />
        ),
      )}
    </svg>
  );
}
