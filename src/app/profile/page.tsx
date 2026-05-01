
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Book,
  Clock,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  photoURL: z.string().url('Please enter a valid URL.').or(z.literal('')),
  category: z.enum(['SSC', 'HSC', 'Admission 1st', 'Admission 2nd', 'Job Prep']),
  batch: z.string().min(1, 'Batch is required.'),
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
  category?: string;
  batch?: string;
};

const YEARS = Array.from({ length: 18 }, (_, i) => (2023 + i).toString());

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
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      category: 'HSC',
      batch: '2026',
    }
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
            category: (data.category as any) || 'HSC',
            batch: data.batch || '2026',
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
        category: data.category as any,
        batch: data.batch,
      });

      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, {
          displayName: data.displayName,
          photoURL: data.photoURL,
        });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your changes have been saved.',
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
            <div className="lg:col-span-1 space-y-6">
              <Card className="overflow-hidden border-none shadow-xl">
                <CardHeader className="bg-primary text-primary-foreground pb-8">
                  <CardTitle>Student Profile</CardTitle>
                </Header>
                <CardContent className="-mt-6">
                  {loading || userLoading ? (
                    <ProfileSkeleton />
                  ) : profile ? (
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                          <AvatarImage
                            src={profile.photoURL || ''}
                            alt={profile.displayName || ''}
                          />
                          <AvatarFallback className="text-3xl bg-secondary">
                            {getInitials(profile.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                          <h3 className="text-2xl font-black tracking-tight">
                            {profile.displayName}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {profile.email}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Display Name</Label>
                          <Input id="displayName" {...register('displayName')} className="h-11" />
                          {errors.displayName && (
                            <p className="text-xs text-destructive">{errors.displayName.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Controller
                              name="category"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SSC">SSC</SelectItem>
                                    <SelectItem value="HSC">HSC</SelectItem>
                                    <SelectItem value="Admission 1st">Admission 1st Time</SelectItem>
                                    <SelectItem value="Admission 2nd">Admission 2nd Time</SelectItem>
                                    <SelectItem value="Job Prep">Job Prep</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="batch">Batch / Year</Label>
                            <Controller
                              name="batch"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Year" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {YEARS.map(year => (
                                      <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="photoURL">Photo URL</Label>
                          <Input
                            id="photoURL"
                            placeholder="https://example.com/avatar.png"
                            {...register('photoURL')}
                            className="h-11"
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold rounded-xl shadow-lg">
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

              <Card className="border-none shadow-lg bg-[#1E293B] text-white">
                <CardHeader>
                  <CardTitle className="text-lg">Study Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl">
                      <p className="text-xl font-bold">{todayStudyMinutes}m</p>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Today</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl">
                      <p className="text-xl font-bold">{(totalStudyMinutes / 60).toFixed(1)}h</p>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-xl rounded-[2rem]">
                <CardHeader className="p-8 pb-0">
                  <CardTitle className="text-2xl font-black">My Study Plan</CardTitle>
                  <CardDescription>
                    Organize your academic goals by adding subjects and chapters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
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
      <div className="mb-6 flex justify-end">
        <CrudDialog
          trigger={
            <Button className="rounded-full shadow-lg h-11 px-6">
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          }
          title="Add New Subject"
          onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
      </div>
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-[2rem] bg-secondary/20">
          <Book className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">
            No subjects added yet. Start by adding your first subject.
          </p>
        </div>
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
    <Card className="border-none bg-secondary/30 overflow-hidden rounded-2xl">
      <AccordionItem value={subject.id} className="border-0">
        <div className="flex items-center p-4 md:p-6">
          <AccordionTrigger className="hover:no-underline flex-1 py-0">
            <div className="flex flex-col gap-3 w-full text-left">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Book className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">{subject.name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <Progress value={progress} className="w-32 h-2" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{Math.round(progress)}% done</span>
                </div>
            </div>
          </AccordionTrigger>
          <div className="flex items-center gap-1">
            <CrudDialog
              trigger={
                <Button variant="ghost" size="icon" className="h-10 w-10">
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
        <AccordionContent className="px-6 pb-6">
          <div className="border-t border-secondary-foreground/10 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Chapters</h4>
              <CrudDialog
                trigger={
                  <Button variant="outline" size="sm" className="rounded-full">
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
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {chapters.map((chapter) => (
                    <ChapterItem
                        key={chapter.id}
                        subjectId={subject.id}
                        chapter={chapter}
                    />
                    ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8 bg-background/50 rounded-xl italic">
                No chapters added to this subject yet.
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
          title: `Status: ${newStatus}`,
          description: completed ? "Chapter completed! 🚀" : "Status updated.",
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
      <li className="flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all group bg-background/60 border border-transparent hover:border-primary/20 shadow-sm">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`chapter-${chapter.id}`}
            checked={chapter.status === 'completed'}
            onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
            className="rounded-full"
          />
          <label
            htmlFor={`chapter-${chapter.id}`}
            className="flex flex-col cursor-pointer"
          >
            <span className={cn(
                "font-bold text-sm",
                chapter.status === 'completed' ? 'line-through text-muted-foreground' : ''
            )}>{chapter.name}</span>
            {chapter.revision_count > 0 && (
              <span className="text-[10px] text-primary font-black uppercase">
                Revision #{chapter.revision_count}
              </span>
            )}
          </label>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={getStatusBadgeVariant(chapter.status)} className="capitalize text-[10px] h-5 px-1.5">
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
                    className="h-8 w-8 text-primary"
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
        title: "Success",
        description: `${title.split(' ')[1]} has been saved.`,
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
      <DialogContent className="rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading} className="font-bold">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
      toast({ title: "Deleted", description: `${itemName} has been removed.` });
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
        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive/50 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>Delete Confirmation</DialogTitle>
        </DialogHeader>
        <div className="py-4">
            <p className="text-muted-foreground">
            Are you sure you want to delete <strong>{itemName}</strong>? This will permanently remove all associated data.
            </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="font-bold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
