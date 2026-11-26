import type { ReactNode } from 'react';
import { BackendPending } from '@/components/ui/backend-pending';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Panel, SummaryRow } from '@/components/ui/form-fields';
import { formatShortDate } from '@/lib/format';
import { formatMoney } from '@/features/recovery/money';
import { formatPhone } from '@/lib/phone';
import type {
  AssignmentFile,
  CaseAmounts,
  CaseDocument,
  Claim,
  Debtor,
  FormalNotice,
  LegalAct,
  PaymentPlan,
} from '@/features/recovery/schemas';
import {
  ACT_TYPE_LABELS,
  ACTOR_TYPE,
  DEBTOR_KIND,
  DEBTOR_ROLE,
  DELIVERY_METHOD,
  DOCUMENT_KIND,
  INSTALLMENT_STATUS,
  labelOf,
  NOTICE_STATUS,
  PARTY_TYPE,
  PLAN_RHYTHM,
  PLAN_STATUS,
  recoveryTexts,
} from '@/features/recovery/texts';
import { formatDay } from './assignment-card';
import { DocumentGlyph, MailGlyph, PhoneGlyph } from './icons';

const t = recoveryTexts.file;

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted">{children}</p>;
}

/** Montants du dossier : le reste dû en tête, puis le détail. */
export function AmountsSection({ amounts, action }: { amounts: CaseAmounts; action?: ReactNode }) {
  return (
    <Panel id="montants-titre" title={t.amounts}>
      <p className="text-small text-ink-muted">{t.due}</p>
      <p className="font-display text-ink text-3xl font-bold tabular-nums">{formatMoney(amounts.due)}</p>
      <dl className="mt-4">
        <SummaryRow label={t.principal}>{formatMoney(amounts.principal)}</SummaryRow>
        <SummaryRow label={t.interests}>{formatMoney(amounts.interests)}</SummaryRow>
        <SummaryRow label={t.costs}>{formatMoney(amounts.costs)}</SummaryRow>
        <SummaryRow label={t.paid}>{formatMoney(amounts.paid)}</SummaryRow>
        <SummaryRow label={t.waived}>{formatMoney(amounts.waived)}</SummaryRow>
        <SummaryRow label={t.overpaid}>{formatMoney(amounts.overpaid)}</SummaryRow>
      </dl>
      {action ? <div className="mt-4">{action}</div> : null}
    </Panel>
  );
}

const CONTACT = 'w-full justify-start sm:w-auto';

