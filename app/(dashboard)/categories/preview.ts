'use server';

import type { ActionResult, CategoryMatch, TagRule } from '@buildkart/contract';
import type { MembershipPreviewDto, MembershipRowDto } from '@buildkart/contract';
import { actionOk } from '@buildkart/contract';
import { api } from '@/lib/api/server';

/**
 * Previews which products a rule would gather, before it is saved.
 *
 * A rule is easy to get subtly wrong — one tag too broad and half the catalogue
 * moves. Showing the result while the rule is still being edited turns that
 * from a discovery into a decision.
 */
export type MembershipRow = MembershipRowDto;

export async function previewCategoryMembership(input: {
  categoryId: string | null;
  autoMatch: CategoryMatch;
  autoRules: TagRule[];
}): Promise<ActionResult<MembershipPreviewDto>> {
  const preview = await (await api()).catalog.categoryMembershipPreview.query({
    ...input,
    // The builder does not offer more, and an unbounded list would become one
    // `some` clause per tag in a single query.
    autoRules: input.autoRules.slice(0, 20),
  });
  return actionOk(preview);
}
