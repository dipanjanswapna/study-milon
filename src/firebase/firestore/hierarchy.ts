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
  Timestamp,
} from 'firebase/firestore';

// Subject CRUD
export async function addSubject(db: Firestore, userId: string, name: string) {
  const subjectsRef = collection(db, 'users', userId, 'subjects');
  await addDoc(subjectsRef, { name, createdAt: serverTimestamp() });
}

export async function updateSubject(
  db: Firestore,
  userId: string,
  subjectId: string,
  name: string
) {
  const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
  await updateDoc(subjectRef, { name });
}

export async function deleteSubject(
  db: Firestore,
  userId: string,
  subjectId: string
) {
  const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
  // Note: This will not delete subcollections in the client SDK.
  // For a complete cleanup, you'd need a Cloud Function.
  // Here we just delete the subject document itself.
  await deleteDoc(subjectRef);
}

// Chapter CRUD
export async function addChapter(
  db: Firestore,
  userId: string,
  subjectId: string,
  name: string
) {
  const chaptersRef = collection(
    db,
    'users',
    userId,
    'subjects',
    subjectId,
    'chapters'
  );
  await addDoc(chaptersRef, {
    name,
    status: 'pending',
    time_spent: 0,
    revision_count: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateChapter(
  db: Firestore,
  userId: string,
  subjectId: string,
  chapterId: string,
  name: string
) {
  const chapterRef = doc(
    db,
    'users',
    userId,
    'subjects',
    subjectId,
    'chapters',
    chapterId
  );
  await updateDoc(chapterRef, { name });
}

export async function deleteChapter(
  db: Firestore,
  userId: string,
  subjectId: string,
  chapterId: string
) {
  const chapterRef = doc(
    db,
    'users',
    userId,
    'subjects',
    subjectId,
    'chapters',
    chapterId
  );
  await deleteDoc(chapterRef);
}

export async function updateChapterStatus(
  db: Firestore,
  userId: string,
  subjectId: string,
  chapterId: string,
  newStatus: 'pending' | 'completed' | 'revision'
) {
  const chapterRef = doc(
    db,
    'users',
    userId,
    'subjects',
    subjectId,
    'chapters',
    chapterId
  );
  const updatePayload: any = { status: newStatus };

  if (newStatus === 'completed') {
    const chapterSnap = await getDoc(chapterRef);
    if (chapterSnap.exists() && chapterSnap.data().status === 'revision') {
      updatePayload.revision_count = increment(1);
      updatePayload.last_revision_date = serverTimestamp();
    }
  }

  await updateDoc(chapterRef, updatePayload);
}

// Auto-saving timer logic
export async function logStudyTime(
    db: Firestore,
    userId: string,
    subjectId: string,
    chapterId: string,
    minutes: number
) {
    const userRef = doc(db, 'users', userId);
    const chapterRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId);
    
    const batch = writeBatch(db);

    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            throw new Error("User profile not found.");
        }
        
        const userData = userSnap.data();
        const lastActive = userData.last_active_date as Timestamp | undefined;
        const today = new Date();
        
        let dailyMinutesUpdate;
        
        if (lastActive && lastActive.toDate().toDateString() === today.toDateString()) {
            // last active was today, just increment
            dailyMinutesUpdate = increment(minutes);
        } else {
            // last active was not today, reset to the logged minutes
            dailyMinutesUpdate = minutes;
        }

        // Update user profile
        batch.update(userRef, {
            total_study_minutes: increment(minutes),
            daily_study_minutes: dailyMinutesUpdate,
            last_active_date: serverTimestamp()
        });

        // Update chapter time spent
        batch.update(chapterRef, {
            time_spent: increment(minutes)
        });

        await batch.commit();

    } catch (error) {
        console.error("Error logging study time: ", error);
        throw error;
    }
}
