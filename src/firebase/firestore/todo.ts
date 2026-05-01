'use client';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  doc,
  increment,
  writeBatch,
} from 'firebase/firestore';

export type StudyTask = {
  id: string;
  subjectId: string;
  chapterId: string;
  subjectName: string;
  chapterName: string;
  date: string; // YYYY-MM-DD
  duration: number; // in minutes
  completed: boolean;
  createdAt: any;
};

export async function addStudyTask(
  db: Firestore,
  userId: string,
  task: Omit<StudyTask, 'id' | 'createdAt' | 'completed'>
): Promise<void> {
  if (!userId) throw new Error('User ID is required.');
  const tasksRef = collection(db, 'users', userId, 'tasks');
  await addDoc(tasksRef, {
    ...task,
    completed: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateTaskStatus(
  db: Firestore,
  userId: string,
  taskId: string,
  completed: boolean
): Promise<void> {
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  const userRef = doc(db, 'users', userId);
  
  const batch = writeBatch(db);
  
  // Point System: Chapter completed = 50 points
  const pointIncrement = completed ? 50 : -50;

  batch.update(taskRef, { completed });
  batch.update(userRef, { 
    points: increment(pointIncrement) 
  });

  await batch.commit();
}

export async function deleteTask(
  db: Firestore,
  userId: string,
  taskId: string
): Promise<void> {
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskRef);
}
