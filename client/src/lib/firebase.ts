import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Validate required Firebase configuration
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
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

// Configure Google provider with additional parameters for better UX
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Add error event listener to auth
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User is signed in:', user.email);
  } else {
    console.log('No user is signed in.');
  }
});

// Add error handling for auth state changes
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User is signed in:', user.email);
  } else {
    console.log('No user is signed in.');
  }
}, (error) => {
  console.error('Auth state change error:', error);
});