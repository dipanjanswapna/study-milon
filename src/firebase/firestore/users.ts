
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
  daily_goal_minutes?: number;
  last_active_date?: any;
  last_study_day?: string; // Format: YYYY-MM-DD
  category?: AcademicCategory;
  batch?: string;
  institution?: string;
  phoneNumber?: string;
  groupId?: string;
  focusSettings?: FocusSettings;
  focusPoints?: number;
  pinnedExamId?: string | null;
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
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        photoURL,
        createdAt,
        role: user.uid === SUPER_ADMIN_UID ? 'admin' : 'student',
        religion: 'Muslim', // Explicit default on creation
        total_study_minutes: 0,
        daily_study_minutes: 0,
        daily_goal_minutes: 360, // Default 6 hours
        last_active_date: serverTimestamp(),
        last_study_day: todayStr,
        institution: '',
        phoneNumber: '',
        focusPoints: 0,
        pinnedExamId: null,
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

/**
 * Deletes a user profile and cleans up group memberships if applicable.
 */
export async function deleteUserProfile(db: Firestore, userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as UserProfile;
  const batch = writeBatch(db);

  // If user is in a group, remove them from it
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

  // Delete profile document
  batch.delete(userRef);
  
  await batch.commit();
}
