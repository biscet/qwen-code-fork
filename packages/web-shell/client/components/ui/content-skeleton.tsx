import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

type ContentSkeletonVariant =
  | 'detail'
  | 'form'
  | 'list'
  | 'navigation'
  | 'table';

interface ContentSkeletonProps {
  label: string;
  variant?: ContentSkeletonVariant;
  rows?: number;
  className?: string;
}

const lineWidths = ['w-2/5', 'w-3/5', 'w-1/2', 'w-4/6'];

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      data-motion-item
      className="flex min-w-0 items-center gap-3 rounded-md border border-border px-4 py-3"
    >
      <Skeleton className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton
          className={`h-3.5 ${lineWidths[index % lineWidths.length]}`}
        />
        <Skeleton className="h-2.5 w-4/5" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0" />
    </div>
  );
}

export function ContentSkeleton({
  label,
  variant = 'list',
  rows = 4,
  className,
}: ContentSkeletonProps) {
  const items = Array.from({ length: rows }, (_, index) => index);
  return (
    <div
      data-slot="content-skeleton"
      data-variant={variant}
      role="status"
      aria-label={label}
      className={cn('w-full', className)}
    >
      <span className="sr-only">{label}</span>
      {variant === 'navigation' ? (
        <div className="grid gap-2">
          {items.map((index) => (
            <div
              key={index}
              data-motion-item
              className="flex items-center gap-2 px-2.5 py-1.5"
            >
              <Skeleton className="size-4 shrink-0" />
              <Skeleton
                className={`h-3 flex-1 ${index % 3 === 1 ? 'max-w-24' : 'max-w-32'}`}
              />
              <Skeleton className="h-3 w-4 shrink-0" />
            </div>
          ))}
        </div>
      ) : variant === 'detail' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">
            {items.map((index) => (
              <div key={index} data-motion-item className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton
                  className={`h-3.5 ${lineWidths[index % lineWidths.length]}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : variant === 'form' ? (
        <div className="space-y-5 rounded-lg border border-border p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          {items.map((index) => (
            <div key={index} data-motion-item className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : variant === 'table' ? (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          {items.map((index) => (
            <div
              key={index}
              data-motion-item
              className="flex gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-1/5" />
              <Skeleton className="h-3.5 w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((index) => (
            <SkeletonRow key={index} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
