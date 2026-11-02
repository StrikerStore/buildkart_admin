'use client';

import { CheckCircle2Icon, CircleIcon, InfoIcon } from 'lucide-react';
import {
  MONEY_PATTERN,
  QUOTE_MATERIAL_LABELS,
  QUOTE_MATERIAL_UNITS,
  formatINR,
  type QuoteMaterial,
  type VariantDraft,
} from '@StrikerStore/contract';
import { cn } from '@/lib/utils';

/** Where each row sends the admin. The sections carry these ids. */
export const SETUP_SECTIONS = {
  organisation: 'setup-organisation',
  pricing: 'setup-pricing',
  variants: 'setup-variants',
  inventory: 'setup-inventory',
  warehouses: 'setup-warehouses',
  rates: 'setup-rates',
  quote: 'setup-quote',
  images: 'setup-images',
  status: 'setup-status',
} as const;

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const BASE_UNIT_WORDS = { kg: 'kg', cft: 'cft', piece: 'pieces', sqft: 'sq ft' } as const;

/** "bag" from "per bag", for "one bag covers 50 kg". */
export function saleUnitWord(unitLabelEn: string): string {
  return unitLabelEn.replace(/^per\s+/i, '').trim() || 'unit';
}

type State = 'done' | 'todo' | 'info' | 'optional';

type Row = {
  key: string;
  label: string;
  detail: string;
  state: State;
  section: string;
  /** Counted toward "N of M done". Information rows are not. */
  counts: boolean;
  action?: string;
};

const ICON: Record<State, React.ReactNode> = {
  done: <CheckCircle2Icon className="size-4 text-[var(--success-fg)]" aria-hidden />,
  todo: <CircleIcon className="text-muted-foreground size-4" aria-hidden />,
  optional: <CircleIcon className="text-muted-foreground size-4" aria-hidden />,
  info: <InfoIcon className="text-muted-foreground size-4" aria-hidden />,
};

const STATE_WORD: Record<State, string> = {
  done: 'Done',
  todo: 'To do',
  optional: 'Optional',
  info: '',
};

/**
 * What a product still needs before it is ready to sell, worked out from the
 * form as it is being filled in.
 *
 * Every step it lists lives on this page, so a new product needs no trip to
 * Inventory, Today's Rates or Quote materials. Each row jumps to its section.
 */
