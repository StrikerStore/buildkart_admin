import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-6 w-6 rounded', bar: 'h-[3px]', text: 'text-sm' },
  md: { box: 'h-8 w-8 rounded-md', bar: 'h-1', text: 'text-base' },
  lg: { box: 'h-11 w-11 rounded-lg', bar: 'h-[5px]', text: 'text-xl' },
} as const;

/**
 * The wordmark, drawn rather than imported.
 *
 * Three stacked bars in the construction yellow read as courses of brick or
 * stacked sheet material — and, unlike a PNG, it stays crisp at every size and
 * costs no request. Swap for the real logo.png when brand assets land.
 */
export function BuildKartMark({
  size = 'md',
  showText = true,
  tone = 'dark',
  className,
}: {
  size?: keyof typeof SIZES;
  showText?: boolean;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const s = SIZES[size];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex flex-col items-center justify-center gap-[3px] bg-[var(--nav)] px-1.5',
          s.box,
        )}
        aria-hidden="true"
      >
        <span className={cn('w-full rounded-[1px] bg-[var(--brand)]', s.bar)} />
        <span className={cn('w-full rounded-[1px] bg-[var(--brand)] opacity-70', s.bar)} />
        <span className={cn('w-full rounded-[1px] bg-[var(--brand)] opacity-40', s.bar)} />
      </span>

      {showText && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            s.text,
            tone === 'light' ? 'text-white' : 'text-foreground',
          )}
        >
          BuildKart
        </span>
      )}
    </span>
  );
}
