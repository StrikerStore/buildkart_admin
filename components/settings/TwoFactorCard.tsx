'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatStoreDate, type AdminTwoFactorDto } from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  beginTwoFactor,
  confirmTwoFactor,
  newRecoveryCodes,
  turnOffTwoFactor,
  type TwoFactorSetup,
} from '@/app/(dashboard)/settings/account/actions';
import { AuthenticatorSetup, CodeInput, RecoveryCodes } from './TwoFactorParts';

/**
 * Two-step sign-in on the account screen: turn it on, move it to a new phone,
 * make new recovery codes, or — for staff, while owners must keep it — turn it
 * off. Anything that changes how this account signs in asks for the password
 * first, so a session left open cannot move the second step onto another phone.
 */
type Mode =
  | { kind: 'idle' }
  | { kind: 'password'; purpose: 'setup' | 'off' }
  | { kind: 'scan'; setup: TwoFactorSetup }
  | { kind: 'regenerate' }
  | { kind: 'codes'; codes: string[] };

export function TwoFactorCard({ status }: { status: AdminTwoFactorDto }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset(next: Mode = { kind: 'idle' }) {
    setMode(next);
    setPassword('');
    setCode('');
    setError(null);
  }

  function submitPassword(purpose: 'setup' | 'off') {
    setError(null);
    startTransition(async () => {
      if (purpose === 'setup') {
        const result = await beginTwoFactor({ password });
        if (!result.ok) return setError(result.fieldErrors.password ?? result.formErrors[0] ?? 'Could not start.');
        reset({ kind: 'scan', setup: result.data });
        return;
      }
      const result = await turnOffTwoFactor({ password });
      if (!result.ok) return setError(result.fieldErrors.password ?? result.formErrors[0] ?? 'Could not turn it off.');
      toast.success('Two-step sign-in is off');
      reset();
      router.refresh();
    });
  }

  function confirm(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await confirmTwoFactor({ code: value });
      if (!result.ok) return setError(result.fieldErrors.code ?? result.formErrors[0] ?? 'That code is not right.');
      toast.success(status.enabled ? 'Moved to the new phone. Other devices are signed out.' : 'Two-step sign-in is on');
      reset({ kind: 'codes', codes: result.data.recoveryCodes });
      router.refresh();
    });
  }

  function regenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await newRecoveryCodes({ code });
      if (!result.ok) return setError(result.fieldErrors.code ?? result.formErrors[0] ?? 'That code is not right.');
      reset({ kind: 'codes', codes: result.data.recoveryCodes });
      router.refresh();
    });
  }

  if (!status.available) {
    return (
      <p className="text-muted-foreground text-sm">
        Not available yet: the API server needs <code>SETTINGS_ENCRYPTION_KEY</code> set to keep the secret safe.
      </p>
    );
  }

  if (mode.kind === 'codes') {
    return (
      <div className="flex flex-col gap-3">
        <RecoveryCodes codes={mode.codes} />
        <Button type="button" variant="outline" className="self-start" onClick={() => reset()}>
          Done
        </Button>
      </div>
    );
  }

  if (mode.kind === 'scan') {
    return (
      <div className="flex flex-col gap-3">
        <AuthenticatorSetup
          setup={mode.setup}
          pending={isPending}
          error={error}
          submitLabel={status.enabled ? 'Move to this phone' : 'Turn on'}
          onSubmit={confirm}
        />
        <CancelLink onClick={() => reset()} disabled={isPending} />
      </div>
    );
  }

  if (mode.kind === 'password') {
    return (
      <form
        className="flex flex-col gap-3 sm:max-w-[360px]"
        onSubmit={(event) => {
          event.preventDefault();
          submitPassword(mode.purpose);
        }}
      >
        <input type="hidden" name="username" autoComplete="username" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="twoFactorPassword">Your password</Label>
          <Input
            id="twoFactorPassword"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {error && <span className="text-xs text-[var(--critical-fg)]">{error}</span>}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || password === ''}>
            {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
            {mode.purpose === 'off' ? 'Turn off' : 'Continue'}
          </Button>
          <Button type="button" variant="outline" onClick={() => reset()}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (mode.kind === 'regenerate') {
    return (
      <form className="flex flex-col gap-3" onSubmit={regenerate}>
        <p className="text-muted-foreground text-sm">The old recovery codes stop working as soon as new ones are made.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="regenerateCode">Code from the app</Label>
          <CodeInput id="regenerateCode" value={code} onChange={setCode} error={error} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || code.replace(/\s/g, '').length < 6}>
            {isPending && <LoaderCircleIcon className="size-4 animate-spin" />}
            Make new codes
          </Button>
          <Button type="button" variant="outline" onClick={() => reset()}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (!status.enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Off. Signing in takes only your password, so anyone who learns it can open every customer&rsquo;s record.
        </p>
        <Button type="button" className="self-start" onClick={() => reset({ kind: 'password', purpose: 'setup' })}>
          <ShieldCheckIcon className="size-4" />
          Turn on
        </Button>
      </div>
    );
  }

  const fewCodesLeft = status.recoveryCodesLeft <= 3;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        On{status.enabledAt ? ` since ${formatStoreDate(status.enabledAt)}` : ''}.{' '}
        <span className={fewCodesLeft ? 'text-[var(--warning-fg)]' : 'text-muted-foreground'}>
          {status.recoveryCodesLeft} recovery code{status.recoveryCodesLeft === 1 ? '' : 's'} left
          {fewCodesLeft ? ' — make new ones' : ''}.
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => reset({ kind: 'password', purpose: 'setup' })}>
          Move to a new phone
        </Button>
        <Button type="button" variant="outline" onClick={() => reset({ kind: 'regenerate' })}>
          New recovery codes
        </Button>
        {!status.required && (
          <Button
            type="button"
            variant="outline"
            className="text-[var(--critical-fg)] hover:text-[var(--critical-fg)]"
            onClick={() => reset({ kind: 'password', purpose: 'off' })}
          >
            Turn off
          </Button>
        )}
      </div>
      {status.required && (
        <p className="text-muted-foreground text-xs">An owner account must keep it on.</p>
      )}
    </div>
  );
}

function CancelLink({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground self-start text-xs underline"
    >
      Cancel — keep signing in as before
    </button>
  );
}
