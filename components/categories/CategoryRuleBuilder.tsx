'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { PlusIcon, XIcon, LoaderCircleIcon, FilterIcon } from 'lucide-react';
import {
  describeTagRules,
  isRunnableRuleSet,
  type CategoryMatch,
  type TagRule,
  type TagRuleOperator,
} from '@buildkart/contract';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  previewCategoryMembership,
  type MembershipRow,
} from '@/app/(dashboard)/categories/preview';

export type RuleTagOption = { id: string; nameEn: string; scope: 'INTERNAL' | 'PUBLIC' };

/**
 * Builds a category's automatic-membership rule and previews what it catches.
 *
 * The preview is the point: one tag too broad and half the catalogue moves, so
 * seeing the result while the rule is still being edited turns a discovery into
 * a decision.
 */
export function CategoryRuleBuilder({
  categoryId,
  match,
  rules,
  tags,
  onMatchChange,
  onRulesChange,
}: {
  categoryId: string | null;
  match: CategoryMatch;
  rules: TagRule[];
  tags: RuleTagOption[];
  onMatchChange: (next: CategoryMatch) => void;
  onRulesChange: (next: TagRule[]) => void;
}) {
  const [preview, setPreview] = useState<{
    total: number;
    viaRule: number;
    sample: MembershipRow[];
  } | null>(null);
  const [isLoading, startLoading] = useTransition();

  const nameOf = useCallback(
    (tagId: string) => tags.find((t) => t.id === tagId)?.nameEn ?? 'unknown tag',
    [tags],
  );

  const rulesKey = JSON.stringify(rules) + match;

  useEffect(() => {
    // Debounced so dragging through the tag dropdown does not fire a query per
    // keystroke of the selection.
    const timer = setTimeout(() => {
      startLoading(async () => {
        const result = await previewCategoryMembership({
          categoryId,
          autoMatch: match,
          autoRules: rules,
        });
        if (result.ok) setPreview(result.data);
      });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesKey, categoryId]);

  function addRule(operator: TagRuleOperator) {
    const used = new Set(rules.filter((r) => r.operator === operator).map((r) => r.tagId));
    const next = tags.find((t) => !used.has(t.id));
    if (!next) return;
    onRulesChange([...rules, { tagId: next.id, operator }]);
  }

  function updateRule(index: number, changes: Partial<TagRule>) {
    onRulesChange(rules.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  }

  const includes = rules.filter((r) => r.operator === 'INCLUDES');
  const runnable = isRunnableRuleSet(rules);

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Automatic products</h2>
        <p className="text-muted-foreground text-xs">
          Gather products by tag instead of assigning them one by one. Products assigned by hand
          stay in the category either way.
        </p>
      </div>

      {tags.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No tags exist yet. <Link href="/tags/new" className="underline">Create a tag</Link> to
          build a rule.
        </p>
      ) : (
        <>
          {includes.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="autoMatch">Products must match</Label>
              <Select value={match} onValueChange={(v) => onMatchChange(v as CategoryMatch)}>
                <SelectTrigger id="autoMatch" className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All of the included tags</SelectItem>
                  <SelectItem value="ANY">Any one of the included tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {rules.length > 0 && (
            <ul className="flex flex-col gap-2">
              {rules.map((rule, index) => (
                <li key={`${rule.operator}-${rule.tagId}-${index}`} className="flex items-center gap-2">
                  <Select
                    value={rule.operator}
                    onValueChange={(v) => updateRule(index, { operator: v as TagRuleOperator })}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCLUDES">Include</SelectItem>
                      <SelectItem value="EXCLUDES">Exclude</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={rule.tagId} onValueChange={(v) => updateRule(index, { tagId: v })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.nameEn}
                          {tag.scope === 'INTERNAL' ? ' · internal' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRulesChange(rules.filter((_, i) => i !== index))}
                    aria-label={`Remove condition ${index + 1}`}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addRule('INCLUDES')}>
              <PlusIcon className="size-4" />
              Include a tag
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addRule('EXCLUDES')}>
              <PlusIcon className="size-4" />
              Exclude a tag
            </Button>
          </div>

          <p
            className={cn(
              'text-xs',
              runnable ? 'text-muted-foreground' : 'text-[var(--warning-fg)]',
            )}
          >
            {describeTagRules(rules, match, nameOf)}
          </p>

          {rules.some((r) => r.operator === 'EXCLUDES') && (
            <p className="text-muted-foreground text-xs">
              Excluded tags always apply, whichever match option is chosen.
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-medium">
            <FilterIcon className="size-3.5" />
            Products in this category
          </h3>
          {isLoading && <LoaderCircleIcon className="text-muted-foreground size-4 animate-spin" />}
        </div>

        {preview === null ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : preview.total === 0 ? (
          <p className="text-muted-foreground text-xs">
            No products yet. Assign some from a product page, or add a rule above.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {preview.total} product{preview.total === 1 ? '' : 's'}
              {preview.viaRule > 0 && `, ${preview.viaRule} of them from the rule`}
              {preview.sample.length < preview.total && ` · showing the first ${preview.sample.length}`}
            </p>

            <ul className="max-h-[260px] overflow-y-auto rounded-md border">
              {preview.sample.map((product) => (
                <li key={product.id} className="flex items-center gap-2 border-b px-2.5 py-1.5 last:border-b-0">
                  <Link
                    href={`/products/${product.id}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {product.nameEn}
                  </Link>
                  {product.viaRule && (
                    <span className="shrink-0 rounded-full bg-[var(--info-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--info-fg)]">
                      by rule
                    </span>
                  )}
                  {product.status !== 'ACTIVE' && (
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {product.status === 'DRAFT' ? 'Draft' : 'Archived'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
