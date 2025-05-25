// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics"; // You have this, so we'll keep it

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSTfvnT9MPXKNjzaJrtEgHuXsrMIJ_1Rw",
  authDomain: "chittertype-460820.firebaseapp.com",
  projectId: "chittertype-460820",
  storageBucket: "chittertype-460820.appspot.com", // Standard format often ends with .appspot.com. Please double-check this value in your Firebase console. If .firebasestorage.app is correct from your console, use that.
  messagingSenderId: "919407802769",
  appId: "1:919407802769:web:b77774a76858b803a38230",
  measurementId: "G-MB0XDBNVE6"
};

// Log the config to ensure it's what you expect just before initialization
console.log("FirebaseConfig.js: Initializing Firebase with config:", firebaseConfig);

let app;
let authInstance; // Using different names internally to avoid conflict with exports
let dbInstance;
let analyticsInstance;

try {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  analyticsInstance = getAnalytics(app); // Initialize analytics
  console.log("FirebaseConfig.js: Firebase initialized successfully (app, auth, db, analytics).");
} catch (error) {
  console.error("CRITICAL: Error initializing Firebase in firebaseConfig.js:", error);
  // Fallback dummy objects to prevent further app crashes if possible
  // This helps identify if the issue is purely with Firebase init
  app = null;
  authInstance = { currentUser: null, onAuthStateChanged: () => () => {}, signOut: async () => {} }; // Add dummy signOut
  dbInstance = null; // You might need to mock Firestore methods if your app uses them early
  analyticsInstance = null;
  // Re-throw or handle more gracefully depending on app's needs
  // For now, allowing app to continue to see if further errors occur
}

// Export the instances with the names your App.js expects (auth, db)
// and also the initialized app and the config object itself for potential use elsewhere.
export { app, authInstance as auth, dbInstance as db, analyticsInstance as analytics, firebaseConfig as currentFirebaseConfig };
