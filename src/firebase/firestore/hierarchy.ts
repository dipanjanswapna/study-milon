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
  Timestamp,
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

// Atomic Auto-saving timer logic with 12AM reset sync & Hourly Tracking
export async function logStudyTime(
    db: Firestore,
    userId: string,
    subjectId: string,
    chapterId: string,
    minutes: number
) {
    const userRef = doc(db, 'users', userId);
    const chapterRef = doc(db, 'users', userId, 'subjects', subjectId, 'chapters', chapterId);
    const subjectRef = doc(db, 'users', userId, 'subjects', subjectId);
    
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const weekStr = `${now.getFullYear()}-W${getISOWeek(now)}`;
    const monthStr = format(now, 'yyyy-MM');
    const hour = now.getHours().toString();

    const sessionDocId = `${dateStr}_${subjectId}`;
    const sessionRef = doc(db, 'users', userId, 'studySessions', sessionDocId);

    const batch = writeBatch(db);

    try {
        const [userSnap, subjectSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(subjectRef)
        ]);

        if (!userSnap.exists()) {
            throw new Error("User profile not found.");
        }
        
        const userData = userSnap.data();
        const lastStudyDay = userData.last_study_day;
        const lastStudyWeek = userData.last_study_week;
        const lastStudyMonth = userData.last_study_month;
        
        const dailyUpdate = lastStudyDay === dateStr ? increment(minutes) : minutes;
        const weeklyUpdate = lastStudyWeek === weekStr ? increment(minutes) : minutes;
        const monthlyUpdate = lastStudyMonth === monthStr ? increment(minutes) : minutes;

        batch.update(userRef, {
            total_study_minutes: increment(minutes),
            daily_study_minutes: dailyUpdate,
            weekly_study_minutes: weeklyUpdate,
            monthly_study_minutes: monthlyUpdate,
            last_active_date: serverTimestamp(),
            last_study_day: dateStr,
            last_study_week: weekStr,
            last_study_month: monthStr,
            isStudying: true
        });

        batch.update(chapterRef, {
            time_spent: increment(minutes)
        });

        const subjectName = subjectSnap.exists() ? subjectSnap.data().name : 'Unknown';
        
        // Track overall duration AND hourly breakdown within the daily-subject doc
        batch.set(sessionRef, {
          duration: increment(minutes),
          [`hourlyBreakdown.${hour}`]: increment(minutes),
          subject: subjectName,
          subjectId: subjectId,
          createdAt: serverTimestamp(),
          date: dateStr 
        }, { merge: true });

        await batch.commit();

    } catch (error) {
        console.error("Error logging study time: ", error);
        throw error;
    }
}