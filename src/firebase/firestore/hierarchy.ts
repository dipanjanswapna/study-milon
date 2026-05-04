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
  getDoc,
  increment,
} from 'firebase/firestore';
import { format, startOfWeek } from 'date-fns';

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

/**
 * Robust precision logging system with full period boundary protection (Daily, Weekly, Monthly, Yearly).
 */
export async function logStudyTime(
    db: Firestore,
    userId: string,
    subjectId: string | null,
    chapterId: string | null,
    seconds: number
) {
    if (seconds <= 0 || !subjectId || !chapterId) return;

    const userRef = doc(db, 'users', userId);
    const chapterRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId);
    const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
    
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); // Friday start
    const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    
    const hour = now.getHours().toString();
    const sessionDocId = `${dateStr}_${subjectId}`;
    const sessionRef = doc(db, 'users', userId, 'studySessions', sessionDocId);

    const batch = writeBatch(db);

    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        
        const userData = userSnap.data();
        const currentPartialSeconds = userData.partial_study_seconds || 0;
        
        const subSnap = await getDoc(subjectRef);
        const subjectName = subSnap.exists() ? subSnap.data().name : 'Focus Session';

        const userUpdate: any = {
            last_active_date: serverTimestamp(),
            isStudying: false,
        };

        // Resets for permanent Firestore counters based on period handover
        const isNewDay = userData.last_study_day !== dateStr;
        const isNewWeek = userData.last_study_week !== weekStr;
        const isNewMonth = userData.last_study_month !== monthStr;
        const isNewYear = userData.last_study_year !== yearStr;

        let minutesToAdd = 0;
        let finalPartialSeconds = 0;

        const totalSeconds = currentPartialSeconds + seconds;
        minutesToAdd = Math.floor(totalSeconds / 60);
        finalPartialSeconds = totalSeconds % 60;

        // Reset logic for each period in Firestore Profile
        userUpdate.daily_study_minutes = isNewDay ? minutesToAdd : increment(minutesToAdd);
        userUpdate.last_study_day = dateStr;
        
        userUpdate.weekly_study_minutes = isNewWeek ? minutesToAdd : increment(minutesToAdd);
        userUpdate.last_study_week = weekStr;

        userUpdate.monthly_study_minutes = isNewMonth ? minutesToAdd : increment(minutesToAdd);
        userUpdate.last_study_month = monthStr;

        userUpdate.yearly_study_minutes = isNewYear ? minutesToAdd : increment(minutesToAdd);
        userUpdate.last_study_year = yearStr;

        userUpdate.partial_study_seconds = finalPartialSeconds;

        if (minutesToAdd > 0) {
            userUpdate.total_study_minutes = increment(minutesToAdd);
            batch.update(chapterRef, { time_spent: increment(minutesToAdd) });
            batch.set(sessionRef, {
              duration: increment(minutesToAdd),
              [`hourlyBreakdown.${hour}`]: increment(minutesToAdd),
              subject: subjectName,
              subjectId: subjectId,
              createdAt: serverTimestamp(),
              date: dateStr 
            }, { merge: true });
        }

        batch.update(userRef, userUpdate);
        await batch.commit();

    } catch (error) {
        console.error("Optimized Time Logging Error: ", error);
    }
}
