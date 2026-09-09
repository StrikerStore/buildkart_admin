'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { login } from './actions';

/**
 * Only accepts same-origin paths. Without this check, `?next=https://evil.example`
 * would turn the login form into an open redirect — and a convincing one, since
 * the victim really did just authenticate.
 */
function safeRedirect(next: string | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };

    setFormError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await login(input);

      if (!result.ok) {
        setFormError(result.formErrors[0] ?? 'Could not sign you in.');
        setFieldErrors(result.fieldErrors);
        return;
      }

      // The session cookie was set server-side; refresh so the proxy sees it.
      router.replace(safeRedirect(next));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError && (
        <Alert variant="destructive" className="border-[var(--critical-fg)]/20 bg-[var(--critical-bg)] text-[var(--critical-fg)]">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-[var(--critical-fg)]">{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-[var(--critical-fg)] text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-[var(--critical-fg)] text-xs">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
        {isPending ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  );
}
