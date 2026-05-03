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
 * Precision logging system with Auto-Reset Protection.
 * Handles midnight transitions and period boundaries (Friday start week, Monthly, Yearly).
 */
export async function logStudyTime(
    db: Firestore,
    userId: string,
    subjectId: string,
    chapterId: string,
    seconds: number
) {
    if (seconds <= 0) return;

    const isGroupTask = subjectId === 'group-task' || chapterId.startsWith('group-task');
    const userRef = doc(db, 'users', userId);
    
    const chapterRef = !isGroupTask ? doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId) : null;
    const subjectRef = !isGroupTask ? doc(db, 'users', userId, 'subjects', subjectId) : null;
    
    const now = new Date();
    
    // --- TIME PERIOD KEYS ---
    const dateStr = format(now, 'yyyy-MM-dd');
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');
    
    // Custom Study Week: Starts on Friday (weekStartsOn: 5)
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
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
        
        let subjectName = 'Guild Task';
        if (!isGroupTask && subjectRef) {
          const subjectSnap = await getDoc(subjectRef);
          if (subjectSnap.exists()) {
            subjectName = subjectSnap.data().name;
          }
        }

        const userUpdate: any = {
            last_active_date: serverTimestamp(),
            isStudying: true,
            "currentSession.lastSyncTime": Date.now() 
        };

        // --- BOUNDARY DETECTION (Auto-Reset Protection) ---
        const isNewDay = userData.last_study_day !== dateStr;
        const isNewWeek = userData.last_study_week !== weekStr;
        const isNewMonth = userData.last_study_month !== monthStr;
        const isNewYear = userData.last_study_year !== yearStr;

        let minutesToAdd = 0;
        let finalPartialSeconds = 0;

        if (isNewDay) {
            // MIDNIGHT RESET: If day changed, we discard previous partial seconds for the new day's counter
            // but we still count them for the overall 'total_study_minutes' if they reach a full minute.
            // For the daily/weekly/etc counters, we start fresh with the 'seconds' provided in this sync call.
            minutesToAdd = Math.floor(seconds / 60);
            finalPartialSeconds = seconds % 60;
            
            userUpdate.daily_study_minutes = minutesToAdd;
            userUpdate.last_study_day = dateStr;
        } else {
            const totalSeconds = currentPartialSeconds + seconds;
            minutesToAdd = Math.floor(totalSeconds / 60);
            finalPartialSeconds = totalSeconds % 60;
            if (minutesToAdd > 0) {
                userUpdate.daily_study_minutes = increment(minutesToAdd);
            }
        }

        userUpdate.partial_study_seconds = finalPartialSeconds;

        // 2. Weekly Reset (Friday)
        if (isNewWeek) {
            userUpdate.weekly_study_minutes = Math.floor(seconds / 60);
            userUpdate.last_study_week = weekStr;
        } else if (minutesToAdd > 0) {
            userUpdate.weekly_study_minutes = increment(minutesToAdd);
        }

        // 3. Monthly Reset
        if (isNewMonth) {
            userUpdate.monthly_study_minutes = Math.floor(seconds / 60);
            userUpdate.last_study_month = monthStr;
        } else if (minutesToAdd > 0) {
            userUpdate.monthly_study_minutes = increment(minutesToAdd);
        }

        // 4. Yearly Reset
        if (isNewYear) {
            userUpdate.yearly_study_minutes = Math.floor(seconds / 60);
            userUpdate.last_study_year = yearStr;
        } else if (minutesToAdd > 0) {
            userUpdate.yearly_study_minutes = increment(minutesToAdd);
        }

        // --- TOTALS & ANALYTICS ---
        if (minutesToAdd > 0) {
            userUpdate.total_study_minutes = increment(minutesToAdd);

            if (chapterRef) {
                batch.update(chapterRef, {
                    time_spent: increment(minutesToAdd)
                });
            }
            
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
    }
}