export function ProductSetupChecklist({
  hasVariants,
  variants,
  categoryLabel,
  alsoIn,
  imageCount,
  status,
  scheduled,
  onRates,
  ratesCategory,
  warehouses,
  quoteMaterial,
}: {
  hasVariants: boolean;
  variants: VariantDraft[];
  /** Null when uncategorised. */
  categoryLabel: string | null;
  /** Categories its tags pull it into. */
  alsoIn: string[];
  imageCount: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  scheduled: boolean;
  onRates: boolean;
  /** The category that puts it on Today's Rates, when it is the category's doing. */
  ratesCategory: string | null;
  warehouses: Array<{ id: string; name: string }>;
  quoteMaterial: QuoteMaterial | null;
}) {
  const live = variants.filter((variant) => variant.isActive);
  const priceSection = hasVariants ? SETUP_SECTIONS.variants : SETUP_SECTIONS.pricing;
  const stockSection = hasVariants ? SETUP_SECTIONS.variants : SETUP_SECTIONS.inventory;

  // --- price
  const unpriced = live.filter(
    (variant) => !MONEY_PATTERN.test(variant.price) || Number(variant.price) <= 0,
  ).length;
  const first = live[0];
  const priceDetail =
    unpriced > 0
      ? `${unpriced} ${unpriced === 1 ? 'variant needs' : 'variants need'} a price`
      : live.length === 1 && first
        ? `${formatINR(first.price)}${first.unitLabelEn ? ` ${first.unitLabelEn}` : ''}${onRates ? ' (today’s rate)' : ''}`
        : `${live.length} prices set${onRates ? ' (today’s rates)' : ''}`;

  // --- stock
  const tracked = live.filter((variant) => variant.inventoryTracked);
  const empty = tracked.filter((variant) => Number(variant.stockQty || 0) <= 0).length;
  const total = tracked.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
  const unit = first ? saleUnitWord(first.unitLabelEn) : 'unit';
  const stockDetail =
    tracked.length === 0
      ? 'Not tracked, so it never sells out'
      : empty === tracked.length
        ? 'Nothing in stock yet'
        : empty > 0
          ? `${empty} ${empty === 1 ? 'variant has' : 'variants have'} no stock`
          : `${total.toLocaleString('en-IN')} in stock${live.length === 1 && unit !== 'unit' ? ` (${unit}s)` : ''}`;

  // --- ships from
  const heldAt = warehouses
    .map((warehouse) => ({
      name: warehouse.name,
      quantity: live.reduce(
        (sum, variant) => sum + Number(variant.warehouseStock[warehouse.id] || 0),
        0,
      ),
    }))
    .filter((row) => row.quantity > 0);
  const unrouted = live.filter((variant) =>
    warehouses.every((warehouse) => Number(variant.warehouseStock[warehouse.id] || 0) <= 0),
  ).length;
  let shipsState: State = 'done';
  let shipsDetail: string;
  if (warehouses.length === 0) {
    shipsDetail = 'No warehouses set up, so delivery is measured from the shop';
  } else if (heldAt.length > 0 && unrouted === 0) {
    shipsDetail = heldAt.map((row) => `${row.name} (${row.quantity.toLocaleString('en-IN')})`).join(', ');
  } else if (warehouses.length === 1) {
    // The only warehouse is the nearest one, which is where it would ship from anyway.
    shipsDetail = `${warehouses[0]!.name}, the only warehouse`;
  } else {
    shipsState = 'todo';
    shipsDetail =
      heldAt.length === 0
        ? 'Not held anywhere, so the nearest warehouse delivers'
        : `${unrouted} ${unrouted === 1 ? 'variant is' : 'variants are'} not held anywhere`;
  }

  // --- get a quote
  let quoteState: State = 'optional';
  let quoteDetail = 'Not linked. Link it if customers buy this for a wall, slab or floor.';
  if (quoteMaterial) {
    const base = BASE_UNIT_WORDS[QUOTE_MATERIAL_UNITS[quoteMaterial]];
    const covered = live.filter((variant) => Number(variant.quoteCoverage) > 0);
    const name = QUOTE_MATERIAL_LABELS[quoteMaterial].en;
    if (covered.length === 0) {
      quoteDetail = `${name}: say how much one unit covers`;
    } else if (covered.length < live.length) {
      quoteDetail = `${name}: ${live.length - covered.length} ${live.length - covered.length === 1 ? 'variant needs' : 'variants need'} how much one unit covers`;
    } else {
      quoteState = 'done';
      quoteDetail =
        live.length === 1 && first
          ? `${name}, one ${saleUnitWord(first.unitLabelEn)} covers ${first.quoteCoverage} ${base}`
          : `${name}, for all ${live.length} variants`;
    }
  }

  const rows: Row[] = [
    {
      key: 'category',
      label: 'Category',
      detail: categoryLabel
        ? `${categoryLabel}${alsoIn.length > 0 ? `, also in ${alsoIn.join(', ')}` : ''}`
        : 'Not in a category, so customers only find it by searching',
      state: categoryLabel ? 'done' : 'todo',
      section: SETUP_SECTIONS.organisation,
      counts: true,
    },
    {
      key: 'price',
      label: 'Price',
      detail: priceDetail,
      state: unpriced === 0 && live.length > 0 ? 'done' : 'todo',
      section: priceSection,
      counts: true,
    },
    {
      key: 'stock',
      label: 'Stock',
      detail: stockDetail,
      state: empty === 0 ? 'done' : 'todo',
      section: stockSection,
      counts: true,
    },
    {
      key: 'ships',
      label: 'Ships from',
      detail: shipsDetail,
      state: shipsState,
      section: SETUP_SECTIONS.warehouses,
      counts: warehouses.length > 0,
    },
    {
      key: 'photos',
      label: 'Photos',
      detail: imageCount > 0 ? `${imageCount} ${imageCount === 1 ? 'photo' : 'photos'}` : 'No photos yet',
      state: imageCount > 0 ? 'done' : 'todo',
      section: SETUP_SECTIONS.images,
      counts: true,
    },
    {
      key: 'rates',
      label: 'Today’s Rates',
      detail: onRates
        ? ratesCategory
          ? `On the list, because ${ratesCategory} changes daily`
          : 'On the list'
        : 'Not on the list. Turn on “Price changes daily” if it should be.',
      state: 'info',
      section: SETUP_SECTIONS.rates,
      counts: false,
    },
    {
      key: 'quote',
      label: 'Get a quote',
      detail: quoteDetail,
      state: quoteState,
      section: SETUP_SECTIONS.quote,
      counts: false,
      action: quoteMaterial ? undefined : 'Link it',
    },
    {
      key: 'status',
      label: 'Status',
      detail:
        status === 'ACTIVE'
          ? 'Active: on the website'
          : status === 'ARCHIVED'
            ? 'Archived: hidden, kept for past orders'
            : scheduled
              ? 'Draft: goes live at the scheduled time'
              : 'Draft: not on the website yet',
      state: 'info',
      section: SETUP_SECTIONS.status,
      counts: false,
    },
  ];

  const counted = rows.filter((row) => row.counts);
  const done = counted.filter((row) => row.state === 'done').length;
  const ready = done === counted.length;

  return (
    <section
      aria-labelledby="setup-heading"
      className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="setup-heading" className="font-semibold">
          Setup
        </h2>
        <span
          className={cn(
            'text-xs font-medium',
            ready ? 'text-[var(--success-fg)]' : 'text-muted-foreground',
          )}
        >
          {ready ? 'Ready to sell' : `${done} of ${counted.length} done`}
        </span>
      </div>

      <ul className="-mx-2 flex flex-col">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => scrollToSection(row.section)}
              className="hover:bg-muted/60 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left"
            >
              <span className="mt-0.5 shrink-0">{ICON[row.state]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{row.label}</span>
                  {row.action ? (
                    <span className="shrink-0 text-xs font-medium underline">
                      {row.action}
                    </span>
                  ) : (
                    STATE_WORD[row.state] && (
                      <span className="sr-only">{STATE_WORD[row.state]}</span>
                    )
                  )}
                </span>
                <span className="text-muted-foreground block text-xs">{row.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        Everything here is set on this page. Save, and the product stays open so you can
        finish.
      </p>
    </section>
  );
}
