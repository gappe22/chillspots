export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const invalid = (message, field) => { throw new ApiError(400, 'VALIDATION_ERROR', message, field); };
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const assetKeys = new Set(['mountain', 'signpost', 'hiker', 'profile', 'scobe', 'mark']);
export const MAX_IMAGE_BYTES = 1024 * 1024;

function text(value, field, min, max) {
  if (typeof value !== 'string') invalid(`${field} deve essere un testo.`, field);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) invalid(`${field} deve contenere da ${min} a ${max} caratteri.`, field);
  return normalized;
}

function number(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(`${field} deve essere un numero tra ${min} e ${max}.`, field);
  return value;
}

export function validateRatings(value) {
  if (!isObject(value)) invalid('Inserisci tutte e tre le valutazioni.', 'ratings');
  return Object.fromEntries(['beauty', 'privacy', 'accessibility'].map(key => [key, number(value[key], `ratings.${key}`, 1, 5)]));
}

export function photo(value, index) {
  const field = `photos.${index}`;
  if (typeof value !== 'string') invalid('Formato della foto non valido.', field);
  if (assetKeys.has(value)) return value;
  if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 40) invalid('Ogni foto può occupare al massimo 1 MB.', field);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) invalid('Usa una foto JPEG, PNG o WebP.', field);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) invalid('Formato della foto non valido.', field);
  const valid = match[1] === 'jpeg' ? bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : match[1] === 'png' ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) invalid('Il contenuto non corrisponde al formato della foto.', field);
  return value;
}

export function validateSpot(body) {
  if (!isObject(body)) invalid('Invia un oggetto JSON.', 'body');
  const rawPhotos = body.photos === undefined ? [] : body.photos;
  if (!Array.isArray(rawPhotos) || rawPhotos.length > 3) invalid('Scegli fino a 3 foto.', 'photos');
  const latitude = number(body.latitude, 'latitude', -90, 90);
  const longitude = number(body.longitude, 'longitude', -180, 180);
  const rawLocality = typeof body.locality === 'string' && body.locality.trim().length >= 2 ? body.locality : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  return {
    name: text(body.name, 'name', 2, 80),
    locality: text(rawLocality, 'locality', 2, 120),
    description: text(body.description, 'description', 0, 2000),
    latitude,
    longitude,
    photos: rawPhotos.map(photo),
    ratings: validateRatings(body.ratings),
  };
}

export function validateReview(body) {
  if (!isObject(body)) invalid('Invia un oggetto JSON.', 'body');
  return { text: text(body.text, 'text', 1, 2000), ratings: validateRatings(body.ratings) };
}

export function validateQuery(query) {
  return query === undefined ? '' : text(query, 'q', 0, 120);
}

export function validateCredentials(body, registering = false) {
  if (!isObject(body)) invalid('Invia un oggetto JSON.', 'body');
  const email = text(body.email, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Inserisci un indirizzo email valido.', 'email');
  if (typeof body.password !== 'string' || body.password.length < (registering ? 10 : 1) || body.password.length > 128) invalid('La password deve contenere da 10 a 128 caratteri.', 'password');
  return { email, password: body.password, ...(registering ? { name: text(body.name, 'name', 2, 80) } : {}) };
}

export function validateProfile(body) {
  if (!isObject(body)) invalid('Invia un oggetto JSON.', 'body');
  return { name: text(body.name, 'name', 2, 80), ...(body.avatar === undefined ? {} : { avatar: body.avatar === null ? null : photo(body.avatar, 'avatar') }) };
}

export function validatePreferences(body) {
  if (!isObject(body) || !['km', 'mi'].includes(body.distanceUnit) || !['map', 'list'].includes(body.defaultView) || typeof body.reduceMotion !== 'boolean') invalid('Preferenze non valide.', 'preferences');
  return { distanceUnit: body.distanceUnit, defaultView: body.defaultView, reduceMotion: body.reduceMotion };
}
