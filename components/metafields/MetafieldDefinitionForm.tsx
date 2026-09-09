'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, LoaderCircleIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { scrollMainToTop } from '@/lib/scroll';
import {
  METAFIELD_TYPES,
  METAFIELD_TYPE_SPECS,
  METAFIELD_OWNER_TYPES,
  typeSpec,
  slugify,
  type MetafieldType,
  type MetafieldOwnerType,
} from '@buildkart/contract';
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
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import {
  createMetafieldDefinition,
  updateMetafieldDefinition,
  deleteMetafieldDefinition,
} from '@/app/(dashboard)/metafields/actions';

const OWNER_LABELS: Record<MetafieldOwnerType, string> = {
  PRODUCT: 'Products',
  VARIANT: 'Variants',
  CATEGORY: 'Categories',
  CUSTOMER: 'Customers',
  ORDER: 'Orders',
};

export type DefinitionFormInitial = {
  id: string | null;
  ownerType: MetafieldOwnerType;
  namespace: string;
  key: string;
  nameEn: string;
  nameHi: string;
  description: string;
  type: MetafieldType;
  isRequired: boolean;
  isFilterable: boolean;
  choices: string[];
  position: number;
  valueCount: number;
  autoCreated: boolean;
};

export function MetafieldDefinitionForm({ initial }: { initial: DefinitionFormInitial }) {
  const router = useRouter();
  const isEdit = initial.id !== null;
  const locked = isEdit && initial.valueCount > 0;

  const [ownerType, setOwnerType] = useState(initial.ownerType);
  const [namespace, setNamespace] = useState(initial.namespace);
  const [key, setKey] = useState(initial.key);
  const [keyTouched, setKeyTouched] = useState(isEdit);
  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameHi, setNameHi] = useState(initial.nameHi);
  const [description, setDescription] = useState(initial.description);
  const [type, setType] = useState<MetafieldType>(initial.type);
  const [isRequired, setIsRequired] = useState(initial.isRequired);
  const [isFilterable, setIsFilterable] = useState(initial.isFilterable);
  const [choices, setChoices] = useState<string[]>(initial.choices);
  const [choiceDraft, setChoiceDraft] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function onNameChange(value: string) {
    setNameEn(value);
    // The key is an identifier, so underscores rather than hyphens — that is
    // the form Shopify uses and what the CSV column will carry.
    if (!keyTouched) setKey(slugify(value).replace(/-/g, '_'));
  }

  function addChoice(raw: string) {
    const parts = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const existing = new Set(choices.map((c) => c.toLowerCase()));
    const additions = parts.filter((p) => !existing.has(p.toLowerCase()));
    if (additions.length > 0) setChoices([...choices, ...additions]);
    setChoiceDraft('');
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      ownerType,
      namespace,
      key,
      nameEn,
      nameHi,
      description,
      type,
      isRequired,
      isFilterable,
      choices,
      position: initial.position,
    };

    startSaving(async () => {
      const result = initial.id
        ? await updateMetafieldDefinition(initial.id, payload)
        : await createMetafieldDefinition(payload);

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? null);
        setFieldErrors(result.fieldErrors);
        if (!result.formErrors[0] && Object.keys(result.fieldErrors).length === 0) {
          setFormError('Could not save this field.');
        }
        scrollMainToTop();
        return;
      }

      toast.success(isEdit ? 'Field saved' : 'Field created');
      router.push('/metafields');
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial.id) return;
    const warning =
      initial.valueCount > 0
        ? `Delete “${initial.nameEn}” and the ${initial.valueCount} value${initial.valueCount === 1 ? '' : 's'} stored under it? This cannot be undone.`
        : `Delete “${initial.nameEn}”? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    startDeleting(async () => {
      const result = await deleteMetafieldDefinition(initial.id!);
      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not delete this field.');
        return;
      }
      toast.success('Field deleted');
      router.push('/metafields');
      router.refresh();
    });
  }

  const busy = isSaving || isDeleting;
  const spec = typeSpec(type);

  return (
    <form onSubmit={onSubmit}>
      <PageContainer narrow>
        <PageHeader
          title={isEdit ? initial.nameEn || 'Edit field' : 'New custom field'}
          backHref="/metafields"
          backLabel="Custom fields"
          actions={
            <>
              {isEdit && (
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

        {initial.autoCreated && (
          <Alert className="mb-4 border-[var(--warning-fg)]/25 bg-[var(--warning-bg)]">
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-[var(--warning-fg)]">
              This field was created automatically during a CSV import and its type was guessed.
              Check it and save to confirm.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nameEn">Name</Label>
              <Input
                id="nameEn"
                value={nameEn}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Grade"
                maxLength={191}
                aria-invalid={Boolean(fieldErrors.nameEn)}
              />
              {fieldErrors.nameEn && (
                <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.nameEn}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nameHi">Name (Hindi)</Label>
              <Input
                id="nameHi"
                value={nameHi}
                onChange={(e) => setNameHi(e.target.value)}
                lang="hi"
                maxLength={191}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown as a hint under the field"
                maxLength={1000}
              />
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold">Type</h2>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">What kind of value</Label>
              <Select value={type} onValueChange={(v) => setType(v as MetafieldType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METAFIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {METAFIELD_TYPE_SPECS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {spec.help ??
                  (spec.isList
                    ? 'Several values. In a CSV they are separated by a semicolon.'
                    : 'A single value.')}
              </p>
              {locked && (
                <p className="text-muted-foreground text-xs">
                  {initial.valueCount} product{initial.valueCount === 1 ? '' : 's'} already use this
                  field, so it cannot switch between a single value and a list.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="choices">Allowed values</Label>
              {choices.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {choices.map((choice) => (
                    <li
                      key={choice}
                      className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                    >
                      {choice}
                      <button
                        type="button"
                        onClick={() => setChoices(choices.filter((c) => c !== choice))}
                        aria-label={`Remove ${choice}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                id="choices"
                value={choiceDraft}
                onChange={(e) => setChoiceDraft(e.target.value)}
                onBlur={() => addChoice(choiceDraft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addChoice(choiceDraft);
                  }
                }}
                placeholder="Fe500, Fe550, Fe600"
                maxLength={191}
              />
              <p className="text-muted-foreground text-xs">
                Optional. Offered as suggestions when filling the field in.
              </p>
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <h2 className="font-semibold">Behaviour</h2>

            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="required" className="font-medium">
                  Required
                </Label>
                <p className="text-muted-foreground text-xs">
                  Warns when the field is left empty. It does not block saving.
                </p>
              </div>
              <Switch id="required" checked={isRequired} onCheckedChange={setIsRequired} />
            </div>

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="filterable" className="font-medium">
                  Filterable
                </Label>
                <p className="text-muted-foreground text-xs">
                  Adds this field to the search box on the product list.
                </p>
              </div>
              <Switch id="filterable" checked={isFilterable} onCheckedChange={setIsFilterable} />
            </div>
          </section>

          <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">Identifier</h2>
              <p className="text-muted-foreground text-xs">
                How this field appears in a CSV export:{' '}
                <code className="font-mono">
                  {nameEn || 'Name'} ({ownerType === 'VARIANT' ? 'variant' : 'product'}
                  .metafields.{namespace || 'custom'}.{key || 'key'})
                </code>
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner">Applies to</Label>
              <Select
                value={ownerType}
                onValueChange={(v) => setOwnerType(v as MetafieldOwnerType)}
                disabled={locked}
              >
                <SelectTrigger id="owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METAFIELD_OWNER_TYPES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OWNER_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="namespace">Namespace</Label>
                <Input
                  id="namespace"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="font-mono"
                  maxLength={64}
                  disabled={locked}
                  aria-invalid={Boolean(fieldErrors.namespace)}
                />
                {fieldErrors.namespace && (
                  <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.namespace}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setKeyTouched(true);
                  }}
                  className="font-mono"
                  maxLength={64}
                  disabled={locked}
                  aria-invalid={Boolean(fieldErrors.key)}
                />
                {fieldErrors.key && (
                  <p className="text-[var(--critical-fg)] text-xs">{fieldErrors.key}</p>
                )}
              </div>
            </div>

            {locked && (
              <p className="text-muted-foreground text-xs">
                Locked because values are stored against it. Create a new field instead of renaming
                this one.
              </p>
            )}
          </section>
        </div>
      </PageContainer>
    </form>
  );
}
