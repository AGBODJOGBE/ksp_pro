/** Compte KSP (service identity), réduit à l'Espace pro : connexion, profil, garde, accès, déconnexion. */
export { RefreshAccessButton } from './components/refresh-access';
export { RequireSession } from './components/require-session';
// Écrans client chargés à la demande (voir components/lazy.tsx).
export { AccountMenu, LoginFlow } from './components/lazy';
export { loginHref } from './return-path';
