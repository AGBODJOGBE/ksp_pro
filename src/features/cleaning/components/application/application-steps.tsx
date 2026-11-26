'use client';

import type { ReactNode } from 'react';
import { BackendPending } from '@/components/ui/backend-pending';
import { Button } from '@/components/ui/button';
import { FieldError, FormMessage, TextField } from '@/components/ui/field';
import { ChoicePill, Fieldset, SelectField } from '@/components/ui/form-fields';
import { SkeletonCards } from '@/components/ui/skeleton';
import { PhotoField } from '@/features/file';
import type { SkillOption } from '@/features/cleaning/application-api';
import type { ApplicationDraft } from '@/features/cleaning/application/draft';
import { APPLICATION_FILE_PURPOSE } from '@/features/cleaning/application/files';
import type { StepErrors, StepKey } from '@/features/cleaning/application/steps';
import { applicationTexts as t } from '@/features/cleaning/application/texts';
import type { PublicZone } from '@/features/cleaning/schemas';
import { WeeklyEditor } from '@/features/cleaning/components/weekly-editor';

/** Liste lue à la gateway pour une étape (communes, compétences). */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export interface StepProps {
  step: StepKey;
  draft: ApplicationDraft;
  update: (patch: Partial<ApplicationDraft>) => void;
  errors: StepErrors;
  zones: Loaded<PublicZone[]>;
  skills: Loaded<SkillOption[]>;
  onRetryZones: () => void;
  onRetrySkills: () => void;
  disabled: boolean;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>{message}</FormMessage>
      <Button variant="secondary" onClick={onRetry}>
        {t.retry}
      </Button>
    </div>
  );
}

/** Liste de cases à cocher en pastilles (communes, compétences). */
function CheckList({
  id,
  legend,
  hint,
  error,
  options,
  selected,
  onChange,
  disabled,
  footer,
}: {
  id: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: ReadonlyArray<string>;
  onChange: (values: string[]) => void;
  disabled: boolean;
  footer?: ReactNode;
}) {
  return (
    <Fieldset id={id} legend={legend} hint={hint} error={error} legendClassName="sr-only">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <ChoicePill
            key={option.value}
            type="checkbox"
            name={id}
            value={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )
            }
          />
        ))}
      </div>
      {footer}
    </Fieldset>
  );
}

