
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
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { format } from 'date-fns';

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
  source?: 'personal' | 'group';
  groupId?: string;
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
    source: task.source || 'personal',
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

/**
 * Moves expired (incomplete) tasks from previous days to today.
 */
export async function restoreTasks(db: Firestore, userId: string, taskIds: string[]) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const batch = writeBatch(db);
  
  // Get today's current task count to determine order
  const todayQuery = query(
    collection(db, 'users', userId, 'tasks'),
    where('date', '==', todayStr)
  );
  const todaySnap = await getDocs(todayQuery);
  let nextOrder = todaySnap.size;

  for (const id of taskIds) {
    const taskRef = doc(db, 'users', userId, 'tasks', id);
    batch.update(taskRef, { 
      date: todayStr,
      order: nextOrder++ 
    });
  }

  await batch.commit();
}
