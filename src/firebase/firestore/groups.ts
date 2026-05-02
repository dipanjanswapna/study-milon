
'use client';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  increment,
  type Firestore,
} from 'firebase/firestore';
import { subDays } from 'date-fns';

export type StudyGroup = {
  id: string;
  name: string;
  description: string;
  category: string;
  batch: string;
  creatorId: string;
  moderators: string[];
  members: string[];
  memberCount: number;
  memberLimit: number;
  discordLink: string;
  createdAt: any;
};

export type GroupAnnouncement = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
};

/**
 * Cleans up pending requests older than 2 days.
 */
export async function cleanupExpiredRequests(db: Firestore, groupId: string) {
  try {
    const twoDaysAgo = subDays(new Date(), 2);
    const requestsRef = collection(db, 'groups', groupId, 'requests');
    const q = query(
      requestsRef, 
      where('status', '==', 'pending'),
      where('createdAt', '<', twoDaysAgo)
    );
    
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
    }
    return 0;
  } catch (e) {
    console.error("Error cleaning up expired requests:", e);
    return 0;
  }
}

export async function createGroup(
  db: Firestore,
  userId: string,
  data: { name: string; description: string; category: string; batch: string; discordLink: string }
) {
  if (!data.discordLink) throw new Error("A Discord server link is required to launch a guild.");
  
  const groupsRef = collection(db, 'groups');
  const groupDoc = await addDoc(groupsRef, {
    ...data,
    creatorId: userId,
    moderators: [userId],
    members: [userId],
    memberCount: 1,
    memberLimit: 15,
    createdAt: serverTimestamp(),
  });

  // Update user's profile to link to the group
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { groupId: groupDoc.id });

  return groupDoc.id;
}

export async function updateGroup(
  db: Firestore,
  groupId: string,
  data: Partial<{ name: string; description: string; category: string; batch: string; discordLink: string }>
) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, data);
}

export async function sendJoinRequest(db: Firestore, groupId: string, user: { uid: string; displayName: string; photoURL: string }) {
  // Check if request already exists to prevent duplicates
  const requestsRef = collection(db, 'groups', groupId, 'requests');
  const q = query(requestsRef, where('userId', '==', user.uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    throw new Error("You already have a pending request for this guild.");
  }

  await addDoc(requestsRef, {
    userId: user.uid,
    userName: user.displayName,
    userPhoto: user.photoURL,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function cancelJoinRequest(db: Firestore, groupId: string, userId: string) {
  const requestsRef = collection(db, 'groups', groupId, 'requests');
  const q = query(requestsRef, where('userId', '==', userId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

export async function approveRequest(db: Firestore, groupId: string, requestId: string, userId: string) {
  const batch = writeBatch(db);
  
  const groupRef = doc(db, 'groups', groupId);
  const requestRef = doc(db, 'groups', groupId, 'requests', requestId);
  const userRef = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Group does not exist.");
  
  const groupData = groupSnap.data() as StudyGroup;
  const currentMembers = groupData.members || [];

  if (currentMembers.length >= (groupData.memberLimit || 15)) {
    throw new Error("Group is full.");
  }

  batch.update(groupRef, {
    members: [...currentMembers, userId],
    memberCount: increment(1)
  });

  batch.update(requestRef, { status: 'approved' });
  batch.update(userRef, { groupId: groupId });

  await batch.commit();
}

export async function declineRequest(db: Firestore, groupId: string, requestId: string) {
  const requestRef = doc(db, 'groups', groupId, 'requests', requestId);
  await updateDoc(requestRef, { status: 'declined' });
}

export async function addGroupTask(
  db: Firestore,
  groupId: string,
  taskData: { subjectId: string; chapterId: string; subjectName: string; chapterName: string; note?: string; date: string; duration: number }
) {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;

  const members = groupSnap.data().members as string[];
  const batch = writeBatch(db);

  for (const memberId of members) {
    const userTasksRef = collection(db, 'users', memberId, 'tasks');
    const newTaskRef = doc(userTasksRef);
    batch.set(newTaskRef, {
      ...taskData,
      completed: false,
      source: 'group',
      groupId: groupId,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function leaveGroup(db: Firestore, groupId: string, userId: string) {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);
  const userRef = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;

  const members = groupSnap.data().members as string[];
  const updatedMembers = members.filter(m => m !== userId);

  batch.update(groupRef, {
    members: updatedMembers,
    memberCount: increment(-1)
  });

  batch.update(userRef, { groupId: null });

  await batch.commit();
}

/**
 * Deletes a study group and removes the groupId reference from all members.
 */
export async function deleteGroup(db: Firestore, groupId: string, memberIds: string[]) {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);

  // 1. Remove groupId from all members
  for (const mid of memberIds) {
    const userRef = doc(db, 'users', mid);
    batch.update(userRef, { groupId: null });
  }

  // 2. Delete the group document
  batch.delete(groupRef);

  await batch.commit();
}

export async function addGroupAnnouncement(
  db: Firestore,
  groupId: string,
  authorId: string,
  authorName: string,
  content: string
) {
  const announcementsRef = collection(db, 'groups', groupId, 'announcements');
  await addDoc(announcementsRef, {
    authorId,
    authorName,
    content,
    createdAt: serverTimestamp(),
  });
}

export async function deleteGroupAnnouncement(db: Firestore, groupId: string, announcementId: string) {
  const announcementRef = doc(db, 'groups', groupId, 'announcements', announcementId);
  await deleteDoc(announcementRef);
}
