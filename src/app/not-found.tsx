import { BottomBar } from '@/components/ui/bottom-bar';
import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { getDictionary } from '@/i18n';

/** Page introuvable : message court et retour aux espaces. */
export default function NotFound() {
  const t = getDictionary();
  return (
    <section className="grid justify-items-start gap-4">
      <p aria-hidden="true" className="font-display text-accent-ink text-7xl leading-none font-bold">
        404
      </p>
      <Heading as="h1" size="h2">
        {t.errors.notFoundTitle}
      </Heading>
      <p className="text-ink-muted text-lg">{t.errors.notFoundText}</p>
      <BottomBar>
        <ButtonLink href="/" variant="action" size="lg" className="w-full sm:w-auto">
          {t.common.backToSpaces}
        </ButtonLink>
      </BottomBar>
    </section>
  );
}
