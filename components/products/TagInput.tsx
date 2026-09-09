'use client';

import { useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Free-text tags, created as you type.
 *
 * A fixed picker would be wrong here: the useful vocabulary of a construction
 * catalog — "ISI marked", "waterproof", "heavy-duty" — only emerges while the
 * catalog is being entered. Existing tags are offered as suggestions so the set
 * converges instead of sprawling into near-duplicates.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const name = raw.trim();
    if (!name) return;
    // Case-insensitive so "Cement" typed twice does not become two tags.
    if (!value.some((v) => v.toLowerCase() === name.toLowerCase())) {
      onChange([...value, name]);
    }
    setDraft('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const matching = draft.trim()
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(draft.trim().toLowerCase()) &&
            !value.some((v) => v.toLowerCase() === s.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tags">Tags</Label>

      <div
        className={cn(
          'bg-card flex flex-wrap items-center gap-1.5 rounded-md border p-1.5',
          focused && 'ring-2 ring-[var(--ring)] ring-offset-1',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((t) => t !== tag));
              }}
              aria-label={`Remove tag ${tag}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}

        <Input
          ref={inputRef}
          id="tags"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Commit a half-typed tag rather than silently discarding it.
            add(draft);
          }}
          placeholder={value.length === 0 ? 'waterproof, ISI marked…' : ''}
          className="h-6 min-w-[140px] flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {focused && matching.length > 0 && (
        <ul className="bg-card flex flex-wrap gap-1.5 rounded-md border p-1.5">
          {matching.map((s) => (
            <li key={s}>
              <button
                type="button"
                // onMouseDown, not onClick: blur fires first and would clear the
                // draft before a click ever lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                className="hover:bg-muted rounded px-1.5 py-0.5 text-xs"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Press Enter or comma to add. Tags power search and related products.
      </p>
    </div>
  );
}
