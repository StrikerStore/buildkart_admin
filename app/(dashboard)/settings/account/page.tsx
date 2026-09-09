import type { Metadata } from 'next';
import { formatStoreDateTime } from '@buildkart/contract';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { ProfileForm, PasswordForm } from '@/components/settings/AccountForms';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'Account' };

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <span>{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

export default async function AccountSettingsPage() {
  // No permission beyond being signed in: this screen is only ever about your
  // own account, and locking a staff member out of their own password would be
  // the opposite of what the permission is for.
  await requireAdmin();

  const account = await (await api()).auth.account.query();

  return (
    <PageContainer narrow>
      <PageHeader
        title="Account"
        subtitle="Your own login."
        backHref="/settings"
        backLabel="Settings"
      />

      <div className="flex flex-col gap-4">
        <Card title="Your details">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnly
              label="Email"
              value={account.email}
              hint="This is your login. Changing it needs a developer for now."
            />
            <ReadOnly
              label="Role"
              value={account.role === 'OWNER' ? 'Owner' : 'Staff'}
              hint={
                account.role === 'OWNER'
                  ? 'Every screen, including settings and deletions.'
                  : 'Day-to-day screens; not settings or deletions.'
              }
            />
            <ReadOnly
              label="Signed in"
              value={account.lastLoginAt ? formatStoreDateTime(account.lastLoginAt) : '—'}
              hint="When this session began."
            />
          </div>

          <ProfileForm initial={{ name: account.name }} />
        </Card>

        <Card title="Password" subtitle="Changing it signs out every other device immediately.">
          <PasswordForm />
        </Card>
      </div>
    </PageContainer>
  );
}
