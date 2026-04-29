'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useAuth, useFirestore, useUser, useCollection } from '@/firebase';
import { updateUserProfile } from '@/firebase/firestore/users';
import { updateProfile as updateAuthProfile } from 'firebase/auth';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Book, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { StudySession } from '@/firebase/firestore/studySessions';
import { startOfDay } from 'date-fns';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  photoURL: z.string().url('Please enter a valid URL.').or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type UserProfile = {
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: any;
  role?: 'student' | 'admin';
  subjects?: string[];
};

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState('');

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions')
    );
  }, [user, firestore]);

  const { data: sessions, loading: sessionsLoading } =
    useCollection<StudySession>(sessionsQuery);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          reset({
            displayName: data.displayName || '',
            photoURL: data.photoURL || '',
          });
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, firestore, reset, userLoading]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    try {
      await updateUserProfile(firestore, user.uid, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      });

      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, {
          displayName: data.displayName,
          photoURL: data.photoURL,
        });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubject.trim() === '' || !user) return;
    const userRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        subjects: arrayUnion(newSubject.trim()),
      });
      setNewSubject('');
      toast({ title: 'Subject added!' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error adding subject',
        description: error.message,
      });
    }
  };

  const handleRemoveSubject = async (subjectToRemove: string) => {
    if (!user) return;
    const userRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        subjects: arrayRemove(subjectToRemove),
      });
      toast({ title: 'Subject removed' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error removing subject',
        description: error.message,
      });
    }
  };

  const { totalStudyMinutes, todayStudyMinutes } = useMemo(() => {
    if (!sessions) return { totalStudyMinutes: 0, todayStudyMinutes: 0 };
    const today = startOfDay(new Date());
    const total = sessions.reduce((acc, s) => acc + s.duration, 0);
    const todayTotal = sessions
      .filter((s) => s.createdAt && s.createdAt.toDate() >= today)
      .reduce((acc, s) => acc + s.duration, 0);
    return { totalStudyMinutes: total, todayStudyMinutes: todayTotal };
  }, [sessions]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                  <CardDescription>
                    Manage your account settings and profile information.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading || userLoading ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  ) : profile ? (
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-24 w-24">
                          <AvatarImage
                            src={profile.photoURL || ''}
                            alt={profile.displayName || ''}
                          />
                          <AvatarFallback className="text-3xl">
                            {getInitials(profile.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-xl font-bold">
                            {profile.displayName}
                          </h3>
                          <p className="text-muted-foreground">
                            {profile.email}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" {...register('displayName')} />
                        {errors.displayName && (
                          <p className="text-sm text-destructive">
                            {errors.displayName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="photoURL">Photo URL</Label>
                        <Input
                          id="photoURL"
                          placeholder="https://example.com/avatar.png"
                          {...register('photoURL')}
                        />
                        {errors.photoURL && (
                          <p className="text-sm text-destructive">
                            {errors.photoURL.message}
                          </p>
                        )}
                      </div>

                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                      </Button>
                    </form>
                  ) : (
                    <p>Could not load profile.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Subjects</CardTitle>
                  <CardDescription>
                    Add and manage your study subjects.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddSubject} className="flex gap-2">
                    <Input
                      placeholder="Add a new subject"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                    />
                    <Button type="submit" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile?.subjects?.map((subject) => (
                      <Badge key={subject} variant="secondary" className="pl-2">
                        {subject}
                        <button
                          onClick={() => handleRemoveSubject(subject)}
                          className="ml-1 rounded-full p-0.5 hover:bg-destructive/50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Study Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sessionsLoading ? (
                    <>
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">
                            {todayStudyMinutes.toLocaleString()} min
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Today&apos;s Study
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Book className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">
                            {(totalStudyMinutes / 60).toFixed(1)} hrs
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Total Study Time
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
