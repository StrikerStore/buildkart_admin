'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'hi';

/**
 * One field, two languages, one at a time.
 *
 * Showing both inputs side by side doubles the height of every form and implies
 * Hindi is mandatory. It isn't — English is authoritative and Hindi falls back
 * to it at read time. So the languages share a slot behind a small toggle, and
 * the toggle carries a dot when the Hindi value is empty. That makes "what still
 * needs translating" visible at a glance without nagging, which matters because
 * the owner will enter the catalog in English first and translate later.
 */
export function TranslatableField({
  label,
  valueEn,
  valueHi,
  onChangeEn,
  onChangeHi,
  multiline = false,
  rows = 4,
  required = false,
  placeholder,
  helpText,
  errorEn,
  maxLength,
}: {
  label: string;
  valueEn: string;
  valueHi: string;
  onChangeEn: (value: string) => void;
  onChangeHi: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  errorEn?: string;
  maxLength?: number;
}) {
  const [locale, setLocale] = useState<Locale>('en');
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  const isEn = locale === 'en';
  const value = isEn ? valueEn : valueHi;
  const onChange = isEn ? onChangeEn : onChangeHi;
  const hindiMissing = valueHi.trim() === '';

  const describedBy = [errorEn ? errorId : null, helpText ? helpId : null]
    .filter(Boolean)
    .join(' ');

  const shared = {
    id: fieldId,
    value,
    placeholder,
    maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    'aria-invalid': Boolean(errorEn) && isEn,
    'aria-describedby': describedBy || undefined,
    // Hindi input needs the right script hint for mobile keyboards and fonts.
    lang: isEn ? 'en' : 'hi',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>
          {label}
          {required && <span className="text-muted-foreground ml-0.5 font-normal">*</span>}
        </Label>

        <div
          className="bg-muted flex items-center gap-0.5 rounded-md p-0.5"
          role="group"
          aria-label={`${label} language`}
        >
          {(['en', 'hi'] as const).map((code) => {
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={active}
                className={cn(
                  'relative rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-[var(--shadow-card)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {code === 'en' ? 'EN' : 'हिं'}
                {code === 'hi' && hindiMissing && (
                  <span
                    className="absolute -top-px -right-px size-1.5 rounded-full bg-[var(--brand)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {multiline ? <Textarea {...shared} rows={rows} /> : <Input {...shared} />}

      {errorEn && isEn && (
        <p id={errorId} className="text-[var(--critical-fg)] text-xs">
          {errorEn}
        </p>
      )}

      {helpText && !errorEn && (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helpText}
        </p>
      )}

      {!isEn && hindiMissing && (
        <p className="text-muted-foreground text-xs">
          Leave blank to show the English text to Hindi customers.
        </p>
      )}
    </div>
  );
}
