import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { toAppError } from '@/api/errors';
import type { PickedImage } from '@/lib/posts';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_LONG_EDGE = 1600;
const QUALITIES = [0.8, 0.6, 0.4];

/** Size of a local file in bytes, or null if it can't be read (expo-file-system isn't installed). */
async function fileSizeOf(uri: string): Promise<number | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return typeof blob.size === 'number' ? blob.size : null;
  } catch {
    return null;
  }
}

function release(obj: { release?: () => void } | null | undefined) {
  try {
    obj?.release?.();
  } catch {
    // already released
  }
}

/** Resizes so the long edge is ≤ 1600px and saves JPEG, lowering quality until the file is ≤ 5MB. */
export async function compressImage(uri: string): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  let ref = await ctx.renderAsync();
  try {
    const longEdge = Math.max(ref.width, ref.height);
    if (longEdge > MAX_LONG_EDGE) {
      ctx.resize(ref.width >= ref.height ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
      release(ref);
      ref = await ctx.renderAsync();
    }

    let out: PickedImage | null = null;
    for (const compress of QUALITIES) {
      const saved = await ref.saveAsync({ compress, format: SaveFormat.JPEG });
      const fileSize = await fileSizeOf(saved.uri);
      out = { uri: saved.uri, width: saved.width, height: saved.height, mimeType: 'image/jpeg', fileSize };
      // unknown size: rely on the resize + first quality step
      if (fileSize === null || fileSize <= MAX_UPLOAD_BYTES) break;
    }
    return out!;
  } finally {
    release(ref);
    release(ctx);
  }
}

/**
 * Asks for the camera or media-library permission, lets the user pick/take one photo and compresses it.
 * Resolves null if the user cancels or denies the permission; other failures reject with AppError.
 */
export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  try {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return null;

    return await compressImage(result.assets[0].uri);
  } catch (e) {
    throw toAppError(e);
  }
}
