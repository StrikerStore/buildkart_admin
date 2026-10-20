'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUSES,
  toStoreInputValue,
  type IncidentStatus,
  type PrivacyIncidentDto,
} from '@StrikerStore/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createIncident, updateIncident } from '@/app/(dashboard)/incidents/actions';

type Values = {
  title: string;
  whatHappened: string;
  whenHappened: string;
  dataAffected: string;
  likelyImpact: string;
  measuresTaken: string;
  customerSteps: string;
  detectedAt: string;
  status: IncidentStatus;
  boardNotifiedAt: string;
  boardReportAt: string;
  boardReference: string;
  notes: string;
};

function initialValues(incident: PrivacyIncidentDto | null, now: string): Values {
  return {
    title: incident?.title ?? '',
    whatHappened: incident?.whatHappened ?? '',
    whenHappened: incident?.whenHappened ?? '',
    dataAffected: incident?.dataAffected ?? '',
    likelyImpact: incident?.likelyImpact ?? '',
    measuresTaken: incident?.measuresTaken ?? '',
    customerSteps: incident?.customerSteps ?? '',
    // A new record starts at now: most breaches are recorded as they are found.
    detectedAt: incident ? toStoreInputValue(incident.detectedAt) : now,
    status: incident?.status ?? 'OPEN',
    boardNotifiedAt: toStoreInputValue(incident?.boardNotifiedAt),
    boardReportAt: toStoreInputValue(incident?.boardReportAt),
    boardReference: incident?.boardReference ?? '',
    notes: incident?.notes ?? '',
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <span className="text-xs text-[var(--critical-fg)]">{error}</span>
      ) : (
        hint && <span className="text-muted-foreground text-xs">{hint}</span>
      )}
    </div>
  );
}

/** The notice fields are one WhatsApp parameter each, so each shows what is left. */
const NOTICE_LIMIT = 250;

/**
 * Recording a breach, and keeping the record up to date. The first section is
 * what customers are sent, word for word; the rest is for the Board and the
 * shop's own file.
 */
export function IncidentForm({
  incident,
  now = '',
}: {
  incident: PrivacyIncidentDto | null;
  /**
   * "Now" as the server rendered it, for a new record's "found out" — read on
   * the server so the browser hydrates the same minute rather than its own.
   */
  now?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(incident, now));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();

  const set =
    (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  const notice = (key: keyof Values, label: string, hint: string, rows = 3) => (
    <Field
      id={key}
      label={label}
      error={errors[key]}
      hint={
        <>
          {hint} <span className="tabular">({NOTICE_LIMIT - values[key].length} left)</span>
        </>
      }
    >
      <Textarea id={key} value={values[key]} onChange={set(key)} rows={rows} maxLength={NOTICE_LIMIT} />
    </Field>
  );

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = incident
        ? await updateIncident({ ...values, id: incident.id })
        : await createIncident(values);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.formErrors[0] ?? 'Check the highlighted fields.');
        return;
      }
      if (incident) {
        toast.success('Saved');
        router.refresh();
      } else {
        toast.success('Breach recorded');
        router.push(`/incidents/${(result.data as { id: string }).id}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="The breach">
        <Field id="title" label="Short name" error={errors.title} hint="For you — customers never see it.">
          <Input id="title" value={values.title} onChange={set('title')} placeholder="Delivery sheet sent to the wrong group" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="detectedAt"
            label="When you found out"
            error={errors.detectedAt}
            hint="The Board's 72 hours run from here."
          >
            <Input id="detectedAt" type="datetime-local" value={values.detectedAt} onChange={set('detectedAt')} />
          </Field>
          <Field id="dataAffected" label="What data was involved" error={errors.dataAffected} hint="For the record and the Board.">
            <Input
              id="dataAffected"
              value={values.dataAffected}
              onChange={set('dataAffected')}
              placeholder="Names, phone numbers, delivery addresses"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="What customers are told"
        hint="Sent word for word on WhatsApp, in the “Data breach notice” message. The law says it must cover all five — write them plainly, as you would say them."
      >
        {notice('whatHappened', 'What happened', 'What happened to their data, and how much of it.')}
        <Field id="whenHappened" label="When it happened" error={errors.whenHappened} hint="As far as you know, e.g. “Between 3 and 5 May 2027”.">
          <Input id="whenHappened" value={values.whenHappened} onChange={set('whenHappened')} maxLength={80} />
        </Field>
        {notice('likelyImpact', 'What it could mean for them', 'e.g. calls or messages pretending to be from you.')}
        {notice('measuresTaken', 'What you have done', 'What was fixed, and what is still being done.')}
        {notice('customerSteps', 'What they should do', 'Steps that protect them, e.g. never share an OTP.')}
      </Section>

      {incident && (
        <Section
          title="Data Protection Board"
          hint="Tell the Board without delay, on its online portal, then send the detailed report within 72 hours of finding out. Record both here."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="boardNotifiedAt" label="Board told on" error={errors.boardNotifiedAt}>
              <Input
                id="boardNotifiedAt"
                type="datetime-local"
                value={values.boardNotifiedAt}
                onChange={set('boardNotifiedAt')}
              />
            </Field>
            <Field id="boardReportAt" label="Detailed report sent on" error={errors.boardReportAt}>
              <Input id="boardReportAt" type="datetime-local" value={values.boardReportAt} onChange={set('boardReportAt')} />
            </Field>
          </div>
          <Field id="boardReference" label="Board reference" error={errors.boardReference} hint="Any acknowledgement or reference number they gave.">
            <Input id="boardReference" value={values.boardReference} onChange={set('boardReference')} className="sm:max-w-[360px]" />
          </Field>
        </Section>
      )}

      {incident && (
        <Section title="Your notes" hint="Never sent to anyone. What caused it, who was involved, what was changed so it does not happen again.">
          <Field id="notes" label="Notes" error={errors.notes}>
            <Textarea id="notes" value={values.notes} onChange={set('notes')} rows={5} />
          </Field>
          <Field id="status" label="Status">
            <Select value={values.status} onValueChange={(value) => setValues((current) => ({ ...current, status: value as IncidentStatus }))}>
              <SelectTrigger id="status" className="sm:max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {INCIDENT_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>
      )}

      <Button type="button" className="self-start" disabled={isSaving} onClick={save}>
        {isSaving ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
        {incident ? 'Save' : 'Record the breach'}
      </Button>
    </div>
  );
}
