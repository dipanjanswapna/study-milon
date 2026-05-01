
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
  discordLink?: string;
  createdAt: any;
};

export type GroupAnnouncement = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
};

export async function createGroup(
  db: Firestore,
  userId: string,
  data: { name: string; description: string; category: string; batch: string; discordLink?: string }
) {
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

export async function sendJoinRequest(db: Firestore, groupId: string, user: { uid: string; displayName: string; photoURL: string }) {
  const requestsRef = collection(db, 'groups', groupId, 'requests');
  await addDoc(requestsRef, {
    userId: user.uid,
    userName: user.displayName,
    userPhoto: user.photoURL,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
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
  taskData: { subjectId: string; chapterId: string; subjectName: string; chapterName: string; date: string; duration: number }
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
