import { ComingSoon } from '@/components/ui/coming-soon';
import { Heading } from '@/components/ui/heading';
import { recoveryTexts } from '@/features/recovery/texts';

/** Accueil provisoire de l'espace partenaire (huissiers, avocats) : ce qui arrive. */
export function PartnerHome() {
  const t = recoveryTexts.partnerHome;
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      <ComingSoon title={t.soonTitle} items={t.soonItems}>
        {t.soonText}
      </ComingSoon>
    </div>
  );
}
