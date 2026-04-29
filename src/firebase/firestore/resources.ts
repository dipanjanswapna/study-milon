'use client';
import {
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  doc,
} from 'firebase/firestore';

export type Resource = {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'pdf';
  createdAt: any;
};

export type ResourceInput = {
  title: string;
  url: string;
  type: 'link' | 'pdf';
}

export async function addResource(
  db: Firestore,
  userId: string,
  resource: ResourceInput
): Promise<void> {
  if (!userId) throw new Error('User ID is required to add a resource.');
  try {
    await addDoc(collection(db, 'users', userId, 'resources'), {
      ...resource,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding resource: ', error);
    throw error;
  }
}

export async function deleteResource(
  db: Firestore,
  userId: string,
  resourceId: string
): Promise<void> {
  if (!userId) throw new Error('User ID is required to delete a resource.');
  const resourceRef = doc(db, 'users', userId, 'resources', resourceId);
  try {
    await deleteDoc(resourceRef);
  } catch (error) {
    console.error('Error deleting resource: ', error);
    throw error;
  }
}
