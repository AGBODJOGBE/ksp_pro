'use client';

import { api, ApiError, parseResponse } from '@/lib/api';
import type { AgentProfile, PublicZone } from './schemas';

/**
 * Appels de la candidature d'un agent du Nettoyage : communes desservies (route publique), compétences
 * (route du back-office, lue seulement si la gateway l'accepte pour ce compte : prérequis back B4),
 * envoi de la candidature. Schémas chargés pendant l'appel (hors du premier chargement).
 */

const ZONES = '/api/v1/cleaning/catalog/zones';
const SKILLS = '/api/v1/admin/cleaning/skills';
const APPLICATIONS = '/api/v1/cleaning/agent/applications';

/** Compétence proposée au candidat. */
export interface SkillOption {
  code: string;
  name: string;
}

/** Communes desservies, par nom (`GET /cleaning/catalog/zones`, public). */
export async function listServedZones(signal?: AbortSignal): Promise<PublicZone[]> {
  const [{ publicZoneListSchema }, body] = await Promise.all([
    import('./schemas'),
    api.get(ZONES, { auth: false, signal }),
  ]);
  return parseResponse(publicZoneListSchema, body).data;
}

export type SkillsResult =
  | { status: 'ready'; skills: SkillOption[] }
  /** Aucune liste lisible par ce compte (B4) : l'écran le dit et l'envoi attend la route. */
  | { status: 'unavailable' };

/** Pages lues au plus : 100 compétences par page, bien au-delà du catalogue attendu. */
const MAX_PAGES = 5;

/**
 * Compétences actives, si la gateway accepte `GET /admin/cleaning/skills` pour ce compte. Un refus
 * (403, 401, route absente) donne `unavailable` ; une panne (réseau, 5xx, limite) remonte pour
 * « Réessayer ».
 */
export async function listApplicationSkills(signal?: AbortSignal): Promise<SkillsResult> {
  const { skillListSchema } = await import('./schemas');
  const skills: SkillOption[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = parseResponse(
        skillListSchema,
        await api.get(SKILLS, { query: { limit: 100, cursor }, signal }),
      );
      skills.push(...body.data.filter((skill) => skill.active).map(({ code, name }) => ({ code, name })));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
  } catch (error) {
    const refused =
      error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
    if (refused) return { status: 'unavailable' };
    throw error;
  }
  return { status: 'ready', skills };
}

/** Corps de `POST /cleaning/agent/applications` (`CleaningSubmitAgentApplicationBody`). */
export interface ApplicationBody {
  firstName: string;
  lastName: string;
  photoFileId: string;
  idDocumentFrontFileId: string;
  idDocumentBackFileId: string;
  residenceCommuneKey: string;
  zoneKeys: string[];
  skillCodes: string[];
  weekly: Array<{ weekday: string; ranges: Array<{ start: string; end: string }> }>;
  emergencyContact: { name: string; phone: string };
  employmentKind: 'employee' | 'independent';
  mobileMoneyNumber?: string;
  invitationId?: string;
}

/** Envoie la candidature (clé d'idempotence : un nouvel envoi du même contenu ne crée rien de plus). */
export async function submitApplication(
  body: ApplicationBody,
  idempotencyKey: string,
): Promise<AgentProfile> {
  const [{ agentProfileSchema }, response] = await Promise.all([
    import('./schemas'),
    api.post(APPLICATIONS, body, { idempotencyKey }),
  ]);
  return parseResponse(agentProfileSchema, response);
}
