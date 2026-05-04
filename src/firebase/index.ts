'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import { firebaseConfig } from './config';

import {
  FirebaseProvider,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useDatabase,
} from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useUser } from './auth/use-user';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';

let firebaseInstance: {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
} | null = null;

let persistencePromise: Promise<void> | null = null;

// Initialize Firebase
function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
} {
  if (firebaseInstance) {
    return firebaseInstance;
  }

  const apps = getApps();
  const firebaseApp = !apps.length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const database = getDatabase(firebaseApp);

  if (typeof window !== 'undefined' && !persistencePromise) {
    persistencePromise = enableIndexedDbPersistence(firestore).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistence failed-precondition: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistence unimplemented by browser');
      } else {
        console.error('Persistence initialization error:', err);
      }
    });
  }

  firebaseInstance = { firebaseApp, auth, firestore, database };
  return firebaseInstance;
}

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useDatabase,
  useCollection,
  useDoc,
};
