/**
 * Photos campers attach to a campsite review. Each photo is shrunk and re-saved in the browser
 * before it uploads, which also removes the hidden location and camera details phones store in
 * photos (EXIF), then goes into the public campsite-review-photos bucket under the camper's own
 * folder (the bucket only accepts uploads there). The RMS checks the paths when the review is
 * saved.
 */
import { supabase } from '../supabase';
import { ensureFreshSession } from './rmsApi';

export const REVIEW_PHOTO_BUCKET = 'campsite-review-photos';
const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Bigger originals than this are refused before compressing (a phone photo is 2–12 MB). */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

/** The photo, at most 1600 px on its longest side, as WebP (JPEG where WebP can't be made). */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('This photo could not be read.');
  return jpeg;
}

export interface UploadedPhoto {
  path: string;
  url: string;
}

export async function uploadReviewPhoto(file: File): Promise<UploadedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPG, PNG, HEIC or WebP).');
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error('That photo is too large. Choose one under 25 MB.');
  const session = await ensureFreshSession();
  if (!session) throw new Error('Please log in again to add photos.');
  const blob = await compressPhoto(file);
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error('The photo could not be uploaded. Please try again.');
  return { path, url: supabase.storage.from(REVIEW_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl };
}
