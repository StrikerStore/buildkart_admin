'use client';

/**
 * Renders whatever a write chose to record.
 *
 * The shapes vary on purpose — a category rename records two names, a bulk tag
 * records a count, a settings save records the whole payload — so this renders
 * defensively rather than assuming a schema. Three cases, in order of how much
 * it can say:
 *
 *   1. `{ before, after }`  → a field-by-field comparison
 *   2. a flat object        → a label/value list
 *   3. anything else        → formatted JSON
 *
 * Never throws on a shape it does not know. The change log is where someone
 * goes when something has already gone wrong; it is the last screen that should
 * be able to break.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** camelCase and dotted keys into something readable, without a lookup table. */
function humaniseKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value === '' ? '—' : value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.map(renderValue).join(', ');
  }
  return JSON.stringify(value);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-3">
      <dt className="text-muted-foreground shrink-0 text-xs sm:w-[180px]">{label}</dt>
      <dd className="min-w-0 text-xs break-words">{children}</dd>
    </div>
  );
}

export function DiffViewer({ diff }: { diff: unknown }) {
  if (diff === null || diff === undefined) {
    return <p className="text-muted-foreground text-xs">Nothing else was recorded.</p>;
  }

  if (!isPlainObject(diff)) {
    return <Json value={diff} />;
  }

  const before = diff.before;
  const after = diff.after;

  if (isPlainObject(before) && isPlainObject(after)) {
    // Union of both sides: a field that was cleared exists only in `before`, and
    // showing only `after`'s keys would hide exactly the change worth seeing.
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const changed = keys.filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );

    if (changed.length === 0) {
      return <p className="text-muted-foreground text-xs">Saved without changing any value.</p>;
    }

    return (
      <dl className="divide-y">
        {changed.map((key) => (
          <Row key={key} label={humaniseKey(key)}>
            <span className="text-muted-foreground line-through">{renderValue(before[key])}</span>
            <span className="text-muted-foreground mx-1.5">→</span>
            <span className="font-medium">{renderValue(after[key])}</span>
          </Row>
        ))}
      </dl>
    );
  }

  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">Nothing else was recorded.</p>;
  }

  return (
    <dl className="divide-y">
      {entries.map(([key, value]) => (
        <Row key={key} label={humaniseKey(key)}>
          {isPlainObject(value) ? <Json value={value} /> : renderValue(value)}
        </Row>
      ))}
    </dl>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="bg-muted/40 max-h-[240px] overflow-auto rounded p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
