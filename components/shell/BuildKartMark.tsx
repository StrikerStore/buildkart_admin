import { cn } from '@/lib/utils';

const HEIGHTS = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-11',
} as const;

/**
 * The BuildKart logo, from BuildKart_Professional_Logo_Pack.
 *
 * `showText` picks the artwork: the full horizontal logo, or the cart-and-house
 * mark alone for tight spaces. Both are pre-sized copies in `public/brand/` —
 * the pack's own full logo is a 1167px PNG, and its SVG is that same PNG in a
 * wrapper rather than vector paths, so neither was fit to load on every page.
 *
 * `tone` names the ground it sits on, as before. The artwork is half charcoal —
 * the cart and "Build" — and the pack deliberately ships no light version, to
 * keep the design unaltered. On the charcoal nav rail and sign-in panel that
 * half would vanish, so `tone="light"` sets the logo on a white plate instead
 * of recolouring it.
 */
export function BuildKartMark({
  size = 'md',
  showText = true,
  tone = 'dark',
  className,
}: {
  size?: keyof typeof HEIGHTS;
  showText?: boolean;
  /** `light` for a dark ground: the logo sits on a white plate. */
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={showText ? '/brand/logo.png' : '/brand/logo-mark.png'}
      alt="BuildKart"
      width={showText ? 318 : 96}
      height={96}
      className={cn(HEIGHTS[size], 'w-auto')}
    />
  );

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center',
        tone === 'light' && 'rounded-md bg-white px-2 py-1.5',
        className,
      )}
    >
      {image}
    </span>
  );
}
