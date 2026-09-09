'use client';

import { useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Brand as free text with suggestions, created on demand.
 *
 * A fixed dropdown would be a dead end: with no brands in the database there is
 * nothing to pick, and nowhere to add one. Typing creates the brand on save,
 * matched by slug so "Ultra Tech" and "ultratech" converge on one row rather
 * than quietly becoming two.
 */
export function BrandInput({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim().toLowerCase();
  const matching = suggestions
    .filter((s) => s.toLowerCase() !== query && (query === '' || s.toLowerCase().includes(query)))
    .slice(0, 6);

  const isNew =
    value.trim() !== '' && !suggestions.some((s) => s.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="brand">Brand</Label>

      <div className="relative">
        <Input
          ref={inputRef}
          id="brand"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delayed so a click on a suggestion lands before the list unmounts.
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="UltraTech"
          maxLength={191}
          autoComplete="off"
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            aria-label="Clear brand"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {focused && matching.length > 0 && (
        <ul className="bg-card flex flex-wrap gap-1.5 rounded-md border p-1.5">
          {matching.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
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
        {isNew
          ? `“${value.trim()}” will be created as a new brand.`
          : 'Type to create a brand, or pick an existing one.'}
      </p>
    </div>
  );
}
