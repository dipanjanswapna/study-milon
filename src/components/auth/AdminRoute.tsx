
'use client';

import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getUserProfile, SUPER_ADMIN_UID } from '@/firebase/firestore/users';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) {
      return;
    }
    if (!user) {
      router.push('/admin');
      return;
    }

    // Hardcoded safety for the Super Admin
    if (user.uid === SUPER_ADMIN_UID) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    getUserProfile(firestore, user.uid)
      .then((profile) => {
        if (profile?.role === 'admin') {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, userLoading, firestore, router]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  return null;
}
