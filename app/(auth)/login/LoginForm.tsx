'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { login, type LoginFailureKind } from './actions';

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

/**
 * A fresh object for every failure, which matters more than it looks.
 *
 * Held as a bare string, a second wrong password sets the identical value,
 * `useState` bails out of the re-render, and the focus effect below — keyed on
 * this value — never fires again. The admin would be told nothing on every
 * attempt after the first.
 */
type Failure = { kind: LoginFailureKind; message: string };

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  /**
   * Focus moves to the alert; `role="alert"` alone is not enough.
   *
   * That role tells a screen reader. It does nothing for someone at 400% zoom
   * whose viewport is the password field, and who never sees a message appear
   * three inches above it. Moving focus serves both.
   *
   * In an effect rather than in the transition callback because the alert does
   * not exist yet when `setFailure` runs — the ref is null until React commits.
   */
  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);

  /**
   * Editing a field is a claim that what was wrong is fixed, so the error goes.
   *
   * A lockout is the exception: the window is counted server-side against the
   * email *and* the address, so a new password does not make it false, and
   * clearing it would invite five more attempts that cannot succeed.
   */
  function clearOnEdit(field: 'email' | 'password') {
    setFailure((current) => (current?.kind === 'rate-limited' ? current : null));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const { [field]: _cleared, ...rest } = current;
      return rest;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };

    setFailure(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await login(input);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFailure({
          kind: result.kind,
          message:
            result.formErrors[0] ??
            (result.kind === 'validation'
              ? 'Check the highlighted fields.'
              : 'Could not sign you in.'),
        });
        return;
      }

      // The session cookie was set server-side; refresh so the proxy sees it.
      router.replace(safeRedirect(next));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-busy={isPending}>
      {failure && (
        <Alert
          ref={alertRef}
          tabIndex={-1}
          /*
           * Not `variant="destructive"`. That variant colours the description
           * through `*:data-[slot=alert-description]:text-destructive/90` — a
           * child selector that outranks any class passed in, so the critical
           * tokens lost to `--destructive` and this message has been rendering
           * #e51c00 instead of #8e1f0b. Styled explicitly instead.
           */
          className="border-critical-fg/20 bg-critical-bg text-critical-fg [&_[data-slot=alert-description]]:text-critical-fg"
        >
          <AlertCircleIcon className="size-4" />
          <AlertDescription>
            {failure.message}
            {failure.kind === 'rate-limited' && (
              <span className="block text-xs opacity-90">
                Counted per account and per address, so waiting is the only way through.
              </span>
            )}
          </AlertDescription>
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
          onChange={() => clearOnEdit('email')}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-critical-fg text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>

        <div className="relative">
          <Input
            id="password"
            name="password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            // Without these, iOS capitalises the first letter of a revealed
            // password and underlines the rest of it in red.
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            className="pr-10"
            onChange={() => clearOnEdit('password')}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />

          {/*
           * A plain button, not `<Button>`: the default variant brings its own
           * background, its own height and a focus ring that would double up
           * with the global one. `type="button"` is not optional — a bare
           * button inside a form submits it, so the eye would try to log in.
           *
           * The label stays "Show password" while `aria-pressed` changes.
           * Flipping both makes a screen reader announce "Hide password,
           * pressed", which is two contradictory signals from one control.
           */}
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label="Show password"
            aria-pressed={passwordVisible}
            aria-controls="password"
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md transition-colors"
          >
            {passwordVisible ? (
              <EyeOffIcon className="size-4" aria-hidden="true" />
            ) : (
              <EyeIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {fieldErrors.password && (
          <p id="password-error" className="text-critical-fg text-xs">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/*
       * One live region, in the DOM from the first render.
       *
       * A region that arrives in the same commit as its text announces nothing,
       * which is why this is not rendered conditionally. It is also the only
       * one: a region per field, plus the alert's `role="alert"`, would fire
       * three announcements over each other on a single failed submit. Field
       * errors reach a screen reader through `aria-describedby` instead, at the
       * moment the field is focused and the error is actionable.
       */}
      <p aria-live="polite" className="sr-only">
        {passwordVisible ? 'Password is showing.' : 'Password is hidden.'}
      </p>

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
        {isPending ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  );
}
