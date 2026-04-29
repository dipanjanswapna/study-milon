'use client';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  doc,
} from 'firebase/firestore';

export type Goal = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: any;
};

export async function addGoal(
  db: Firestore,
  userId: string,
  text: string
): Promise<void> {
  if (!userId) throw new Error('User ID is required to add a goal.');
  try {
    await addDoc(collection(db, 'users', userId, 'goals'), {
      text,
      completed: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding goal: ', error);
    throw error;
  }
}

export async function updateGoalCompletion(
  db: Firestore,
  userId: string,
  goalId: string,
  completed: boolean
): Promise<void> {
  if (!userId) throw new Error('User ID is required to update a goal.');
  const goalRef = doc(db, 'users', userId, 'goals', goalId);
  try {
    await updateDoc(goalRef, { completed });
  } catch (error) {
    console.error('Error updating goal: ', error);
    throw error;
  }
}

export async function deleteGoal(
  db: Firestore,
  userId: string,
  goalId: string
): Promise<void> {
  if (!userId) throw new Error('User ID is required to delete a goal.');
  const goalRef = doc(db, 'users', userId, 'goals', goalId);
  try {
    await deleteDoc(goalRef);
  } catch (error) {
    console.error('Error deleting goal: ', error);
    throw error;
  }
}
