'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/ui/field';
import { Panel, SummaryRow } from '@/components/ui/form-fields';
import { Heading } from '@/components/ui/heading';
import { IconUser } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { formatNumber, formatShortDate } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { getMyActivity } from '@/features/cleaning/agent-api';
import { AGENT_STATUS, agentTexts, EMPLOYMENT_KIND } from '@/features/cleaning/agent-texts';
import { listServedZones } from '@/features/cleaning/application-api';
import type { Activity, ActivityPeriod, AgentProfile, PublicZone } from '@/features/cleaning/schemas';
import { agentStatusView } from '@/features/cleaning/texts';
import { LoadFailure } from './states';
import { useAgentProfile, useLoad } from './use-load';

const t = agentTexts.profile;
const a = agentTexts.activity;

const loadZones = (signal: AbortSignal) => listServedZones(signal);

/** Heures avec une décimale au plus : « 12,5 h ». */
const hours = (value: number) =>
  `${new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 1 }).format(value)} h`;

const monthFormat = new Intl.DateTimeFormat('fr-BJ', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-card border-line bg-surface grid gap-1 border p-4">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="font-display text-ink text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Heures par période : un tableau (lisible par tous, sans couleur), avec une barre discrète de la même
 * teinte pour comparer les périodes d'un coup d'œil. Les valeurs sont écrites : la barre n'est qu'une aide.
 */
function PeriodTable({
  id,
  caption,
  periods,
  label,
}: {
  id: string;
  caption: string;
  periods: ReadonlyArray<ActivityPeriod>;
  label: (period: ActivityPeriod) => string;
}) {
  const max = Math.max(...periods.map((period) => period.hours), 0);
  return (
    <table aria-labelledby={id} className="w-full text-left">
      <caption id={id} className="font-display text-ink mb-2 text-left text-lg font-semibold">
        {caption}
      </caption>
      <thead>
        <tr className="text-small text-ink-muted border-line border-b">
          <th scope="col" className="py-2 pr-3 font-semibold">
            {a.period}
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">
            {a.hours}
          </th>
          <th scope="col" className="py-2 text-right font-semibold">
            {a.periodSessions}
          </th>
        </tr>
      </thead>
      <tbody>
        {periods.map((period) => (
          <tr key={period.periodStart} className="border-line border-b last:border-b-0">
            <th scope="row" className="text-ink py-2.5 pr-3 font-medium first-letter:uppercase">
              {label(period)}
              <span aria-hidden="true" className="bg-line mt-1.5 block h-1.5 w-full max-w-48 rounded-full">
                <span
                  className="bg-action block h-full rounded-full"
                  style={{
                    width: max > 0 ? `${Math.max((period.hours / max) * 100, period.hours > 0 ? 4 : 0)}%` : 0,
                  }}
                />
              </span>
            </th>
            <td className="text-ink py-2.5 pr-3 text-right font-semibold tabular-nums">
              {hours(period.hours)}
            </td>
            <td className="text-ink-muted py-2.5 text-right tabular-nums">
              {formatNumber(period.sessionsCompleted)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivitySection() {
  const { state, reload } = useLoad<Activity>(getMyActivity);
  let body: ReactNode;
  if (state.status === 'loading') body = <SkeletonCards label={a.loading} rows={2} media={false} />;
  else if (state.status === 'error' || state.status === 'pending')
    body = (
      <LoadFailure
        message={state.status === 'error' ? state.message : agentTexts.genericError}
        correlationId={state.status === 'error' ? state.correlationId : undefined}
        onRetry={reload}
      />
    );
  else {
    const { stats, weeks, months } = state.data;
    body = (
      <div className="grid gap-8">
        <dl className="grid grid-cols-2 gap-3">
          <Figure label={a.hoursWeek} value={hours(stats.hoursThisWeek)} />
          <Figure label={a.hoursMonth} value={hours(stats.hoursThisMonth)} />
          <Figure label={a.sessions} value={formatNumber(stats.sessionsCompleted)} />
          <Figure label={a.visits} value={formatNumber(stats.visitsCompleted)} />
          <Figure
            label={a.rating}
            value={
              stats.ratingAverage === null ? (
                <span className="text-ink-muted text-base font-medium">{a.noRating}</span>
              ) : (
                <>
                  {a.ratingValue(
                    new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 1 }).format(stats.ratingAverage),
                  )}
                  <span className="text-small text-ink-muted block font-sans font-medium">
                    {a.ratingCount(stats.ratingsCount)}
                  </span>
                </>
              )
            }
          />
          <Figure label={a.claims} value={formatNumber(stats.openClaims)} />
        </dl>
        {weeks.length ? (
          <PeriodTable
            id="activite-semaines"
            caption={a.weeks}
            periods={weeks}
            label={(period) => a.week(formatShortDate(`${period.periodStart}T12:00:00Z`))}
          />
        ) : null}
        {months.length ? (
          <PeriodTable
            id="activite-mois"
            caption={a.months}
            periods={months}
            label={(period) => monthFormat.format(new Date(`${period.periodStart}T12:00:00Z`))}
          />
        ) : null}
        {!weeks.length && !months.length ? <p className="text-ink-muted">{a.empty}</p> : null}
      </div>
    );
  }
  return (
    <Panel id="activite" title={a.title}>
      <p className="text-small text-ink-muted -mt-2 mb-5">{a.lead}</p>
      {body}
    </Panel>
  );
}

function ProfileDetails({ profile, zones }: { profile: AgentProfile; zones: ReadonlyArray<PublicZone> }) {
  const candidate = agentStatusView(profile.status);
  const view = AGENT_STATUS[profile.status] ?? candidate;
  const zoneName = (key: string) => zones.find((zone) => zone.communeKey === key)?.name ?? key;
  return (
    <Panel id="profil" title={`${profile.firstName} ${profile.lastName}`}>
      <div className="mb-4 flex items-center gap-4">
        {profile.photoUrl ? (
          // Lien temporaire du stockage : affiché tel quel, sans optimisation du serveur.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoUrl}
            alt={t.photoAlt}
            className="rounded-card border-line size-20 shrink-0 border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="rounded-card bg-brand text-on-brand grid size-20 shrink-0 place-items-center"
          >
            <IconUser className="size-9" />
          </span>
        )}
        <Badge tone={view.tone} dot>
          {view.label}
        </Badge>
      </div>
      <dl>
        <SummaryRow label={t.phone}>{formatPhone(profile.phone)}</SummaryRow>
        <SummaryRow label={t.employment}>
          {EMPLOYMENT_KIND[profile.employmentKind] ?? profile.employmentKind}
        </SummaryRow>
        <SummaryRow label={t.residence}>{zoneName(profile.residenceCommuneKey)}</SummaryRow>
        <SummaryRow label={t.zones}>{profile.zoneKeys.map(zoneName).join(', ') || t.none}</SummaryRow>
        <SummaryRow label={t.emergency}>
          {profile.emergencyContact.name}, {formatPhone(profile.emergencyContact.phone)}
        </SummaryRow>
        <SummaryRow label={t.mobileMoney}>
          {profile.mobileMoneyNumber ? formatPhone(profile.mobileMoneyNumber) : t.none}
        </SummaryRow>
        <SummaryRow label={t.load}>{t.loadValue(profile.maxHoursPerDay, profile.maxHoursPerWeek)}</SummaryRow>
      </dl>
      <h3 className="text-ink mt-6 mb-3 font-semibold">{t.skills}</h3>
      {profile.skills.length ? (
        <ul className="flex flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <li key={skill.code}>
              <Badge tone={skill.validated ? 'action' : 'neutral'} className="min-h-8 px-3 text-sm">
                {skill.name}
                <span className="sr-only"> ({skill.validated ? t.skillValidated : t.skillPending})</span>
                {skill.validated ? null : (
                  <span aria-hidden="true" className="font-medium">
                    · {t.skillPending}
                  </span>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{t.noSkills}</p>
      )}
    </Panel>
  );
}

/**
 * « Profil » : le profil d'agent en lecture (`GET /cleaning/agent/me` : statut, compétences validées,
 * zones), puis l'activité (`GET /me/activity`, heures et séances, sans montants). Aucune route ne permet
 * à l'agent de modifier son profil : l'écran le dit.
 */
export function AgentProfileScreen({ aside }: { aside?: ReactNode }) {
  const profile = useAgentProfile();
  const zones = useLoad<PublicZone[]>(loadZones);
  let body: ReactNode;
  if (profile.state.status === 'loading') body = <SkeletonCards label={t.loading} rows={2} />;
  else if (profile.state.status !== 'ready' || !profile.state.data)
    body = (
      <LoadFailure
        message={profile.state.status === 'error' ? profile.state.message : agentTexts.genericError}
        correlationId={profile.state.status === 'error' ? profile.state.correlationId : undefined}
        onRetry={profile.reload}
      />
    );
  else
    body = (
      <ProfileDetails
        profile={profile.state.data}
        zones={zones.state.status === 'ready' ? zones.state.data : []}
      />
    );

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        {aside}
      </div>
      <FormMessage tone="info">{t.readOnly}</FormMessage>
      {body}
      <ActivitySection />
    </div>
  );
}
