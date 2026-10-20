'use client';

import { useState } from 'react';
import { CopyIcon, DownloadIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The pieces two-step sign-in is set up with, shared by the sign-in screen
 * (an owner's first time) and Settings → Account (turning it on, or moving it
 * to a new phone) so the two cannot drift.
 */

export type AuthenticatorSetupData = { qr: string; secret: string; account: string };

/** "JBSW Y3DP EHPK 3PXP" — a key read off a screen is typed in groups. */
function grouped(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** The six digits, as a phone keyboard and a password manager both expect them. */
export function CodeInput({
  id,
  value,
  onChange,
  error,
  allowRecovery = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** The sign-in screen also takes a recovery code, which has letters. */
  allowRecovery?: boolean;
}) {
  return (
    <>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={allowRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={allowRecovery ? 32 : 7}
        placeholder={allowRecovery ? '123456' : '123 456'}
        className="tabular font-mono tracking-widest sm:max-w-[200px]"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="text-xs text-[var(--critical-fg)]">
          {error}
        </span>
      )}
    </>
  );
}

/**
 * Scan this, then type what the app shows. The live sign-in, if there is
 * one, keeps working until the code is right — so this can be abandoned at
 * any point without locking anyone out.
 */
export function AuthenticatorSetup({
  setup,
  pending,
  error,
  submitLabel,
  onSubmit,
}: {
  setup: AuthenticatorSetupData;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(code);
      }}
    >
      <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          Install an authenticator app on your phone — Google Authenticator, Microsoft Authenticator or any
          other.
        </li>
        <li>In the app, add an account and scan this code.</li>
        <li>Type the 6 digits the app shows for BuildKart Admin.</li>
      </ol>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div
          className="size-[168px] shrink-0 rounded-md border bg-white p-1 [&>svg]:size-full"
          // Drawn by `qrcode` on the server from an otpauth link the API built;
          // nothing typed by anyone reaches it, and the library emits markup.
          dangerouslySetInnerHTML={{ __html: setup.qr }}
          role="img"
          aria-label="QR code for your authenticator app"
        />
        <div className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Cannot scan it? Choose “enter a setup key” and type:</span>
          <code className="bg-muted rounded px-2 py-1 font-mono text-sm break-all select-all">
            {grouped(setup.secret)}
          </code>
          <span className="text-muted-foreground">
            Account: {setup.account} · time-based
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setupCode">Code from the app</Label>
        <CodeInput id="setupCode" value={code} onChange={setCode} error={error} />
      </div>

      <Button type="submit" className="self-start" disabled={pending || code.replace(/\s/g, '').length < 6}>
        {pending && <LoaderCircleIcon className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}

/**
 * Shown once, straight after they are made: the way back in if the phone is
 * lost. Each works one time.
 */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Recovery codes copied');
    } catch {
      toast.error('Could not copy — select them and copy by hand.');
    }
  }

  function download() {
    const blob = new Blob(
      [`BuildKart Admin recovery codes\nEach works once, in place of a code from the app.\n\n${text}\n`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'buildkart-admin-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Keep these somewhere safe, away from your phone — printed, or in a password manager. If the phone is lost,
        each one signs you in once in place of a code. They are not shown again.
      </p>
      <ul className="bg-muted grid grid-cols-2 gap-x-6 gap-y-1 rounded-md px-4 py-3 font-mono text-sm sm:max-w-[360px]">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon className="size-4" />
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
