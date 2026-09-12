'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, LoaderCircleIcon, Trash2Icon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { scrollMainToTop } from '@/lib/scroll';
import {
  slugify,
  generateSkusFor,
  expandMatrix,
  indexByKey,
  renameAxisValue,
  usableAxes,
  validateMatrix,
  describeProblem,
  emptyVariantDraft,
  matchesTagRules,
  type BulkTierBasis,
  type OptionAxisDraft,
  type RuleCategoryDto,
  type VariantDraft,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TranslatableField } from '@/components/form/TranslatableField';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import {
  ProductImages,
  type PickedImage,
  type MediaUrlContext,
} from '@/components/media/ProductImages';
import { TagInput } from './TagInput';
import { BrandInput } from './BrandInput';
import type { TaxRateDto } from '@StrikerStore/contract';
import { TaxSection, type TaxState } from './TaxSection';
import { InventorySection, PricingSection } from './PricingSection';
import { MetafieldFieldset, type MetafieldDefinitionDto } from './MetafieldFieldset';
import { OptionAxisEditor } from './OptionAxisEditor';
import { VariantMatrixEditor } from './VariantMatrixEditor';
import { createProduct, updateProduct, deleteProduct } from '@/app/(dashboard)/products/actions';
import { duplicateProduct } from '@/app/(dashboard)/products/[id]/variant-actions';

const NONE = '__none__';

export type ProductFormInitial = {
  id: string | null;
  nameEn: string;
  nameHi: string;
  handle: string;
  bodyHtmlEn: string;
  bodyHtmlHi: string;
  faqsEn: string;
  faqsHi: string;
  returnPolicyEn: string;
  returnPolicyHi: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  scheduledPublishAt: string;
  categoryId: string | null;
  brandName: string;
  productType: string;
  tagNames: string[];
  images: PickedImage[];
  taxRateId: string | null;
  taxPercent: string;
  taxInclusive: boolean;
  hsnCode: string;
  isRateVolatile: boolean;
  bulkTierBasis: BulkTierBasis;
  searchKeywords: string;
  seoTitle: string;
  seoDescriptionEn: string;
  orderItemCount: number;
  /** Raw cell text per definition id. */
  metafieldValues: Record<string, string>;
  axes: OptionAxisDraft[];
  variants: VariantDraft[];
};

