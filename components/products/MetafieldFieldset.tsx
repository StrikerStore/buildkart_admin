'use client';

import { useId } from 'react';
import { XIcon } from 'lucide-react';
import { typeSpec } from '@StrikerStore/contract';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/* Produced by core and re-exported through `@StrikerStore/contract` as a type, so this
 * app renders the shape without depending on the package that reaches the
 * database. The storefront will read the same shape for specifications. */
export type { MetafieldDefinitionDto } from '@StrikerStore/contract';
import type { MetafieldDefinitionDto } from '@StrikerStore/contract';

/**
 * Renders the admin-defined custom fields on the product form.
 *
 * Values are held as the raw cell string in every case, including lists, so the
 * form and the CSV importer travel through one parser. Two parsers would
 * eventually disagree about a value like "Cream, Black", and the disagreement
 * would be silent data corruption rather than an error.
 */
export function MetafieldFieldset({
  definitions,
  values,
  onChange,
}: {
  definitions: MetafieldDefinitionDto[];
  values: Record<string, string>;
  onChange: (definitionId: string, raw: string) => void;
}) {
  if (definitions.length === 0) return null;

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Specifications</h2>
        <p className="text-muted-foreground text-xs">
          Custom fields you defined under Products → Custom fields.
        </p>
      </div>

      {definitions.map((definition) => (
        <MetafieldInput
          key={definition.id}
          definition={definition}
          value={values[definition.id] ?? ''}
          onChange={(raw) => onChange(definition.id, raw)}
        />
      ))}
    </section>
  );
}

function MetafieldInput({
  definition,
  value,
  onChange,
}: {
  definition: MetafieldDefinitionDto;
  value: string;
  onChange: (raw: string) => void;
}) {
  const id = useId();
  const spec = typeSpec(definition.type);
  const listId = `${id}-choices`;
  const missing = definition.isRequired && value.trim() === '';

  const label = (
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={id}>
        {definition.nameEn}
        {definition.isRequired && (
          <span className="text-muted-foreground ml-0.5 font-normal">*</span>
        )}
      </Label>
      <span className="text-muted-foreground font-mono text-[11px]">
        {definition.namespace}.{definition.key}
      </span>
    </div>
  );

  const help = definition.description ?? spec.help;

  const suggestions =
    definition.choices.length > 0 ? (
      <datalist id={listId}>
        {definition.choices.map((choice) => (
          <option key={choice} value={choice} />
        ))}
      </datalist>
    ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      {suggestions}

      {spec.input === 'boolean' ? (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <span className="text-muted-foreground text-xs">{value === 'true' ? 'Yes' : 'No'}</span>
        </div>
      ) : spec.input === 'list' ? (
        <ListInput definition={definition} value={value} onChange={onChange} listId={listId} />
      ) : spec.input === 'textarea' || spec.input === 'json' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={spec.input === 'json' ? 4 : 3}
          className={spec.input === 'json' ? 'font-mono text-xs' : undefined}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          list={definition.choices.length > 0 ? listId : undefined}
          // Numbers use inputMode rather than type="number" for the same reason
          // prices do: Android keyboards drop the decimal separator.
          inputMode={spec.input === 'number' ? 'decimal' : undefined}
          type={spec.input === 'date' ? 'date' : spec.input === 'datetime' ? 'datetime-local' : 'text'}
        />
      )}

      {missing ? (
        <p className="text-xs text-[var(--warning-fg)]">
          {definition.nameEn} is marked required and is empty.
        </p>
      ) : help ? (
        <p className="text-muted-foreground text-xs">{help}</p>
      ) : null}
    </div>
  );
}

const LIST_SEPARATOR = '; ';

/**
 * A chip editor over the same joined string the CSV uses.
 *
 * The value never leaves this component as an array: joining here means the
 * server parses form input and CSV input with identical code.
 */
function ListInput({
  definition,
  value,
  onChange,
  listId,
}: {
  definition: MetafieldDefinitionDto;
  value: string;
  onChange: (raw: string) => void;
  listId: string;
}) {
  const items = value.trim() === '' ? [] : value.split(LIST_SEPARATOR).filter(Boolean);

  function add(raw: string) {
    const entry = raw.trim();
    if (entry === '') return;
    if (items.some((i) => i.toLowerCase() === entry.toLowerCase())) return;
    onChange([...items, entry].join(LIST_SEPARATOR));
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index).join(LIST_SEPARATOR));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${item}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        list={definition.choices.length > 0 ? listId : undefined}
        placeholder={items.length === 0 ? 'Type a value and press Enter' : 'Add another'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        onBlur={(e) => {
          add(e.currentTarget.value);
          e.currentTarget.value = '';
        }}
        maxLength={191}
      />
      <p className="text-muted-foreground text-xs">
        Several values. Commas stay inside a value; use Enter to separate them.
      </p>
    </div>
  );
}
