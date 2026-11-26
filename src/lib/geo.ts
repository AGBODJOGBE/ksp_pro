/**
 * Position du téléphone (arrivée sur le lieu d'une visite ou d'une séance) et lien d'itinéraire. Sans
 * dépendance. La position n'est demandée qu'au geste de l'agent ; refusée ou indisponible, l'arrivée part
 * sans position (le contrat le permet).
 */

export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Précision annoncée par le téléphone, en mètres entiers (0 à 100 000, contrat). */
  accuracyMeters: number;
}

export type PositionFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export type PositionResult = { ok: true; position: DevicePosition } | { ok: false; failure: PositionFailure };

const MAX_ACCURACY = 100_000;

/** Position actuelle, précise (GPS) ; jamais une position gardée de plus d'une minute. */
export function currentPosition(timeoutMs = 15_000): Promise<PositionResult> {
  return new Promise((resolve) => {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    if (!geolocation) return resolve({ ok: false, failure: 'unsupported' });
    geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          ok: true,
          position: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: Math.min(MAX_ACCURACY, Math.max(0, Math.round(coords.accuracy || 0))),
          },
        }),
      (error) =>
        resolve({
          ok: false,
          failure: error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/**
 * Itinéraire jusqu'au lieu dans l'application de cartes du téléphone (adresse universelle de Google Maps :
 * ouvre l'application quand elle est installée, le site sinon). À valider : fournisseur de cartes.
 */
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