export function ProductForm({
  initial,
  categories,
  metafieldDefinitions,
  brandSuggestions,
  tagSuggestions,
  ruleCategories,
  mediaCtx,
  taxRates,
  defaultTaxRateId,
}: {
  initial: ProductFormInitial;
  categories: Array<{ id: string; nameEn: string; parentName: string | null }>;
  metafieldDefinitions: MetafieldDefinitionDto[];
  brandSuggestions: string[];
  tagSuggestions: string[];
  ruleCategories: RuleCategoryDto[];
  mediaCtx: MediaUrlContext;
  taxRates: TaxRateDto[];
  defaultTaxRateId: string | null;
}) {
  const router = useRouter();
  const isEdit = initial.id !== null;

  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameHi, setNameHi] = useState(initial.nameHi);
  const [handle, setHandle] = useState(initial.handle);
  const [handleTouched, setHandleTouched] = useState(isEdit);
  const [bodyEn, setBodyEn] = useState(initial.bodyHtmlEn);
  const [bodyHi, setBodyHi] = useState(initial.bodyHtmlHi);
  const [faqsEn, setFaqsEn] = useState(initial.faqsEn);
  const [faqsHi, setFaqsHi] = useState(initial.faqsHi);
  const [returnEn, setReturnEn] = useState(initial.returnPolicyEn);
  const [returnHi, setReturnHi] = useState(initial.returnPolicyHi);
  const [status, setStatus] = useState(initial.status);
  const [scheduledAt, setScheduledAt] = useState(initial.scheduledPublishAt);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? NONE);
  const [brandName, setBrandName] = useState(initial.brandName);
  const [productType, setProductType] = useState(initial.productType);
  const [tagNames, setTagNames] = useState(initial.tagNames);
  /*
   * Which categories this product's tags would gather it into.
   *
   * Computed here rather than asked of the server, because it has to keep up
   * with typing: the rules arrive keyed by tag slug and the form holds tag
   * names, so slugifying the names lines the two up. It is the same
   * `matchesTagRules` the product list runs on tag ids and the category page
   * runs as SQL — one rule, read wherever it is needed.
   */
  const gatheredCategories = useMemo(() => {
    const slugs = tagNames.map((name) => slugify(name)).filter(Boolean);
    if (slugs.length === 0) return [];
    const carried = new Set(slugs);

    return ruleCategories
      .filter(
        (category) =>
          category.id !== categoryId &&
          matchesTagRules(category.autoRules, category.autoMatch, slugs),
      )
      .map((category) => {
        // Name the tags that actually pulled it in, not the whole rule.
        const because = category.autoRules
          .filter((rule) => rule.operator === 'INCLUDES' && carried.has(rule.tagSlug))
          .map((rule) => rule.tagSlug)
          .join(', ');
        return { id: category.id, nameEn: category.nameEn, because };
      });
  }, [tagNames, ruleCategories, categoryId]);
  const [images, setImages] = useState(initial.images);
  /*
   * A new product opens on the shop's default rate rather than at 0%.
   *
   * Done here rather than in `emptyProductForm()` so the choice is *visible* —
   * the dropdown shows "GST 18%" and can be changed before the first save.
   * Baking a rate into the blank form would make it a default nobody saw.
   */
  const [tax, setTax] = useState<TaxState>(() => ({
    taxRateId: initial.id === null ? defaultTaxRateId : initial.taxRateId,
    taxPercent:
      initial.id === null
        ? (taxRates.find((rate) => rate.id === defaultTaxRateId)?.percent ?? initial.taxPercent)
        : initial.taxPercent,
    taxInclusive: initial.taxInclusive,
    hsnCode: initial.hsnCode,
  }));
  const [isRateVolatile, setIsRateVolatile] = useState(initial.isRateVolatile);
  const [bulkTierBasis, setBulkTierBasis] = useState(initial.bulkTierBasis);
  const [searchKeywords, setSearchKeywords] = useState(initial.searchKeywords);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescriptionEn);
  const [metafieldValues, setMetafieldValues] = useState(initial.metafieldValues);

  const [hasVariants, setHasVariants] = useState(initial.axes.length > 0);
  const [axes, setAxes] = useState<OptionAxisDraft[]>(
    initial.axes.length > 0 ? initial.axes : [{ name: '', values: [] }],
  );
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial.variants.length > 0 ? initial.variants : [emptyVariantDraft()],
  );
  /**
   * Rows for combinations that no longer exist are kept aside rather than
   * dropped, so re-adding a value removed by mistake restores its price and
   * stock instead of silently starting blank.
   */
  const [shelved, setShelved] = useState<Record<string, VariantDraft>>({});

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();

  function onNameEnChange(value: string) {
    setNameEn(value);
    if (!handleTouched) setHandle(slugify(value));
  }

  function applyAxes(nextAxes: OptionAxisDraft[]) {
    setAxes(nextAxes);
    const existing = { ...shelved, ...indexByKey(variants) };
    const { variants: expanded, orphaned } = expandMatrix(nextAxes, existing);
    setVariants(expanded);
    setShelved((current) => ({ ...current, ...indexByKey(orphaned) }));
  }

  function onRenameValue(axisIndex: number, oldValue: string, newValue: string) {
    setShelved((current) => renameAxisValue(current, axisIndex, oldValue, newValue));
    setVariants(Object.values(renameAxisValue(indexByKey(variants), axisIndex, oldValue, newValue)));
  }

  function onToggleVariants(enabled: boolean) {
    setHasVariants(enabled);
    setFormError(null);

    if (enabled) {
      setAxes([{ name: '', values: [] }]);
      return;
    }

    // Collapsing back to a single SKU keeps the first row's pricing, which is
    // almost always the one that was filled in first.
    const first = variants[0];
    setAxes([{ name: '', values: [] }]);
    setVariants([
      emptyVariantDraft({
        ...first,
        id: first?.id,
        matrixKey: '',
        optionValues: [],
      }),
    ]);
  }

  /** Fills blank SKUs from the product name and option values. Never overwrites. */
  function fillSkus() {
    const taken = new Set(variants.filter((v) => v.sku.trim() !== '').map((v) => v.sku.trim()));
    const blanks = variants.filter((v) => v.sku.trim() === '');
    const generated = generateSkusFor(nameEn, blanks, taken);

    if (Object.keys(generated).length === 0) {
      toast.info(nameEn.trim() === '' ? 'Enter a product name first.' : 'Every variant already has a SKU.');
      return;
    }

    setVariants(
      variants.map((v) => (generated[v.matrixKey] ? { ...v, sku: generated[v.matrixKey]! } : v)),
    );
    toast.success(`${Object.keys(generated).length} SKU${Object.keys(generated).length === 1 ? '' : 's'} generated`);
  }

  /**
   * Switching the basis rewrites what every threshold means — 20 bags and ₹20
   * are the same digits — so the ladders are cleared rather than silently
   * carried across as numbers that now say something else.
   */
  function changeBasis(next: typeof bulkTierBasis) {
    setBulkTierBasis(next);
    setVariants((current) => current.map((v) => (v.tiers.length > 0 ? { ...v, tiers: [] } : v)));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const effectiveAxes = hasVariants ? usableAxes(axes) : [];

    const problems = validateMatrix(effectiveAxes);
    if (problems.length > 0) {
      setFormError(problems.map(describeProblem).join(' '));
      scrollMainToTop();
      return;
    }
    if (hasVariants && effectiveAxes.length === 0) {
      setFormError('Add at least one option with a value, or turn variants off.');
      scrollMainToTop();
      return;
    }

    // Anything still blank is filled at save time, so a SKU is never simply
    // missing — but a value typed by hand always wins.
    const taken = new Set(variants.filter((v) => v.sku.trim() !== '').map((v) => v.sku.trim()));
    const autoSkus = generateSkusFor(
      nameEn,
      variants.filter((v) => v.sku.trim() === ''),
      taken,
    );

    const payload = {
      nameEn,
      nameHi,
      handle,
      bodyHtmlEn: bodyEn,
      bodyHtmlHi: bodyHi,
      faqsEn,
      faqsHi,
      returnPolicyEn: returnEn,
      returnPolicyHi: returnHi,
      status,
      scheduledPublishAt: scheduledAt || null,
      categoryId: categoryId === NONE ? null : categoryId,
      brandName,
      productType,
      tagNames,
      imageMediaIds: images.map((i) => i.id),
      taxRateId: tax.taxRateId,
      taxPercent: tax.taxPercent,
      taxInclusive: tax.taxInclusive,
      hsnCode: tax.hsnCode,
      isRateVolatile,
      bulkTierBasis,
      searchKeywords,
      seoTitle,
      seoDescriptionEn: seoDescription,
      metafields: Object.entries(metafieldValues).map(([definitionId, raw]) => ({
        definitionId,
        raw,
      })),
      axes: effectiveAxes,
      variants: variants.map((v) => ({
        id: v.id,
        matrixKey: v.matrixKey,
        sku: v.sku.trim() === '' ? (autoSkus[v.matrixKey] ?? '') : v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        tiers: v.tiers,
        costPerItem: v.costPerItem,
        unitLabelEn: v.unitLabelEn,
        unitLabelHi: v.unitLabelHi,
        stockQty: Number(v.stockQty || 0),
        lowStockThreshold: Number(v.lowStockThreshold || 0),
        inventoryPolicy: v.inventoryPolicy,
        inventoryTracked: v.inventoryTracked,
        barcode: v.barcode,
        imageMediaId: v.imageMediaId,
        isActive: v.isActive,
      })),
    };

    startSaving(async () => {
      const result = initial.id
        ? await updateProduct(initial.id, payload)
        : await createProduct(payload);

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        setFieldErrors(result.fieldErrors);
        if (!result.formErrors[0] && Object.keys(result.fieldErrors).length === 0) {
          setFormError('Could not save this product.');
        }
        scrollMainToTop();
        return;
      }

      toast.success(isEdit ? 'Product saved' : 'Product created');

      // Only the update path reports deactivations; a create has nothing to
      // remove. Narrowed rather than cast so the union stays honest.
      const deactivated =
        result.data && 'deactivated' in result.data ? Number(result.data.deactivated) : 0;
      if (deactivated > 0) {
        const n = deactivated;
        toast.info(
          `${n} removed variant${n === 1 ? ' was' : 's were'} kept but deactivated, because ${n === 1 ? 'it appears' : 'they appear'} in past orders.`,
        );
      }
      router.push('/products');
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!window.confirm(`Delete “${initial.nameEn}”? This cannot be undone.`)) return;

    startDeleting(async () => {
      const result = await deleteProduct(initial.id!);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not delete this product.');
        scrollMainToTop();
        return;
      }
      toast.success('Product deleted');
      router.push('/products');
      router.refresh();
    });
  }

  function onDuplicate() {
    if (!initial.id) return;
    startDuplicating(async () => {
      const result = await duplicateProduct(initial.id!);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not duplicate this product.');
        return;
      }
      toast.success('Product duplicated as a draft');
      router.push(`/products/${result.data.id}`);
      router.refresh();
    });
  }

  const busy = isSaving || isDeleting || isDuplicating;
  const axisNames = usableAxes(axes).map((a) => a.name);
  const single = variants[0] ?? emptyVariantDraft();
  const shelvedCount = Object.keys(shelved).length;

  /**
   * Pricing and inventory edit the same single variant row, so they share one
   * updater — two copies of this would be two places for the empty-variants
   * case to be got wrong.
   */
  const updateSingleVariant = (changes: Partial<VariantDraft>) =>
    setVariants((current) =>
      current.length === 0
        ? [emptyVariantDraft(changes)]
        : current.map((v, i) => (i === 0 ? { ...v, ...changes } : v)),
    );

  return (
    <form onSubmit={onSubmit}>
      <PageContainer>
        <PageHeader
          title={isEdit ? initial.nameEn || 'Edit product' : 'New product'}
          backHref="/products"
          backLabel="Products"
          actions={
            <>
              {isEdit && (
                <>
                  <Button type="button" variant="outline" onClick={onDuplicate} disabled={busy}>
                    {isDuplicating ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDelete}
                    disabled={busy}
                    className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
                  >
                    <Trash2Icon className="size-4" />
                    Delete
                  </Button>
                </>
              )}
              <Button type="submit" disabled={busy}>
                {isSaving && <LoaderCircleIcon className="size-4 animate-spin" />}
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        />

        {formError && (
          <Alert
            variant="destructive"
            className="mb-4 border-[var(--critical-fg)]/20 bg-[var(--critical-bg)]"
          >
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-[var(--critical-fg)]">{formError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <TranslatableField
                label="Product name"
                required
                valueEn={nameEn}
                valueHi={nameHi}
                onChangeEn={onNameEnChange}
                onChangeHi={setNameHi}
                placeholder="UltraTech Cement OPC 53 Grade, 50 kg"
                errorEn={fieldErrors.nameEn}
                maxLength={255}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="handle">Storefront URL</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    buildkart.co/p/
                  </span>
                  <Input
                    id="handle"
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      setHandleTouched(true);
                    }}
                    className="font-mono"
                    aria-invalid={Boolean(fieldErrors.handle)}
                  />
                </div>
                {fieldErrors.handle && (
                  <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.handle}</p>
                )}
              </div>

              <TranslatableField
                label="Description"
                multiline
                rows={6}
                valueEn={bodyEn}
                valueHi={bodyHi}
                onChangeEn={setBodyEn}
                onChangeHi={setBodyHi}
                helpText="Markdown works — ## for a heading, **bold**, - for a list. Basic HTML is allowed too, and everything is sanitised when saved."
                maxLength={50_000}
              />
            </section>

            {/*
              * FAQs and return terms.
              *
              * Their own card rather than fields inside Description, because
              * they are a different job: the description sells the product, and
              * these two answer the questions that stop somebody buying it.
              * Both render on the storefront as an accordion under the specs,
              * and both are skipped entirely when left blank.
              */}
            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-0.5">
                <h2 className="font-semibold">Questions &amp; returns</h2>
                <p className="text-muted-foreground text-xs">
                  Two accordions on the product page, both closed until tapped. Leave either
                  blank to hide it.
                </p>
              </div>

              <TranslatableField
                label="FAQs"
                multiline
                rows={8}
                valueEn={faqsEn}
                valueHi={faqsHi}
                onChangeEn={setFaqsEn}
                onChangeHi={setFaqsHi}
                helpText="Paste the questions and answers in one go. Markdown works — a ### heading per question reads best. Basic HTML is allowed too, and everything is sanitised when saved."
                maxLength={20_000}
                errorEn={fieldErrors.faqsEn}
              />

              <div className="border-t pt-4">
                <TranslatableField
                  label="Return &amp; exchange policy"
                  multiline
                  rows={4}
                  valueEn={returnEn}
                  valueHi={returnHi}
                  onChangeEn={setReturnEn}
                  onChangeHi={setReturnHi}
                  helpText="This product's own terms — cement once opened is not the same as a sealed fitting. Markdown works, and everything is sanitised when saved."
                  maxLength={5_000}
                  errorEn={fieldErrors.returnPolicyEn}
                />
              </div>
            </section>

            <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold">Images</h2>
              <ProductImages value={images} onChange={setImages} ctx={mediaCtx} />
            </section>

            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-semibold">Variants</h2>
                  <p className="text-muted-foreground text-xs">
                    For products sold in more than one size, grade or colour.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="hasVariants" className="text-xs font-medium">
                    This product has variants
                  </Label>
                  <Switch
                    id="hasVariants"
                    checked={hasVariants}
                    onCheckedChange={onToggleVariants}
                  />
                </div>
              </div>

              {hasVariants ? (
                <>
                  <OptionAxisEditor
                    axes={axes}
                    onChange={applyAxes}
                    onRenameValue={onRenameValue}
                  />

                  {variants.length > 0 && axisNames.length > 0 && (
                    <>
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={fillSkus}>
                          Generate SKUs
                        </Button>
                      </div>
                      {/*
                        * The basis lives here for a multi-variant product,
                        * because the matrix's per-row ladders all read the same
                        * way and the choice belongs to the product, not a row.
                        */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="matrixBasis">Bulk pricing works by</Label>
                        <Select
                          value={bulkTierBasis}
                          onValueChange={(next) => changeBasis(next as BulkTierBasis)}
                        >
                          <SelectTrigger id="matrixBasis" className="sm:w-[280px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="QUANTITY">
                              Quantity on the line — 20 bags or more
                            </SelectItem>
                            <SelectItem value="AMOUNT">
                              Value of the line — ₹10,000 or more
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <VariantMatrixEditor
                        variants={variants}
                        axisNames={axisNames}
                        bulkTierBasis={bulkTierBasis}
                        onChange={setVariants}
                      />
                    </>
                  )}

                  {shelvedCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {shelvedCount} removed combination{shelvedCount === 1 ? '' : 's'} kept in
                      memory — re-add the value to restore {shelvedCount === 1 ? 'its' : 'their'}{' '}
                      price and stock. Saving discards {shelvedCount === 1 ? 'it' : 'them'}.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Off — this product has one price and stock count, set below.
                </p>
              )}
            </section>

            {/*
              The left column runs: pricing, tax, inventory, specifications,
              search engine listing.
              
              Tax sits directly under pricing because the two are one decision —
              what the thing costs, and whether that number already contains the
              GST. Counting the stock is a separate thought, so inventory comes
              after both rather than being welded to the price fields.
            */}
            {!hasVariants && (
              <PricingSection
                bulkTierBasis={bulkTierBasis}
                onBasisChange={changeBasis}
                variant={single}
                fieldErrors={fieldErrors}
                onChange={updateSingleVariant}
              />
            )}

            {/* Unconditional, unlike the two around it: a product with option
                axes prices each row in the matrix above, but still has one tax
                rate for the whole product. */}
            <TaxSection
              value={tax}
              rates={taxRates}
              samplePrice={variants[0]?.price || null}
              fieldErrors={fieldErrors}
              onChange={(changes) => setTax((current) => ({ ...current, ...changes }))}
            />

            {!hasVariants && (
              <InventorySection
                variant={single}
                fieldErrors={fieldErrors}
                onChange={updateSingleVariant}
              />
            )}

            <MetafieldFieldset
              definitions={metafieldDefinitions}
              values={metafieldValues}
              onChange={(definitionId, raw) =>
                setMetafieldValues((current) => ({ ...current, [definitionId]: raw }))
              }
            />

            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-0.5">
                <h2 className="font-semibold">Search engine listing</h2>
                <p className="text-muted-foreground text-xs">
                  Leave blank to use the product name and description.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="seoTitle">Page title</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="seoDesc">Meta description</Label>
                <Input
                  id="seoDesc"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={1000}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="keywords">Search synonyms</Label>
                <Input
                  id="keywords"
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                  placeholder="saria, sariya, rebar, TMT"
                  maxLength={1000}
                />
                <p className="text-muted-foreground text-xs">
                  Alternate spellings customers might type. This is what makes “saria” find
                  “sariya”.
                </p>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as typeof status);
                    if (v === 'ACTIVE') setScheduledAt('');
                  }}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {status === 'ACTIVE'
                    ? 'Visible to customers now.'
                    : status === 'DRAFT'
                      ? 'Hidden until you publish it.'
                      : 'Hidden, but kept for past orders.'}
                </p>
              </div>

              {status === 'DRAFT' && (
                <div className="flex flex-col gap-1.5 border-t pt-4">
                  <Label htmlFor="schedule">Publish automatically on</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  {fieldErrors.scheduledPublishAt ? (
                    <p className="text-[var(--critical-fg)] text-xs">
                      {fieldErrors.scheduledPublishAt}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Optional. Goes live on its own at this time.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold">Organisation</h2>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.parentName ? `${c.parentName} → ${c.nameEn}` : c.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <BrandInput
                value={brandName}
                onChange={setBrandName}
                suggestions={brandSuggestions}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Product type</Label>
                <Input
                  id="type"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Cement"
                  maxLength={191}
                />
              </div>

              <TagInput value={tagNames} onChange={setTagNames} suggestions={tagSuggestions} />

              {gatheredCategories.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t pt-3">
                  <Label>Also appears in</Label>
                  <ul className="flex flex-col gap-1">
                    {gatheredCategories.map((category) => (
                      <li
                        key={category.id}
                        className="flex flex-wrap items-baseline gap-x-1.5 text-xs"
                      >
                        <span className="font-medium">{category.nameEn}</span>
                        <span className="text-muted-foreground">via {category.because}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground text-xs">
                    Gathered by these categories’ tag rules. Change the tags above to change
                    this — it cannot be edited here.
                  </p>
                </div>
              )}
            </section>

            <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="volatile" className="font-medium">
                    Price changes daily
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Adds this to the Today’s Rates screen.
                  </p>
                </div>
                <Switch
                  id="volatile"
                  checked={isRateVolatile}
                  onCheckedChange={setIsRateVolatile}
                />
              </div>
            </section>

            {isEdit && initial.orderItemCount > 0 && (
              <p className="text-muted-foreground px-1 text-xs">
                Ordered {initial.orderItemCount} time
                {initial.orderItemCount === 1 ? '' : 's'}. Archive rather than delete to keep those
                orders readable.
              </p>
            )}
          </div>
        </div>
      </PageContainer>
    </form>
  );
}
