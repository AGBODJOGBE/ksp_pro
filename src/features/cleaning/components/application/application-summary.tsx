'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatPhone, phoneFromInput } from '@/lib/phone';
import type { SkillOption } from '@/features/cleaning/application-api';
import type { ApplicationDraft } from '@/features/cleaning/application/draft';
import type { StepKey } from '@/features/cleaning/application/steps';
import { applicationTexts as t } from '@/features/cleaning/application/texts';
import type { PublicZone } from '@/features/cleaning/schemas';
import { WEEKDAYS } from '@/features/cleaning/weekly';
import { WEEKDAY_LABEL } from '@/features/cleaning/weekly-texts';

function Row({
  label,
  step,
  onEdit,
  disabled,
  children,
}: {
  label: string;
  step: StepKey;
  onEdit: (step: StepKey) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border-line grid gap-1 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-small text-ink-muted font-semibold">{label}</dt>
        <Button
          variant="ghost"
          className="-my-2 -mr-3 px-3"
          aria-label={t.summary.editStep(t.steps[step])}
          disabled={disabled}
          onClick={() => onEdit(step)}
        >
          {t.summary.edit}
        </Button>
      </div>
      <dd className="text-ink font-medium break-words">{children}</dd>
    </div>
  );
}

const phone = (value: string) => {
  const normalized = phoneFromInput(value);
  return normalized ? formatPhone(normalized) : value;
};

/** Récapitulatif de la candidature, avec un lien vers chaque étape. */
export function ApplicationSummary({
  draft,
  zones,
  skills,
  invitation,
  onEdit,
  disabled,
}: {
  draft: ApplicationDraft;
  zones: ReadonlyArray<PublicZone>;
  skills: ReadonlyArray<SkillOption>;
  invitation: boolean;
  onEdit: (step: StepKey) => void;
  disabled: boolean;
}) {
  const s = t.summary;
  const zoneName = (key: string) => zones.find((zone) => zone.communeKey === key)?.name ?? key;
  const skillName = (code: string) => skills.find((skill) => skill.code === code)?.name ?? code;
  const days = WEEKDAYS.filter((day) => draft.weekly[day].length);
  const row = { onEdit, disabled };
  return (
    <div className="grid gap-4">
      <p className="text-ink-muted">{s.hint}</p>
      <dl className="rounded-card border-line bg-surface border px-4 shadow-xs sm:px-5">
        <Row label={s.name} step="identity" {...row}>
          {`${draft.firstName.trim()} ${draft.lastName.trim()}`}
        </Row>
        <Row label={s.photo} step="photo" {...row}>
          {draft.photo ? s.provided : s.none}
        </Row>
        <Row label={s.idDocument} step="idDocument" {...row}>
          {draft.idFront && draft.idBack ? s.providedBoth : s.none}
        </Row>
        <Row label={s.residence} step="residence" {...row}>
          {draft.residenceCommuneKey ? zoneName(draft.residenceCommuneKey) : s.none}
        </Row>
        <Row label={s.zones} step="zones" {...row}>
          {draft.zoneKeys.length ? draft.zoneKeys.map(zoneName).join(', ') : s.none}
        </Row>
        <Row label={s.skills} step="skills" {...row}>
          {draft.skillCodes.length ? draft.skillCodes.map(skillName).join(', ') : s.none}
        </Row>
        <Row label={s.availability} step="availability" {...row}>
          {days.length ? (
            <ul className="grid gap-0.5">
              {days.map((day) => (
                <li key={day}>
                  <span className="font-semibold">{WEEKDAY_LABEL[day]}</span>{' '}
                  <span className="tabular-nums">
                    {draft.weekly[day].map((range) => `${range.start} – ${range.end}`).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            s.noDays
          )}
        </Row>
        <Row label={s.emergency} step="emergency" {...row}>
          {draft.emergencyName.trim()}
          {draft.emergencyPhone ? `, ${phone(draft.emergencyPhone)}` : ''}
        </Row>
        <Row label={s.employment} step="employment" {...row}>
          {draft.employmentKind === 'employee'
            ? t.employment.employee
            : draft.employmentKind === 'independent'
              ? t.employment.independent
              : s.none}
        </Row>
        <Row label={s.mobileMoney} step="mobileMoney" {...row}>
          {draft.mobileMoney.trim() ? phone(draft.mobileMoney) : s.none}
        </Row>
      </dl>
      {invitation ? (
        <p className="text-ink flex items-center gap-2 font-medium">
          <span className="text-ink-muted">{s.invitation} :</span> {s.invitationJoined}
        </p>
      ) : null}
    </div>
  );
}
