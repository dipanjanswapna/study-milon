'use client';
import {
  collection,
  addDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export type StudySession = {
  id: string;
  duration: number; // in minutes
  subject: string;
  createdAt: any;
};

export async function addStudySession(
  db: Firestore,
  userId: string,
  session: { duration: number; subject: string }
): Promise<void> {
  if (!userId) throw new Error('User ID is required to add a study session.');
  if (!session.subject)
    throw new Error('Subject is required for a study session.');
  try {
    await addDoc(collection(db, 'users', userId, 'studySessions'), {
      ...session,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding study session: ', error);
    throw new Error('Failed to log study session.');
  }
}
