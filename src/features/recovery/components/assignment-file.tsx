'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconArrowLeft, IconRefresh } from '@/components/ui/icons';
import { SkeletonCards } from '@/components/ui/skeleton';
import { partnerFileHref, partnerNavigation } from '@/config/partner-navigation';
import { cn } from '@/lib/cn';
import { formatShortDate, formatTime } from '@/lib/format';
import { formatMoney } from '@/features/recovery/money';
import { withReference } from '@/features/recovery/errors';
import type { AssignmentFile, LegalAct, OfflinePayment } from '@/features/recovery/schemas';
import { ASSIGNMENT_STATUS, COLLECTION_STATUS, recoveryTexts } from '@/features/recovery/texts';
import { AccessDenied } from './access-denied';
import { ActForm } from './act-form';
import { formatDay } from './assignment-card';
import { CollectionForm } from './collection-form';
import {
  ActsSection,
  AmountsSection,
  ClaimsSection,
  CreditorSection,
  DebtorsSection,
  DocumentsSection,
  NoticesSection,
  PlanSection,
} from './file-sections';
import { Notice } from './form-parts';
import { useAssignmentFile } from './use-assignment-file';

const t = recoveryTexts.file;
type Action = 'acte' | 'encaissement';

/** Retour à « Mes dossiers », en haut de la fiche. */
function BackToList() {
  return (
    <Link
      href={partnerNavigation.assignments.href}
      className="text-ink-muted hover:text-ink focus-visible:outline-focus -ml-1 inline-flex min-h-12 items-center gap-2 self-start justify-self-start rounded-full px-1 font-semibold focus-visible:outline-2"
    >
      <IconArrowLeft className="size-5" />
      {t.back}
    </Link>
  );
}

/** Encaissement déclaré pendant cette visite : statut et rappel du virement, bien visibles. */
function DeclaredCollection({ payment }: { payment: OfflinePayment }) {
  const status = COLLECTION_STATUS[payment.status] ?? { label: payment.status, tone: 'neutral' as const };
  return (
    <section
      aria-labelledby={`encaissement-${payment.id}`}
      className="rounded-panel border-line bg-surface grid gap-3 border p-5 shadow-xs sm:p-7"
    >
      <h2 id={`encaissement-${payment.id}`} className="font-display text-h3 text-ink font-semibold">
        {recoveryTexts.collection.doneTitle}
      </h2>
      <p className="text-ink text-lg">
        {recoveryTexts.collection.doneText(formatMoney(payment.amount), formatDay(payment.receivedOn))}
      </p>
      <Badge tone={status.tone} dot className="justify-self-start">
        {status.label}
      </Badge>
      <Notice title={recoveryTexts.collection.reminderTitle}>{recoveryTexts.collection.reminderText}</Notice>
    </section>
  );
}

function FileView({
  file,
  acts,
  payments,
  readAt,
  flash,
  refreshing,
  refreshError,
  onRefresh,
  onOpen,
}: {
  file: AssignmentFile;
  acts: ReadonlyArray<LegalAct>;
  payments: ReadonlyArray<OfflinePayment>;
  readAt: number;
  flash: string | null;
  refreshing: boolean;
  refreshError: { message: string; correlationId?: string } | null;
  onRefresh: () => void;
  onOpen: (action: Action) => void;
}) {
  const { assignment } = file;
  const status = ASSIGNMENT_STATUS[assignment.status] ?? {
    label: assignment.status,
    tone: 'neutral' as const,
  };
  const action = 'min-h-14 px-3 text-center leading-tight whitespace-normal!';
  return (
    <div className="grid gap-6">
      <BackToList />
      <header className="grid gap-3">
        <Heading as="h1" size="h2">
          {t.title(assignment.caseNumber)}
        </Heading>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <span className="text-small text-ink-muted">
            {t.assignedOn(formatShortDate(assignment.assignedAt))}
          </span>
          <span className="text-small text-ink-subtle">
            {t.refreshed(formatTime(new Date(readAt).toISOString()))}
          </span>
        </div>
        <p className="text-small text-ink-muted">{t.audit}</p>
        {/* Ordinateur : les deux actions en tête de la fiche ; téléphone : dans la barre du bas. */}
        <div className="flex flex-wrap gap-2">
          <Button variant="action" className="max-sm:hidden" onClick={() => onOpen('acte')}>
            {t.recordAct}
          </Button>
          <Button variant="secondary" className="max-sm:hidden" onClick={() => onOpen('encaissement')}>
            {t.declareCollection}
          </Button>
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
            className="max-sm:-ml-3"
          >
            <IconRefresh className={cn('size-5', refreshing && 'motion-safe:animate-spin')} />
            {refreshing ? t.refreshing : t.refresh}
          </Button>
        </div>
      </header>
      <FormMessage>
        {refreshError ? withReference(refreshError.message, refreshError.correlationId) : null}
      </FormMessage>
      <FormMessage tone="success">{flash}</FormMessage>
      {payments.map((payment) => (
        <DeclaredCollection key={payment.id} payment={payment} />
      ))}
      <AmountsSection amounts={file.amounts} />
      <DebtorsSection debtors={file.debtors} />
      <ClaimsSection claims={file.claims} />
      <CreditorSection creditor={file.creditor} />
      <PlanSection plan={file.signedPlan} />
      <NoticesSection notices={file.notices} />
      <DocumentsSection documents={file.documents} />
      <ActsSection acts={acts} />
      <BottomBar className="grid-cols-2 sm:hidden">
        <Button variant="action" className={action} onClick={() => onOpen('acte')}>
          {t.recordAct}
        </Button>
        <Button variant="secondary" className={action} onClick={() => onOpen('encaissement')}>
          {t.declareCollection}
        </Button>
      </BottomBar>
    </div>
  );
}

