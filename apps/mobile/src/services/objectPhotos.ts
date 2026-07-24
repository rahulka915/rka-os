import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'objectPhotos');

function ensurePhotosDir(): void {
  if (!photosDir.exists) {
    photosDir.create({ intermediates: true });
  }
}

// Copies the picked image into the app's own document directory rather than storing the
// picker's tmp-path, which isn't guaranteed to persist across app restarts.
export async function pickAndStoreObjectPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;

  ensurePhotosDir();
  const source = new File(result.assets[0].uri);
  const destination = new File(photosDir, `${Date.now()}${source.extension || '.jpg'}`);
  source.copySync(destination);
  return destination.uri;
}

export function deleteStoredObjectPhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
