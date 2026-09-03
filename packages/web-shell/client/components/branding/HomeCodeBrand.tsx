import type { ComponentPropsWithoutRef } from 'react';
import styles from './HomeCodeBrand.module.css';

type BrandSvgProps = ComponentPropsWithoutRef<'svg'>;

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