/** Actes de la fiche et actes enregistrés depuis son ouverture (sans doublon : un rejeu rend le même acte). */
function mergeActs(read: ReadonlyArray<LegalAct>, recorded: ReadonlyArray<LegalAct>): LegalAct[] {
  const known = new Set(read.map((act) => act.id));
  return [...read, ...recorded.filter((act) => !known.has(act.id))];
}

function FileScreen({ id, action }: { id: string; action: Action | null }) {
  const { state, reload, refreshing, refreshError, settle } = useAssignmentFile(id);
  const [recorded, setRecorded] = useState<LegalAct[]>([]);
  const [payments, setPayments] = useState<OfflinePayment[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  /** Le formulaire ouvert a ajouté une entrée à l'historique du navigateur (retour = fermer). */
  const pushed = useRef(false);

  /*
   * Formulaires dans la même page (`&action=`) : l'adresse change par l'API History du navigateur, sans
   * navigation de Next ; la fiche déjà lue reste en mémoire, aucune nouvelle lecture (tracée) n'est faite.
   * Le bouton « retour » du téléphone ferme le formulaire.
   */
  function open(next: Action) {
    setFlash(null);
    window.history.pushState(null, '', `${partnerFileHref(id)}&action=${next}`);
    pushed.current = true;
    window.scrollTo({ top: 0 });
  }

  function close() {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, '', partnerFileHref(id));
  }

  if (state.status === 'loading')
    return (
      <div className="grid gap-4">
        <BackToList />
        <SkeletonCards label={t.loading} rows={3} media={false} />
      </div>
    );
  if (state.status === 'forbidden')
    return (
      <div className="grid gap-4">
        <BackToList />
        <AccessDenied onRetry={reload} />
      </div>
    );
  if (state.status === 'gone')
    return (
      <section aria-labelledby="dossier-retire" className="grid gap-4">
        <BackToList />
        <Heading as="h1" size="h2" id="dossier-retire">
          {t.goneTitle}
        </Heading>
        <p className="text-ink-muted text-lg">{t.goneText}</p>
        <ButtonLink
          href={partnerNavigation.assignments.href}
          variant="primary"
          className="sm:justify-self-start"
        >
          {t.backToList}
        </ButtonLink>
      </section>
    );
  if (state.status === 'error')
    return (
      <div className="grid gap-4">
        <BackToList />
        <Heading as="h1" size="h2">
          {t.fallbackTitle}
        </Heading>
        <FormMessage>
          {withReference(state.message || recoveryTexts.genericError, state.correlationId)}
        </FormMessage>
        <Button
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={reload}
        >
          {recoveryTexts.retry}
        </Button>
      </div>
    );

  const { file } = state;
  const caseNumber = file.assignment.caseNumber;
  if (action === 'acte')
    return (
      <ActForm
        assignmentId={id}
        caseNumber={caseNumber}
        onCancel={close}
        onSettle={settle}
        onRecorded={(act) => {
          setRecorded((previous) => [...previous.filter((item) => item.id !== act.id), act]);
          setFlash(t.actRecordedMessage);
          close();
        }}
      />
    );
  if (action === 'encaissement')
    return (
      <CollectionForm
        assignmentId={id}
        caseNumber={caseNumber}
        due={file.amounts.due.amount}
        onCancel={close}
        onSettle={settle}
        onDeclared={(payment) => {
          setPayments((previous) => [payment, ...previous.filter((item) => item.id !== payment.id)]);
          close();
        }}
      />
    );
  return (
    <FileView
      file={file}
      acts={mergeActs(file.assignment.acts, recorded)}
      payments={payments}
      readAt={state.readAt}
      flash={flash}
      refreshing={refreshing}
      refreshError={refreshError}
      onRefresh={() => {
        setFlash(null);
        reload();
      }}
      onOpen={open}
    />
  );
}

/**
 * Fiche d'un dossier confié (`/partenaire/dossier?id=`) : montants, débiteurs (appeler, écrire), créances,
 * créancier, échéancier signé, mises en demeure, pièces (listées, non lisibles : B7), historique des actes ;
 * « Enregistrer un acte » et « Déclarer un encaissement » en bas. **Chaque ouverture est inscrite au journal
 * d'audit du back** : une seule lecture par ouverture, « Actualiser » pour relire.
 */
export function AssignmentFileScreen() {
  const params = useSearchParams();
  const id = params.get('id');
  const action = params.get('action');
  if (!id)
    return (
      <div className="grid gap-4">
        <BackToList />
        <p className="text-ink-muted">{t.missing}</p>
      </div>
    );
  return (
    <FileScreen key={id} id={id} action={action === 'acte' || action === 'encaissement' ? action : null} />
  );
}
