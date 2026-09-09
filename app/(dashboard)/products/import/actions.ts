'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@StrikerStore/contract';
import { api } from '@/lib/api/server';

import type { ImportOptions } from '@StrikerStore/contract';

/**
 * The import screens drive work that runs on the API.
 *
 * Analysing a file and committing hundreds of products both outlive a
 * comfortable request, so these start the work and the progress page polls for
 * status — which is what that page already did. The job is resumable by
 * construction, so a lost connection costs a refresh, not the import.
 */
export async function analyseImport(jobId: string): Promise<ActionResult<{ jobId: string }>> {
  const result = await (await api()).operations.analyseImport.mutate({ jobId });
  // The progress screen re-reads the plan whether or not the analysis
  // succeeded — a FAILED job is exactly what the page needs to show.
  revalidatePath('/products/import/' + jobId);
  return result;
}

export async function commitImport(
  jobId: string,
  options: Partial<ImportOptions>,
): Promise<ActionResult<{ created: number; updated: number; imagesQueued: number }>> {
  const result = await (await api()).operations.commitImport.mutate({ jobId, options });
  if (result.ok) {
    revalidatePath('/products');
    revalidatePath('/products/import/' + jobId);
  }
  return result;
}

export async function runImageBatch(
  jobId: string,
): Promise<ActionResult<{ processed: number; failed: number; remaining: number; done: boolean }>> {
  const result = await (await api()).operations.runImageBatch.mutate({ jobId });
  if (result.ok) {
    revalidatePath('/products/import/' + jobId);
    if (result.data.done) revalidatePath('/products');
  }
  return result;
}

export async function cancelImport(jobId: string): Promise<ActionResult> {
  const result = await (await api()).operations.cancelImport.mutate({ jobId });
  if (result.ok) revalidatePath('/products/import');
  return result;
}
