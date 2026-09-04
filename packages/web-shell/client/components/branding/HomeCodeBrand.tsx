import type { ComponentPropsWithoutRef } from 'react';
import styles from './HomeCodeBrand.module.css';

type BrandSvgProps = ComponentPropsWithoutRef<'svg'>;

const WORDMARK_CELL = 20;
const WORDMARK_GAP = 12;

type WordmarkGlyph = {
  letter: string;
  tone: 'home' | 'code';
  rows: readonly string[];
  insets: ReadonlyArray<readonly [number, number, number, number]>;
};

const WORDMARK_GLYPHS: readonly WordmarkGlyph[] = [
  {
    letter: 'h',
    tone: 'home',
    rows: ['1000', '1000', '1111', '1001', '1001', '1001'],
    insets: [[1, 4, 2, 2]],
  },
  {
    letter: 'o',
    tone: 'home',
    rows: ['0000', '1111', '1001', '1001', '1001', '1111'],
    insets: [[1, 3, 2, 2]],
  },
  {
    letter: 'm',
    tone: 'home',
    rows: ['00000', '11111', '10101', '10101', '10101', '10101'],
    insets: [
      [1, 3, 1, 3],
      [3, 3, 1, 3],
    ],
  },
  {
    letter: 'e',
    tone: 'home',
    rows: ['0000', '1111', '1000', '1111', '1000', '1111'],
    insets: [[1, 4, 3, 1]],
  },
  {
    letter: 'c',
    tone: 'code',
    rows: ['0000', '1111', '1000', '1000', '1000', '1111'],
    insets: [[1, 3, 3, 2]],
  },
  {
    letter: 'o',
    tone: 'code',
    rows: ['0000', '1111', '1001', '1001', '1001', '1111'],
    insets: [[1, 3, 2, 2]],
  },
  {
    letter: 'd',
    tone: 'code',
    rows: ['0001', '1111', '1001', '1001', '1001', '1111'],
    insets: [[1, 3, 2, 2]],
  },
  {
    letter: 'e',
    tone: 'code',
    rows: ['0000', '1111', '1000', '1111', '1000', '1111'],
    insets: [[1, 4, 3, 1]],
  },
];

type PositionedWordmarkGlyph = WordmarkGlyph & {
  x: number;
  path: string;
};

const WORDMARK_LAYOUT = WORDMARK_GLYPHS.reduce<PositionedWordmarkGlyph[]>(
  (glyphs, glyph) => {
    const previous = glyphs.at(-1);
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
    glyphs.push({ ...glyph, x, path });
    return glyphs;
  },
  [],
);

const FINAL_WORDMARK_GLYPH = WORDMARK_LAYOUT.at(-1)!;
const WORDMARK_WIDTH =
  FINAL_WORDMARK_GLYPH.x + FINAL_WORDMARK_GLYPH.rows[0].length * WORDMARK_CELL;

export function HomeCodeWordmark({ className, ...props }: BrandSvgProps) {
  return (
    <svg
      {...props}
      className={`${styles.wordmark} ${className ?? ''}`.trim()}
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_CELL * 6}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      data-homecode-wordmark
    >
      {WORDMARK_LAYOUT.map((glyph, index) => (
        <g key={`${glyph.letter}-${index}`}>
          <path
            className={
              glyph.tone === 'home' ? styles.wordmarkHome : styles.wordmarkCode
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
