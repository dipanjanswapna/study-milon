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
  getDoc,
  increment,
} from 'firebase/firestore';

// Subject CRUD
export async function addSubject(db: Firestore, userId: string, name: string) {
  const subjectsRef = collection(db, 'users', userId, 'subjects');
  await addDoc(subjectsRef, { name, createdAt: serverTimestamp() });
}

export async function updateSubject(db: Firestore, userId: string, subjectId: string, name: string) {
  const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
  await updateDoc(subjectRef, { name });
}

export async function deleteSubject(db: Firestore, userId: string, subjectId: string) {
    const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
    // Note: This will not delete subcollections in the client SDK.
    // For a complete cleanup, you'd need a Cloud Function.
    // Here we just delete the subject document itself.
    await deleteDoc(subjectRef);
}


// Chapter CRUD
export async function addChapter(db: Firestore, userId: string, subjectId: string, name: string) {
  const chaptersRef = collection(db, 'users', userId, 'subjects', subjectId, 'chapters');
  await addDoc(chaptersRef, { name, createdAt: serverTimestamp() });
}

export async function updateChapter(db: Firestore, userId: string, subjectId: string, chapterId: string, name: string) {
  const chapterRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId);
  await updateDoc(chapterRef, { name });
}

export async function deleteChapter(db: Firestore, userId: string, subjectId: string, chapterId: string) {
    const chapterRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId);
    await deleteDoc(chapterRef);
}


// Topic CRUD
export async function addTopic(db: Firestore, userId: string, subjectId: string, chapterId: string, name: string) {
  const topicsRef = collection(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId, 'topics');
  await addDoc(topicsRef, {
    name,
    status: 'pending',
    time_spent: 0,
    createdAt: serverTimestamp(),
    revision_count: 0,
  });
}

export async function updateTopic(db: Firestore, userId: string, subjectId: string, chapterId: string, topicId: string, name: string) {
  const topicRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId, 'topics', topicId);
  await updateDoc(topicRef, { name });
}

export async function updateTopicStatus(db: Firestore, userId: string, subjectId: string, chapterId: string, topicId: string, newStatus: 'pending' | 'completed' | 'revision') {
    const topicRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId, 'topics', topicId);
    const updatePayload: any = { status: newStatus };

    // If we are completing a revision
    if (newStatus === 'completed') {
      const topicSnap = await getDoc(topicRef);
      if (topicSnap.exists() && topicSnap.data().status === 'revision') {
        updatePayload.revision_count = increment(1);
        updatePayload.last_revision_date = serverTimestamp();
      }
    }
  
    await updateDoc(topicRef, updatePayload);
}

export async function deleteTopic(db: Firestore, userId: string, subjectId: string, chapterId: string, topicId: string) {
    const topicRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId, 'topics', topicId);
    await deleteDoc(topicRef);
}