function DebtorCard({ debtor }: { debtor: Debtor }) {
  const company = debtor.kind === 'company';
  return (
    <li className="rounded-card border-line grid gap-3 border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-ink text-lg font-semibold">{debtor.displayName}</h3>
        <Badge tone={debtor.role === 'main' ? 'brand' : 'neutral'}>{labelOf(DEBTOR_ROLE, debtor.role)}</Badge>
        <span className="text-small text-ink-muted">{labelOf(DEBTOR_KIND, debtor.kind)}</span>
      </div>
      {company && (debtor.representativeName || debtor.ifu || debtor.rccm) ? (
        <dl className="grid gap-1 sm:grid-cols-3">
          {debtor.representativeName ? (
            <div>
              <dt className="text-small text-ink-muted">{t.representative}</dt>
              <dd className="text-ink">{debtor.representativeName}</dd>
            </div>
          ) : null}
          {debtor.ifu ? (
            <div>
              <dt className="text-small text-ink-muted">{t.ifu}</dt>
              <dd className="text-ink tabular-nums">{debtor.ifu}</dd>
            </div>
          ) : null}
          {debtor.rccm ? (
            <div>
              <dt className="text-small text-ink-muted">{t.rccm}</dt>
              <dd className="text-ink">{debtor.rccm}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {debtor.phones.length || debtor.emails.length ? (
        <ul className="grid gap-2 sm:flex sm:flex-wrap">
          {debtor.phones.map((phone) => (
            <li key={phone}>
              <a
                href={`tel:${phone}`}
                aria-label={t.callLabel(debtor.displayName, formatPhone(phone))}
                className={buttonClasses({ variant: 'secondary', className: CONTACT })}
              >
                <PhoneGlyph className="size-5" />
                <span className="font-sans">{t.call}</span>
                <span className="text-ink-muted font-sans font-normal tabular-nums">
                  {formatPhone(phone)}
                </span>
              </a>
            </li>
          ))}
          {debtor.emails.map((email) => (
            <li key={email} className="min-w-0">
              <a
                href={`mailto:${email}`}
                aria-label={t.writeLabel(debtor.displayName, email)}
                className={buttonClasses({ variant: 'secondary', className: `${CONTACT} max-w-full` })}
              >
                <MailGlyph className="size-5 shrink-0" />
                <span className="font-sans">{t.write}</span>
                <span className="text-ink-muted min-w-0 truncate font-sans font-normal">{email}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{t.noContact}</p>
      )}
      {debtor.address || debtor.communeKey ? (
        <dl className="grid gap-1 sm:grid-cols-[2fr_1fr]">
          {debtor.address ? (
            <div>
              <dt className="text-small text-ink-muted">{t.address}</dt>
              <dd className="text-ink">{debtor.address}</dd>
            </div>
          ) : null}
          {debtor.communeKey ? (
            <div>
              <dt className="text-small text-ink-muted">{t.commune}</dt>
              <dd className="text-ink">{debtor.communeKey}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

/** Débiteurs (principal en tête, codébiteurs, cautions) : appeler, écrire, adresse. */
export function DebtorsSection({ debtors }: { debtors: ReadonlyArray<Debtor> }) {
  const sorted = [...debtors].sort((a, b) => Number(b.role === 'main') - Number(a.role === 'main'));
  return (
    <Panel id="debiteurs-titre" title={t.debtors}>
      <ul className="grid gap-3">
        {sorted.map((debtor) => (
          <DebtorCard key={debtor.id} debtor={debtor} />
        ))}
      </ul>
    </Panel>
  );
}

export function ClaimsSection({ claims }: { claims: ReadonlyArray<Claim> }) {
  return (
    <Panel id="creances-titre" title={t.claims}>
      {claims.length ? (
        <ul className="divide-line grid divide-y">
          {claims.map((claim) => (
            <li key={claim.id} className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-ink font-semibold">{claim.reference}</span>
                <span className="text-ink font-semibold tabular-nums">{formatMoney(claim.amount)}</span>
              </div>
              <span className="text-small text-ink-muted">{t.claimDue(formatDay(claim.dueDate))}</span>
              {claim.description ? <span className="text-ink">{claim.description}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{t.noClaims}</Empty>
      )}
    </Panel>
  );
}

export function CreditorSection({ creditor }: { creditor: AssignmentFile['creditor'] }) {
  return (
    <Panel id="creancier-titre" title={t.creditor}>
      <p className="text-ink text-lg font-semibold">{creditor.displayName}</p>
      <p className="text-small text-ink-muted">{labelOf(PARTY_TYPE, creditor.type)}</p>
    </Panel>
  );
}

export function PlanSection({ plan }: { plan: PaymentPlan | null }) {
  return (
    <Panel id="echeancier-titre" title={t.plan}>
      {plan ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{labelOf(PLAN_STATUS, plan.status)}</Badge>
            {plan.signedAt ? (
              <span className="text-small text-ink-muted">
                {t.planSigned(formatShortDate(plan.signedAt))}
              </span>
            ) : null}
          </div>
          <p className="text-ink">
            {t.planTerms(
              formatMoney(plan.terms.firstAmount),
              formatDay(plan.terms.firstDueDate),
              plan.terms.installmentsCount,
              labelOf(PLAN_RHYTHM, plan.terms.rhythm),
            )}
          </p>
          <dl>
            <SummaryRow label={t.planTotal} strong>
              {formatMoney(plan.total)}
            </SummaryRow>
          </dl>
          <p className={plan.missedCount ? 'text-danger font-semibold' : 'text-ink-muted'}>
            {t.planMissed(plan.missedCount)}
          </p>
          {plan.installments.length ? (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[30rem] text-left">
                <caption className="sr-only">{t.installmentsCaption}</caption>
                <thead className="text-small text-ink-muted">
                  <tr className="border-line border-b">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t.installmentRank}
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t.installmentDate}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      {t.installmentAmount}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      {t.installmentPaid}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      {t.installmentStatus}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.installments.map((installment) => {
                    const status = INSTALLMENT_STATUS[installment.status] ?? {
                      label: installment.status,
                      tone: 'neutral' as const,
                    };
                    return (
                      <tr
                        key={installment.id ?? installment.rank}
                        className="border-line border-b last:border-b-0"
                      >
                        <td className="py-2 pr-3 tabular-nums">{installment.rank}</td>
                        <td className="py-2 pr-3">{formatDay(installment.dueDate)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMoney(installment.amount)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMoney(installment.paidAmount)}
                        </td>
                        <td className="py-2">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty>{t.noPlan}</Empty>
      )}
    </Panel>
  );
}

export function NoticesSection({ notices }: { notices: ReadonlyArray<FormalNotice> }) {
  return (
    <Panel id="mises-en-demeure-titre" title={t.notices}>
      {notices.length ? (
        <ul className="grid gap-3">
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-card border-line grid gap-1 border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={notice.status === 'delivered' ? 'success' : 'warning'}>
                  {labelOf(NOTICE_STATUS, notice.status)}
                </Badge>
                <span className="text-ink font-semibold">
                  {t.noticeIssued(formatShortDate(notice.issuedAt))}
                </span>
              </div>
              {notice.signedBy.displayName ? (
                <p className="text-small text-ink-muted">{t.noticeSignedBy(notice.signedBy.displayName)}</p>
              ) : null}
              {notice.deliveryMethod ? (
                <p className="text-ink">
                  {t.noticeDelivery} : {labelOf(DELIVERY_METHOD, notice.deliveryMethod)}
                  {notice.deliveredAt ? ` · ${t.noticeDelivered(formatShortDate(notice.deliveredAt))}` : null}
                </p>
              ) : null}
              {notice.deadlineAt ? (
                <p className="text-ink font-medium">{t.noticeDeadline(formatShortDate(notice.deadlineAt))}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{t.noNotices}</Empty>
      )}
    </Panel>
  );
}

/** Route attendue du back pour lire une pièce de la mission (prérequis B7, proposée). */
const DOCUMENT_NEED = {
  method: 'GET',
  path: '/api/v1/recovery/partner/assignments/{id}/documents/{documentId}/download-url',
  purpose: t.documentsNeed,
} as const;

/**
 * Pièces de la mission : listées, **non lisibles** (aucune route de lecture pour le partenaire, B7). La
 * route attendue est montrée hors production seulement (`BackendPending`).
 */
export function DocumentsSection({ documents }: { documents: ReadonlyArray<CaseDocument> }) {
  return (
    <Panel id="pieces-titre" title={t.documents}>
      {documents.length ? (
        <ul className="divide-line grid divide-y">
          {documents.map((document) => (
            <li key={document.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <DocumentGlyph className="text-ink-subtle mt-0.5 size-5 shrink-0" />
              <div className="grid min-w-0 gap-0.5">
                <span className="text-ink font-medium break-words">{document.label}</span>
                <span className="text-small text-ink-muted">
                  {labelOf(DOCUMENT_KIND, document.kind)} ·{' '}
                  {t.documentAdded(
                    formatShortDate(document.addedAt),
                    document.addedBy.displayName ?? labelOf(ACTOR_TYPE, document.addedBy.type),
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{t.noDocuments}</Empty>
      )}
      {documents.length ? (
        <BackendPending
          id="pieces-lecture"
          title={t.documentsLocked}
          headingAs="h3"
          needs={[DOCUMENT_NEED]}
          className="mt-4 shadow-none"
        >
          {t.documentsLockedText}
        </BackendPending>
      ) : null}
    </Panel>
  );
}

/** Historique des actes, du plus récent au plus ancien. */
export function ActsSection({ acts }: { acts: ReadonlyArray<LegalAct> }) {
  const sorted = [...acts].sort((a, b) =>
    a.actDate === b.actDate ? b.recordedAt.localeCompare(a.recordedAt) : b.actDate.localeCompare(a.actDate),
  );
  return (
    <Panel id="actes-titre" title={t.history}>
      {sorted.length ? (
        <ol className="border-line grid gap-4 border-l-2 pl-4">
          {sorted.map((act) => (
            <li key={act.id} className="relative grid gap-0.5">
              <span
                aria-hidden="true"
                className="bg-brand absolute top-1.5 -left-[1.4rem] size-3 rounded-full ring-4 ring-white"
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-ink font-semibold">{labelOf(ACT_TYPE_LABELS, act.type)}</span>
                <span className="text-ink tabular-nums">{formatDay(act.actDate)}</span>
              </div>
              <span className="text-small text-ink-muted">
                {act.cost.amount > 0 ? t.actCost(formatMoney(act.cost)) : t.actNoCost}
                {act.fileId ? ` · ${t.actWithFile}` : null}
              </span>
              {act.nextStepDate ? (
                <span className="text-ink font-medium">{t.actNext(formatDay(act.nextStepDate))}</span>
              ) : null}
              {act.note ? <p className="text-ink whitespace-pre-line">{act.note}</p> : null}
              <span className="text-small text-ink-subtle">
                {t.actRecorded(formatShortDate(act.recordedAt))}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{t.noActs}</Empty>
      )}
    </Panel>
  );
}
