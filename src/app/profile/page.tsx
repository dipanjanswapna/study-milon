'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { useAuth, useFirestore, useUser, useCollection } from '@/firebase';
import { updateUserProfile } from '@/firebase/firestore/users';
import {
  addSubject,
  updateSubject,
  deleteSubject,
  addChapter,
  updateChapter,
  deleteChapter,
  updateChapterStatus,
} from '@/firebase/firestore/hierarchy';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Book,
  Clock,
  Plus,
  Edit,
  Trash2,
  Folder,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  total_study_minutes?: number;
  daily_study_minutes?: number;
};

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const totalStudyMinutes = profile?.total_study_minutes || 0;
  const todayStudyMinutes = profile?.daily_study_minutes || 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading || userLoading ? (
                    <ProfileSkeleton />
                  ) : profile ? (
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24">
                          <AvatarImage
                            src={profile.photoURL || ''}
                            alt={profile.displayName || ''}
                          />
                          <AvatarFallback className="text-3xl">
                            {getInitials(profile.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
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

                      <Button type="submit" disabled={isSubmitting} className="w-full">
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
                  <CardTitle>Study Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading || userLoading ? (
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
                            Today's Study
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

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>My Study Plan</CardTitle>
                  <CardDescription>
                    Organize your learning by adding subjects and chapters.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubjectManagement />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function ProfileSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    )
}

function SubjectManagement() {
  const { user } = useUser();
  const firestore = useFirestore();

  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'subjects'),
      orderBy('createdAt', 'asc')
    );
  }, [user, firestore]);

  const { data: subjects, loading } = useCollection(subjectsQuery);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-right">
        <CrudDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          }
          title="Add New Subject"
          onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
      </div>
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-2">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          No subjects added yet. Click "Add Subject" to start.
        </p>
      )}
    </div>
  );
}

function SubjectItem({ subject }: { subject: any }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const chaptersQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(
        firestore,
        'users',
        user.uid,
        'subjects',
        subject.id,
        'chapters'
      ),
      orderBy('createdAt', 'asc')
    );
  }, [user, firestore, subject.id]);

  const { data: chapters, loading } = useCollection(chaptersQuery);

  const progress = useMemo(() => {
    if (!chapters || chapters.length === 0) return 0;
    const completed = chapters.filter(c => c.status === 'completed').length;
    return (completed / chapters.length) * 100;
  }, [chapters]);

  return (
    <Card>
      <AccordionItem value={subject.id} className="border-0">
        <div className="flex items-center p-4">
          <AccordionTrigger className="hover:no-underline flex-1 py-0">
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-3">
                    <Book className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">{subject.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Progress value={progress} className="w-24 h-1.5" />
                    <span className="text-xs text-muted-foreground">{Math.round(progress)}% complete</span>
                </div>
            </div>
          </AccordionTrigger>
          <div className="flex items-center gap-1">
            <CrudDialog
              trigger={
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
              }
              title="Edit Subject"
              initialValue={subject.name}
              onSubmit={async (name) =>
                updateSubject(firestore, user!.uid, subject.id, name)
              }
            />
            <DeleteDialog
              onDelete={async () =>
                deleteSubject(firestore, user!.uid, subject.id)
              }
              itemName={subject.name}
            />
          </div>
        </div>
        <AccordionContent className="px-4 pb-4">
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">Chapters</h4>
              <CrudDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Chapter
                  </Button>
                }
                title="Add New Chapter"
                onSubmit={async (name) =>
                  addChapter(firestore, user!.uid, subject.id, name)
                }
              />
            </div>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : chapters && chapters.length > 0 ? (
                <ul className="space-y-2">
                    {chapters.map((chapter) => (
                    <ChapterItem
                        key={chapter.id}
                        subjectId={subject.id}
                        chapter={chapter}
                    />
                    ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                No chapters yet.
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Card>
  );
}

function ChapterItem({ subjectId, chapter }: { subjectId: string; chapter: any }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
  
    const handleStatusChange = async (completed: boolean) => {
      if (!user) return;
      const newStatus = completed ? 'completed' : 'pending';
      try {
        await updateChapterStatus(firestore, user.uid, subjectId, chapter.id, newStatus);
        toast({
          title: `Chapter marked as ${newStatus}${
            chapter.status === 'revision' && newStatus === 'completed'
              ? '. Revision complete!'
              : ''
          }`,
        });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error updating status' });
      }
    };
  
    const handleSetToRevision = async () => {
      if (!user) return;
      try {
        await updateChapterStatus(
          firestore,
          user.uid,
          subjectId,
          chapter.id,
          'revision'
        );
        toast({ title: 'Chapter marked for revision' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error setting to revision' });
      }
    };

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
          case 'completed':
            return 'default';
          case 'revision':
            return 'secondary';
          case 'pending':
          default:
            return 'outline';
        }
      };
  
    return (
      <li className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group bg-secondary/50">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`chapter-${chapter.id}`}
            checked={chapter.status === 'completed'}
            onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
          />
          <label
            htmlFor={`chapter-${chapter.id}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Folder className="h-5 w-5 text-muted-foreground" />
            <span className={chapter.status === 'completed' ? 'line-through text-muted-foreground' : ''}>{chapter.name}</span>
            {chapter.revision_count > 0 && (
              <span className="text-xs text-muted-foreground">
                (rev: {chapter.revision_count})
              </span>
            )}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(chapter.status)} className="capitalize">
            {chapter.status}
          </Badge>
  
          {chapter.status === 'completed' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSetToRevision}
                    className="h-8 w-8"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark for Revision</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
  
          <CrudDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
              >
                <Edit className="h-4 w-4" />
              </Button>
            }
            title="Edit Chapter"
            initialValue={chapter.name}
            onSubmit={async (name) =>
              updateChapter(firestore, user!.uid, subjectId, chapter.id, name)
            }
          />
          <DeleteDialog
            onDelete={async () =>
              deleteChapter(firestore, user!.uid, subjectId, chapter.id)
            }
            itemName={chapter.name}
          />
        </div>
      </li>
    );
  }

// Reusable dialog for Create/Update operations
function CrudDialog({
  trigger,
  title,
  initialValue = '',
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  initialValue?: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim());
      toast({
        title: `${title.split(' ')[1]} ${
          initialValue ? 'updated' : 'added'
        }!`,
      });
      setName('');
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => setName(initialValue)}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Reusable dialog for Delete confirmation
function DeleteDialog({
  onDelete,
  itemName,
}: {
  onDelete: () => Promise<void>;
  itemName: string;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      toast({ title: `${itemName} deleted.` });
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p>
          This action cannot be undone. This will permanently delete the
          <strong> {itemName}</strong> and all its contents.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
