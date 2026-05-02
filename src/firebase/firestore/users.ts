import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

export type AcademicCategory = 'SSC' | 'HSC' | 'Admission 1st' | 'Admission 2nd' | 'Job Prep';
export type Religion = 'Muslim' | 'Hindu';

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
  category?: AcademicCategory;
  batch?: string;
  institution?: string;
  phoneNumber?: string;
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
    try {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        photoURL,
        createdAt,
        role: 'student',
        religion: 'Muslim',
        total_study_minutes: 0,
        daily_study_minutes: 0,
        daily_goal_minutes: 360, // Default 6 hours
        last_active_date: serverTimestamp(),
        institution: '',
        phoneNumber: '',
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
