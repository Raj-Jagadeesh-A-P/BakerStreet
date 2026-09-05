import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Emulator-first: with no VITE_FIREBASE_API_KEY the app boots against the
// local Firebase emulators (npm run emulators). Set the VITE_FIREBASE_*
// variables to a real web app's config to talk to a production Firebase
// project instead.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(config);

export const auth = getAuth(firebaseApp);

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || !config.apiKey;
if (useEmulator) {
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR || 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
}