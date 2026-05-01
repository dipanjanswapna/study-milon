
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

export type StudyTask = {
  id: string;
  subjectId: string;
  chapterId: string;
  subjectName: string;
  chapterName: string;
  date: string; // YYYY-MM-DD
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
  await updateDoc(taskRef, { completed });
}

export async function deleteTask(
  db: Firestore,
  userId: string,
  taskId: string
): Promise<void> {
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskRef);
}
