import { Skeleton } from '@/components/ui/skeleton';

/** Chargement d'une fiche : titre, lieu et trois étapes, sans décalage à l'arrivée du contenu. */
export function SheetSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="rounded-card h-28 w-full" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="rounded-card h-20 w-full" />
      ))}
    </div>
  );
}
