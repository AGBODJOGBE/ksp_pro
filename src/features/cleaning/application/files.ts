import type { FilePurpose } from '@/features/file';

/**
 * Finalité des fichiers de la candidature (photo de l'agent, recto et verso de sa pièce d'identité).
 *
 * Le service file n'a pas encore de finalité pour une pièce d'identité ni pour la photo d'un agent
 * (demande notée dans `ksp_back`, prérequis de l'Espace pro, ADR-058) : la candidature emprunte celle des
 * photos du Nettoyage, `cleaning_intervention_photo` (JPEG, PNG ou WebP, 8 Mo). **À valider** : à
 * remplacer ici seulement, quand le back aura sa finalité.
 */
export const APPLICATION_FILE_PURPOSE: FilePurpose = 'cleaning_intervention_photo';
