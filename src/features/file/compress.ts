/**
 * Compression d'une photo avant l'envoi (F-022 : 3G de terrain) : 1600 px sur le grand côté, JPEG de
 * qualité 0,75, par le `canvas` du navigateur, sans dépendance. Vise 500 Ko au plus. Sans `canvas` ni
 * `createImageBitmap` (navigateur ancien, tests), ou si le résultat n'est pas plus léger, la photo
 * d'origine est gardée : le service file vérifiera son type et son poids.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.75;
/** Déjà assez légère : envoyée telle quelle si elle est en JPEG et dans la taille. */
const LIGHT_ENOUGH = 500 * 1024;

function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= LIGHT_ENOUGH) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    // Une photo d'un format non accepté (HEIC) est gardée convertie, même un peu plus lourde.
    if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
