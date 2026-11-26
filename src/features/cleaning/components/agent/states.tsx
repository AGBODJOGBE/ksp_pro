import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { agentTexts } from '@/features/cleaning/agent-texts';

/** Lecture impossible : le message de la gateway (et sa référence pour le support), puis « Réessayer ». */
export function LoadFailure({
  message,
  correlationId,
  onRetry,
}: {
  message: string;
  correlationId?: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>{correlationId ? `${message} (référence : ${correlationId})` : message}</FormMessage>
      <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={onRetry}>
        {agentTexts.retry}
      </Button>
    </div>
  );
}
