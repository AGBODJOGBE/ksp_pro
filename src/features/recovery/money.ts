/*
 * Montants du Recouvrement : entiers de francs CFA (XOF), jamais de décimales ni de division par 100.
 * Même format que `formatXof` de `lib/format`, gardé ici : `lib/format` est recopié dans plusieurs fichiers
 * des écrans de l'agent, et chaque fonction qu'on y utilise en plus les alourdit (fiches de terrain à moins
 * de 1 Ko du budget).
 */
const currency = new Intl.NumberFormat('fr-BJ', {
  style: 'currency',
  currency: 'XOF',
  maximumFractionDigits: 0,
});

/** `325 000 F CFA` (espaces insécables). */
export function formatMoney(value: { amount: number } | number): string {
  return currency.format(typeof value === 'number' ? value : value.amount);
}
