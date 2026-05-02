
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

export type Exam = {
  id: string;
  title: string;
  examDate: any; // Timestamp
  category: string;
  description?: string;
  createdAt: any;
};

export async function addExam(
  db: Firestore,
  data: Omit<Exam, 'id' | 'createdAt'>
) {
  const examsRef = collection(db, 'exams');
  await addDoc(examsRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateExam(
  db: Firestore,
  examId: string,
  data: Partial<Omit<Exam, 'id' | 'createdAt'>>
) {
  const examRef = doc(db, 'exams', examId);
  await updateDoc(examRef, data);
}

export async function deleteExam(db: Firestore, examId: string) {
  const examRef = doc(db, 'exams', examId);
  await deleteDoc(examRef);
}
