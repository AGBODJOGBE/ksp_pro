/** Fichiers déposés par le compte (service file, ADR-038) : photos du Nettoyage, pièces de la candidature. */
export { PHOTO_MAX_BYTES, PHOTO_TYPES, uploadFile, type FilePurpose } from './api';
export { compressPhoto } from './compress';
// Composant client chargé à la demande (voir components/lazy.tsx).
export { PhotoField } from './components/lazy';
export type { PhotoFieldTexts, PhotoValue } from './components/photo-field';
export type { StoredFile } from './schemas';
