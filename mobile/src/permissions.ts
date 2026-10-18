import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export class DevicePermissionError extends Error {
  constructor(message: string, readonly settingsRequired: boolean) { super(message); }
}

export async function requestGalleryAccess() {
  if (Platform.OS === 'web') return;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new DevicePermissionError('Allow photo access to choose profile pictures. You can grant access to selected photos only.', !permission.canAskAgain);
}
export async function requestCameraAccess() {
  if (Platform.OS === 'web') throw new Error('Open the app on your phone to capture a selfie.');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new DevicePermissionError('Allow camera access to take your verification selfie.', !permission.canAskAgain);
}
export async function captureSelfie() {
  await requestCameraAccess();
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], cameraType: ImagePicker.CameraType.front, quality: 0.85, exif: false });
  return result.canceled ? null : result.assets[0].uri;
}

export async function locateCity() {
  if (Platform.OS === 'web') throw new Error('Use the mobile app to confirm your precise location, or enter your city manually.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new DevicePermissionError('Allow location while using the app, or enter your city manually.', !permission.canAskAgain);
  if (permission.ios?.accuracy === 'reduced') throw new DevicePermissionError('Precise Location is off. Enable it in Settings for an accurate location, or enter your city manually.', true);
  if (!(await Location.hasServicesEnabledAsync())) throw new DevicePermissionError('Turn on Location Services to use your current position.', true);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('GPS is taking too long. Try near a window or enter your city manually.')), 30000); }),
    ]);
    const addresses = await Location.reverseGeocodeAsync(position.coords);
    const address = addresses[0];
    const city = address?.city || address?.subregion || address?.region;
    if (!city) throw new Error('Your GPS position was found, but the city could not be resolved. Enter your city manually.');
    return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, city, neighborhood: address?.district || '' };
  } finally { if (timeout) clearTimeout(timeout); }
}

export async function localContacts() {
  if (Platform.OS === 'web') throw new Error('Use the mobile app to invite someone from your address book.');
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) throw new DevicePermissionError('Allow contacts access to choose friends to invite. Contacts stay on your device.', !permission.canAskAgain);
  const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
  return result.data.filter((contact) => contact.phoneNumbers?.some((p) => p.number)).map((contact) => ({ id: contact.id || contact.name, name: contact.name, number: contact.phoneNumbers!.find((p) => p.number)!.number! }));
}
