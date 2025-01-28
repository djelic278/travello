import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Validate required Firebase configuration
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    console.error(`Missing required Firebase environment variable: ${envVar}`);
    throw new Error(`Firebase configuration error: ${envVar} is not set`);
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

console.log('Firebase initialization starting...', {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  currentDomain: window.location.hostname
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('Firebase initialized successfully');

// Export auth instance and Google provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider for better UX
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Add auth state change listener with error handling
auth.onAuthStateChanged(
  (user) => {
    if (user) {
      console.log('User signed in successfully:', {
        email: user.email,
        uid: user.uid,
        displayName: user.displayName
      });
    } else {
      console.log('User is signed out');
    }
  },
  (error) => {
    console.error('Auth state change error:', error);
  }
);