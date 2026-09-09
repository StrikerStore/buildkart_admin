import { cn } from '@/lib/utils';
import type { TagScope, TagTone } from '@buildkart/contract';

/**
 * Tone maps to meaning, not to a fixed colour, so the palette can change
 * without editing every tag.
 */
const TONE_CLASSES: Record<TagTone, string> = {
  NEUTRAL: 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
  BRAND: 'bg-[var(--brand-subdued)] text-[var(--brand-foreground)]',
  SUCCESS: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  WARNING: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  CRITICAL: 'bg-[var(--critical-bg)] text-[var(--critical-fg)]',
  INFO: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
};

export function TagBadge({
  label,
  tone = 'NEUTRAL',
  scope,
  className,
}: {
  label: string;
  tone?: TagTone;
  /** When INTERNAL, the badge is marked so it is never mistaken for customer-facing. */
  scope?: TagScope;
  className?: string;
}) {
  const isInternal = scope === 'INTERNAL';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        // A dashed outline reads as "not final, not public" at a glance, so an
        // internal workflow label can never be confused with a Bestseller badge.
        isInternal && 'border border-dashed border-current/30',
        className,
      )}
    >
      {isInternal && (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-50" />
      )}
      {label}
    </span>
  );
}
