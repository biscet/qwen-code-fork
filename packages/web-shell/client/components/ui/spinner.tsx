import { cn } from '@/lib/utils';
import { HomeCodeSpinner } from '../branding/HomeCodeBrand';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <HomeCodeSpinner
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn('size-4', className)}
      {...props}
    />
  );
}

export { Spinner };
