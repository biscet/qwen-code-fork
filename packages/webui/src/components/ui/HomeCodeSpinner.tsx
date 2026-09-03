/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SVGProps } from 'react';

const cells = Array.from({ length: 16 }, (_, index) => ({
  index,
  x: (index % 4) * 4,
  y: Math.floor(index / 4) * 4,
  hidden: index === 0 || index === 3 || index === 12 || index === 15,
}));

export function HomeCodeSpinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 15 15"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      data-homecode-spinner
      {...props}
    >
      {cells.map((cell) =>
        cell.hidden ? null : (
          <rect
            className="homecode-spinner-cell"
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
