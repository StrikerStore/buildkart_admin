'use client';

import { useEffect, useState, useTransition } from 'react';
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AuthenticatorSetup,
  CodeInput,
  RecoveryCodes,
  type AuthenticatorSetupData,
} from '@/components/settings/TwoFactorParts';
import { cancelSignIn, finishEnrolment, startEnrolment, submitSecondFactor } from './actions';

/**
 * After a right password: the code from the authenticator app — or, for an
 * owner who has never set one up, setting it up now and saving the recovery
 * codes. A sign-in that can no longer be finished goes back to the password.
 */
export function SecondStep({
  mode,
  onDone,
  onRestart,
}: {
  mode: 'totp' | 'enrol';
  onDone: () => void;
  onRestart: (message: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<AuthenticatorSetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (mode !== 'enrol') return;
    let cancelled = false;
    void startEnrolment().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.kind === 'expired') onRestart(result.formErrors[0] ?? null);
        else setError(result.formErrors[0] ?? 'Could not start setting it up.');
        return;
      }
      setSetup(result.setup);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, onRestart]);

  function back() {
    startTransition(async () => {
      await cancelSignIn();
      onRestart(null);
    });
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitSecondFactor(code);
      if (!result.ok) {
        if (result.kind === 'expired') return onRestart(result.formErrors[0] ?? null);
        setError(result.formErrors[0] ?? 'That code is not right.');
        return;
      }
      onDone();
    });
  }

  function finishSetup(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await finishEnrolment(value);
      if (!result.ok) {
        if (result.kind === 'expired') return onRestart(result.formErrors[0] ?? null);
        setError(result.formErrors[0] ?? 'That code is not right.');
        return;
      }
      setRecoveryCodes(result.recoveryCodes);
    });
  }

  if (recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Two-step sign-in is on</h2>
          <p className="text-muted-foreground text-sm">From now on, signing in asks for a code from the app.</p>
        </div>
        <RecoveryCodes codes={recoveryCodes} />
        <div className="flex items-center gap-2">
          <Checkbox id="codesSaved" checked={saved} onCheckedChange={(value) => setSaved(value === true)} />
          <Label htmlFor="codesSaved" className="font-normal">
            I have saved these recovery codes
          </Label>
        </div>
        <Button type="button" className="w-full" disabled={!saved} onClick={onDone}>
          Continue to the admin
        </Button>
      </div>
    );
  }

  if (mode === 'enrol') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Set up two-step sign-in</h2>
          <p className="text-muted-foreground text-sm">
            An owner account signs in with a password and a code from your phone. This takes a minute, once.
          </p>
        </div>
        {setup ? (
          <AuthenticatorSetup
            setup={setup}
            pending={isPending}
            error={error}
            submitLabel="Turn on and sign in"
            onSubmit={finishSetup}
          />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : (
          <LoaderCircleIcon className="text-muted-foreground size-5 animate-spin" aria-label="Loading" />
        )}
        <BackLink onClick={back} disabled={isPending} />
      </div>
    );
  }

  return (
    <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate aria-busy={isPending}>
      <div>
        <h2 className="font-semibold">Enter your code</h2>
        <p className="text-muted-foreground text-sm">
          Open the authenticator app on your phone and type the 6 digits for BuildKart Admin. Lost the phone? Use
          one of your recovery codes instead.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code</Label>
        <CodeInput id="code" value={code} onChange={setCode} error={error} allowRecovery />
      </div>

      <Button type="submit" disabled={isPending || code.trim().length < 6} className="w-full">
        {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
        {isPending ? 'Checking…' : 'Sign in'}
      </Button>
      <BackLink onClick={back} disabled={isPending} />
    </form>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert className="border-critical-fg/20 bg-critical-bg text-critical-fg [&_[data-slot=alert-description]]:text-critical-fg">
      <AlertCircleIcon className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function BackLink({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground self-start text-xs underline"
    >
      Use a different account
    </button>
  );
}
