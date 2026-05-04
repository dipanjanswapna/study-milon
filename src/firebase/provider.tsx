'use client';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Database } from 'firebase/database';
import React, { createContext, useContext } from 'react';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{
  value: FirebaseContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
export const useDatabase = () => useFirebase().database;
