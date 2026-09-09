'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  ADMIN_THUMB,
  buildMediaUrl,
  type CheckoutConfigDto,
  type MediaUrlContext,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaPickerDialog, type PickedImage } from '@/components/media/ProductImages';
import { saveCheckoutDesign } from '@/app/(dashboard)/checkout/actions';
import { Card, SaveBar, Toggle } from './shared';

export function DesignForm({
  initial,
  badgeImages,
  ctx,
  hasTax,
}: {
  initial: CheckoutConfigDto['design'];
  badgeImages: CheckoutConfigDto['trustBadgeImages'];
  ctx: MediaUrlContext;
  /** False when nothing in the catalogue carries a GST rate yet. */
  hasTax: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  /** Which badge row the media picker was opened for. */
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  /**
   * Badges picked this session, merged over what the server resolved. Without
   * it a freshly chosen badge would show no thumbnail until the page reloaded.
   */
  const [pickedImages, setPickedImages] = useState<Record<string, { r2Key: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    setErrors({});
    setFormError(null);
    startSaving(async () => {
      const result = await saveCheckoutDesign(form);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFormError(result.formErrors[0] ?? null);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      toast.success('Design saved');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Look">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accent">Accent colour</Label>
            <div className="flex items-center gap-2">
              <span
                className="size-9 shrink-0 rounded-md border"
                style={{ background: form.accentColor || 'var(--nav)' }}
                aria-hidden="true"
              />
              <Input
                id="accent"
                value={form.accentColor}
                onChange={(e) => set('accentColor', e.target.value)}
                placeholder="#1a73e8"
                className="font-mono"
              />
            </div>
            {errors.accentColor ? (
              <span className="text-xs text-[var(--critical-fg)]">{errors.accentColor}</span>
            ) : (
              <span className="text-muted-foreground text-xs">
                Blank uses the storefront&apos;s own colour.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payLabel">Pay button</Label>
            <Input
              id="payLabel"
              value={form.payButtonLabelEn}
              onChange={(e) => set('payButtonLabelEn', e.target.value)}
              placeholder="Place order"
            />
            <Input
              value={form.payButtonLabelHi}
              onChange={(e) => set('payButtonLabelHi', e.target.value)}
              placeholder="ऑर्डर करें"
              lang="hi"
            />
          </div>
        </div>
      </Card>

      <Card title="What to show">
        <Toggle
          label="Keep the order summary on screen"
          hint="Sticks to the side on a desktop, collapses on a phone."
          checked={form.stickyOrderSummary}
          onChange={(v) => set('stickyOrderSummary', v)}
        />
        <Toggle
          label="Offer a coupon field"
          hint="Turn off if you only run automatic discounts."
          checked={form.showCouponField}
          onChange={(v) => set('showCouponField', v)}
        />
        <Toggle
          label="Show the delivery promise"
          hint="The hours and cutoff set under Settings."
          checked={form.showDeliveryPromise}
          onChange={(v) => set('showDeliveryPromise', v)}
        />
        <Toggle
          label="Break out the GST"
          hint={
            hasTax
              ? 'Shows the tax on its own line rather than folded into the total.'
              : 'Nothing in the catalogue carries a GST rate yet, so there is nothing to break out.'
          }
          checked={form.showTaxBreakup}
          onChange={(v) => set('showTaxBreakup', v)}
        />
      </Card>

      <Card title="Trust badges" subtitle="Small reassurances under the pay button.">
        <Toggle
          label="Show badges"
          checked={form.showTrustBadges}
          onChange={(v) => set('showTrustBadges', v)}
        />

        {form.showTrustBadges && (
          <div className="flex flex-col gap-2">
            {form.trustBadges.map((badge, index) => {
              const image = pickedImages[badge.mediaId] ?? badgeImages[badge.mediaId];
              const key = image?.r2Key;
              const url =
                key && ctx.publicBaseUrl
                  ? buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, key, {
                      w: ADMIN_THUMB,
                    })
                  : null;

              return (
                <div key={index} className="flex items-center gap-2 rounded-md border p-2">
                  <button
                    type="button"
                    onClick={() => setPickingIndex(index)}
                    className="hover:bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded border"
                    aria-label="Choose an image"
                  >
                    {url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt="" className="size-full rounded object-contain" />
                    ) : (
                      <ImageIcon className="text-muted-foreground size-4" />
                    )}
                  </button>

                  <Input
                    value={badge.labelEn}
                    onChange={(e) =>
                      set(
                        'trustBadges',
                        form.trustBadges.map((b, i) =>
                          i === index ? { ...b, labelEn: e.target.value } : b,
                        ),
                      )
                    }
                    placeholder="Secure payment"
                    className="h-9"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove this badge"
                    onClick={() =>
                      set(
                        'trustBadges',
                        form.trustBadges.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              );
            })}

            {form.trustBadges.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  set('trustBadges', [
                    ...form.trustBadges,
                    { mediaId: '', labelEn: '', labelHi: '' },
                  ])
                }
              >
                <PlusIcon className="size-4" />
                Add a badge
              </Button>
            )}
          </div>
        )}
      </Card>

      <SaveBar error={formError} isSaving={isSaving} onSave={save} label="Save design" />

      <MediaPickerDialog
        open={pickingIndex !== null}
        onOpenChange={(open) => !open && setPickingIndex(null)}
        ctx={ctx}
        alreadyPicked={[]}
        onConfirm={(picked: PickedImage[]) => {
          const image = picked[0];
          if (image && pickingIndex !== null) {
            // Remembered locally so the thumbnail appears at once; only the id
            // is stored, and the read resolves it again on the next load.
            setPickedImages((current) => ({ ...current, [image.id]: { r2Key: image.r2Key } }));
            set(
              'trustBadges',
              form.trustBadges.map((b, i) =>
                i === pickingIndex ? { ...b, mediaId: image.id } : b,
              ),
            );
          }
          setPickingIndex(null);
        }}
      />
    </div>
  );
}