/** Champs d'une étape de la candidature (le titre et la navigation sont dans le formulaire). */
export function StepFields({
  step,
  draft,
  update,
  errors,
  zones,
  skills,
  onRetryZones,
  onRetrySkills,
  disabled,
}: StepProps) {
  switch (step) {
    case 'identity':
      return (
        <div className="grid gap-5">
          <p className="text-ink-muted">{t.identity.hint}</p>
          <TextField
            id="candidature-firstName"
            label={t.identity.firstName}
            autoComplete="given-name"
            value={draft.firstName}
            maxLength={100}
            disabled={disabled}
            error={errors.firstName}
            onChange={(event) => update({ firstName: event.target.value })}
          />
          <TextField
            id="candidature-lastName"
            label={t.identity.lastName}
            autoComplete="family-name"
            value={draft.lastName}
            maxLength={100}
            disabled={disabled}
            error={errors.lastName}
            onChange={(event) => update({ lastName: event.target.value })}
          />
        </div>
      );
    case 'photo':
      return (
        <PhotoField
          id="candidature-photo"
          label={t.photo.label}
          hint={t.photo.hint}
          purpose={APPLICATION_FILE_PURPOSE}
          value={draft.photo}
          onChange={(photo) => update({ photo })}
          texts={t.photoField}
          error={errors.photo}
          disabled={disabled}
          previewClassName="aspect-square w-48"
        />
      );
    case 'idDocument':
      return (
        <div className="grid gap-6">
          <p className="text-ink-muted">{t.idDocument.hint}</p>
          <PhotoField
            id="candidature-idFront"
            label={t.idDocument.front}
            purpose={APPLICATION_FILE_PURPOSE}
            value={draft.idFront}
            onChange={(idFront) => update({ idFront })}
            texts={t.photoField}
            error={errors.idFront}
            disabled={disabled}
          />
          <PhotoField
            id="candidature-idBack"
            label={t.idDocument.back}
            purpose={APPLICATION_FILE_PURPOSE}
            value={draft.idBack}
            onChange={(idBack) => update({ idBack })}
            texts={t.photoField}
            error={errors.idBack}
            disabled={disabled}
          />
        </div>
      );
    case 'residence':
      if (zones.status === 'loading')
        return <SkeletonCards label={t.residence.loading} rows={1} media={false} />;
      if (zones.status !== 'ready')
        return (
          <LoadError
            message={zones.status === 'error' ? zones.message : t.errors.zonesLoad}
            onRetry={onRetryZones}
          />
        );
      return (
        <SelectField
          id="candidature-residence"
          label={t.residence.label}
          hint={t.residence.hint}
          value={draft.residenceCommuneKey}
          disabled={disabled}
          error={errors.residence}
          onChange={(event) => update({ residenceCommuneKey: event.target.value })}
        >
          <option value="">{t.residence.placeholder}</option>
          {zones.data.map((zone) => (
            <option key={zone.communeKey} value={zone.communeKey}>
              {zone.name}
            </option>
          ))}
        </SelectField>
      );
    case 'zones':
      if (zones.status === 'loading')
        return <SkeletonCards label={t.residence.loading} rows={2} media={false} />;
      if (zones.status !== 'ready')
        return (
          <LoadError
            message={zones.status === 'error' ? zones.message : t.errors.zonesLoad}
            onRetry={onRetryZones}
          />
        );
      return (
        <CheckList
          id="candidature-zones"
          legend={t.zones.title}
          hint={t.zones.hint}
          error={errors.zones}
          options={zones.data.map((zone) => ({ value: zone.communeKey, label: zone.name }))}
          selected={draft.zoneKeys}
          onChange={(zoneKeys) => update({ zoneKeys })}
          disabled={disabled}
          footer={
            <p role="status" className="text-small text-ink-muted mt-3">
              {draft.zoneKeys.length ? t.zones.selected(draft.zoneKeys.length) : ''}
            </p>
          }
        />
      );
    case 'skills':
      if (skills.status === 'loading')
        return <SkeletonCards label={t.skills.loading} rows={2} media={false} />;
      if (skills.status === 'error') return <LoadError message={skills.message} onRetry={onRetrySkills} />;
      if (skills.status === 'unavailable')
        return (
          <BackendPending
            id="candidature-competences"
            title={t.skillsPending.title}
            headingAs="h3"
            needs={[
              {
                method: 'GET',
                path: '/api/v1/cleaning/catalog/skills (chemin à définir par le back)',
                purpose: t.skillsPending.purpose,
              },
            ]}
          >
            {t.skillsPending.text}
          </BackendPending>
        );
      return (
        <CheckList
          id="candidature-skills"
          legend={t.skills.title}
          hint={t.skills.hint}
          error={errors.skills}
          options={skills.data.map((skill) => ({ value: skill.code, label: skill.name }))}
          selected={draft.skillCodes}
          onChange={(skillCodes) => update({ skillCodes })}
          disabled={disabled}
        />
      );
    case 'availability':
      return (
        <div className="grid gap-4">
          <p id="candidature-weekly-aide" className="text-ink-muted">
            {t.availability.hint}
          </p>
          <WeeklyEditor
            id="candidature-weekly"
            value={draft.weekly}
            onChange={(weekly) => update({ weekly })}
            showErrors={!!errors.weekly}
            disabled={disabled}
          />
          {errors.weekly ? <FieldError id="candidature-weekly-erreur">{errors.weekly}</FieldError> : null}
        </div>
      );
    case 'emergency':
      return (
        <div className="grid gap-5">
          <p className="text-ink-muted">{t.emergency.hint}</p>
          <TextField
            id="candidature-emergencyName"
            label={t.emergency.name}
            value={draft.emergencyName}
            maxLength={100}
            disabled={disabled}
            error={errors.emergencyName}
            onChange={(event) => update({ emergencyName: event.target.value })}
          />
          <TextField
            id="candidature-emergencyPhone"
            label={t.emergency.phone}
            hint={t.emergency.phoneHint}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={draft.emergencyPhone}
            disabled={disabled}
            error={errors.emergencyPhone}
            onChange={(event) => update({ emergencyPhone: event.target.value })}
          />
        </div>
      );
    case 'employment':
      return (
        <Fieldset id="candidature-employment" legend={t.employment.legend} error={errors.employment}>
          <div className="grid gap-2">
            <ChoicePill
              name="candidature-employment"
              value="employee"
              label={t.employment.employee}
              hint={t.employment.employeeHint}
              checked={draft.employmentKind === 'employee'}
              disabled={disabled}
              onChange={() => update({ employmentKind: 'employee' })}
            />
            <ChoicePill
              name="candidature-employment"
              value="independent"
              label={t.employment.independent}
              hint={t.employment.independentHint}
              checked={draft.employmentKind === 'independent'}
              disabled={disabled}
              onChange={() => update({ employmentKind: 'independent' })}
            />
          </div>
        </Fieldset>
      );
    case 'mobileMoney':
      return (
        <TextField
          id="candidature-mobileMoney"
          label={t.mobileMoney.label}
          hint={t.mobileMoney.hint}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft.mobileMoney}
          disabled={disabled}
          error={errors.mobileMoney}
          onChange={(event) => update({ mobileMoney: event.target.value })}
        />
      );
    case 'summary':
      return null;
  }
}
