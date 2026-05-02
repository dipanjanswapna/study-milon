
'use client';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
  doc,
  writeBatch,
} from 'firebase/firestore';

export type StudyTask = {
  id: string;
  subjectId: string;
  chapterId: string;
  subjectName: string;
  chapterName: string;
  note?: string;
  date: string; // YYYY-MM-DD
  duration: number; // in minutes
  completed: boolean;
  order: number;
  createdAt: any;
};

export async function addStudyTask(
  db: Firestore,
  userId: string,
  task: Omit<StudyTask, 'id' | 'createdAt' | 'completed' | 'order'>,
  nextOrder: number = 0
): Promise<void> {
  if (!userId) throw new Error('User ID is required.');
  const tasksRef = collection(db, 'users', userId, 'tasks');
  await addDoc(tasksRef, {
    ...task,
    completed: false,
    order: nextOrder,
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

export async function updateTasksOrder(
  db: Firestore,
  userId: string,
  orderedTasks: { id: string; order: number }[]
): Promise<void> {
  if (!userId) return;
  const batch = writeBatch(db);
  orderedTasks.forEach((task) => {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id);
    batch.update(taskRef, { order: task.order });
  });
  await batch.commit();
}
