
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
import { format, getISOWeek } from 'date-fns';

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
 * Precision logging system that handles seconds to prevent any time gaps.
 * Rollover logic ensures minutes are only incremented when full 60 seconds are reached.
 */
export async function logStudyTime(
    db: Firestore,
    userId: string,
    subjectId: string,
    chapterId: string,
    seconds: number
) {
    if (seconds <= 0) return;

    const isGroupTask = subjectId === 'group-task';
    const userRef = doc(db, 'users', userId);
    
    // For group tasks, these documents don't exist in the hierarchy
    const chapterRef = !isGroupTask ? doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId) : null;
    const subjectRef = !isGroupTask ? doc(db, 'users', userId, 'subjects', subjectId) : null;
    
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const weekStr = `${now.getFullYear()}-W${getISOWeek(now)}`;
    const monthStr = format(now, 'yyyy-MM');
    const hour = now.getHours().toString();

    const sessionDocId = `${dateStr}_${subjectId}`;
    const sessionRef = doc(db, 'users', userId, 'studySessions', sessionDocId);

    const batch = writeBatch(db);

    try {
        const promises = [getDoc(userRef)];
        if (subjectRef) promises.push(getDoc(subjectRef));
        
        const snaps = await Promise.all(promises);
        const userSnap = snaps[0];
        const subjectSnap = snaps[1] || null;

        if (!userSnap.exists()) {
            throw new Error("User profile not found.");
        }
        
        const userData = userSnap.data();
        const currentPartialSeconds = userData.partial_study_seconds || 0;
        const totalSeconds = currentPartialSeconds + seconds;
        
        const minutesToAdd = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;

        // Basic precision update (always update partial seconds to avoid loss)
        const userUpdate: any = {
            partial_study_seconds: remainingSeconds,
            last_active_date: serverTimestamp(),
            isStudying: true
        };

        // If we crossed a minute boundary, perform global increments
        if (minutesToAdd > 0) {
            const lastStudyDay = userData.last_study_day;
            const lastStudyWeek = userData.last_study_week;
            const lastStudyMonth = userData.last_study_month;
            
            const dailyUpdate = lastStudyDay === dateStr ? increment(minutesToAdd) : minutesToAdd;
            const weeklyUpdate = lastStudyWeek === weekStr ? increment(minutesToAdd) : minutesToAdd;
            const monthlyUpdate = lastStudyMonth === monthStr ? increment(minutesToAdd) : minutesToAdd;

            userUpdate.total_study_minutes = increment(minutesToAdd);
            userUpdate.daily_study_minutes = dailyUpdate;
            userUpdate.weekly_study_minutes = weeklyUpdate;
            userUpdate.monthly_study_minutes = monthlyUpdate;
            userUpdate.last_study_day = dateStr;
            userUpdate.last_study_week = weekStr;
            userUpdate.last_study_month = monthStr;

            if (chapterRef) {
                batch.update(chapterRef, {
                    time_spent: increment(minutesToAdd)
                });
            }

            const subjectName = subjectSnap && subjectSnap.exists() ? subjectSnap.data().name : (isGroupTask ? 'Guild Task' : 'Unknown');
            
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
        console.error("Error logging study time: ", error);
        throw error;
    }
}
