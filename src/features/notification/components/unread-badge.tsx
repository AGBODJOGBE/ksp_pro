'use client';

import { useEffect, useState } from 'react';
import { countUnread } from '@/features/notification/api';
import { notificationTexts } from '@/features/notification/texts';

/**
 * Pastille du nombre de notifications non lues, pour une entrée de navigation (`SpaceFrame`) : lue une
 * fois à l'affichage du cadre (pas de notification en direct). Rien quand tout est lu ou si la lecture
 * échoue. Le nombre est dit aux lecteurs d'écran après le libellé du lien.
 */
export function UnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    countUnread().then(
      (value) => {
        if (active) setCount(value);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span className="bg-danger absolute top-1.5 left-1/2 ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-xs leading-5 font-bold text-white tabular-nums sm:static sm:ml-0">
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{`, ${notificationTexts.bell.unread(count)}`}</span>
    </span>
  );
}
