
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  increment,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { format, startOfWeek } from 'date-fns';

export type AcademicCategory = 'SSC' | 'HSC' | 'Admission 1st' | 'Admission 2nd' | 'Job Prep' | 'University';
export type Religion = 'Muslim' | 'Hindu';

// Master Admin UID
export const SUPER_ADMIN_UID = 'sxvibeReFEahnWgZiNB0UJbHYvU2';

export type FocusSettings = {
  blockFbReels: boolean;
  blockInstaReels: boolean;
  blockYoutubeShorts: boolean;
  restrictMessenger: boolean;
  restrictWhatsapp: boolean;
  blockSpotify: boolean;
  blockWattpad: boolean;
  strictMode: boolean;
};

export type CurrentSession = {
  startTime: number | null;
  lastSyncTime: number | null;
  duration: number;
  status: 'active' | 'paused' | 'idle';
  taskId: string | null;
  subjectId: string | null;
  chapterId: string | null;
  isBreak: boolean;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any;
  role: 'student' | 'admin';
  religion?: Religion;
  total_study_minutes?: number;
  daily_study_minutes?: number;
  weekly_study_minutes?: number;
  monthly_study_minutes?: number;
  yearly_study_minutes?: number;
  partial_study_seconds?: number;
  daily_goal_minutes?: number;
  last_active_date?: any;
  last_study_day?: string; // Format: YYYY-MM-DD
  last_study_week?: string; // Format: Friday_YYYY-MM-DD
  last_study_month?: string; // Format: YYYY-MM
  last_study_year?: string; // Format: YYYY
  category?: AcademicCategory;
  batch?: string;
  institution?: string;
  phoneNumber?: string;
  groupId?: string;
  focusSettings?: FocusSettings;
  focusPoints?: number;
  pinnedExamId?: string | null;
  isStudying?: boolean;
  currentSession?: CurrentSession;
};

export async function createUserProfile(
  db: Firestore,
  user: User
): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const { uid, email, displayName, photoURL } = user;
    const createdAt = serverTimestamp();
    const now = new Date();
    
    // Custom Week Logic: Starts on Friday (weekStartsOn: 5)
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
    
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');

    try {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        photoURL,
        createdAt,
        role: user.uid === SUPER_ADMIN_UID ? 'admin' : 'student',
        religion: 'Muslim', 
        total_study_minutes: 0,
        daily_study_minutes: 0,
        weekly_study_minutes: 0,
        monthly_study_minutes: 0,
        yearly_study_minutes: 0,
        partial_study_seconds: 0,
        daily_goal_minutes: 360, 
        last_active_date: serverTimestamp(),
        last_study_day: todayStr,
        last_study_week: weekStr,
        last_study_month: monthStr,
        last_study_year: yearStr,
        institution: '',
        phoneNumber: '',
        focusPoints: 0,
        pinnedExamId: null,
        isStudying: false,
        currentSession: {
          startTime: null,
          lastSyncTime: null,
          duration: 25,
          status: 'idle',
          taskId: null,
          subjectId: null,
          chapterId: null,
          isBreak: false
        },
        focusSettings: {
          blockFbReels: false,
          blockInstaReels: false,
          blockYoutubeShorts: false,
          restrictMessenger: false,
          restrictWhatsapp: false,
          blockSpotify: false,
          blockWattpad: false,
          strictMode: false,
        }
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }
}

export async function getUserProfile(
  db: Firestore,
  uid: string
): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

export async function updateUserProfile(
  db: Firestore,
  uid: string,
  data: Partial<UserProfile>
) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
}

export async function pinExamToDashboard(db: Firestore, uid: string, examId: string | null) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { pinnedExamId: examId });
}

export async function deleteUserProfile(db: Firestore, userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as UserProfile;
  const batch = writeBatch(db);

  if (userData.groupId) {
    const groupRef = doc(db, 'groups', userData.groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const updatedMembers = (groupData.members || []).filter((m: string) => m !== userId);
      batch.update(groupRef, {
        members: updatedMembers,
        memberCount: increment(-1)
      });
    }
  }

  batch.delete(userRef);
  await batch.commit();
}
