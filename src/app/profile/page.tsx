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
  MoreVertical,
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
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Card className="overflow-hidden border-none shadow-xl rounded-[2rem]">
                <CardHeader className="bg-primary text-primary-foreground pb-12">
                  <CardTitle className="font-black">Student Profile</CardTitle>
                </CardHeader>
                <CardContent className="-mt-8">
                  {loading || userLoading ? (
                    <ProfileSkeleton />
                  ) : profile ? (
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6 bg-card rounded-[1.5rem] p-6 shadow-lg"
                    >
                      <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                          <AvatarImage
                            src={profile.photoURL || ''}
                            alt={profile.displayName || ''}
                          />
                          <AvatarFallback className="text-3xl bg-secondary font-black">
                            {getInitials(profile.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                          <h3 className="text-2xl font-black tracking-tight">
                            {profile.displayName}
                          </h3>
                          <p className="text-muted-foreground text-sm font-medium">
                            {profile.email}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Display Name</Label>
                          <Input id="displayName" {...register('displayName')} className="h-11 rounded-xl" />
                          {errors.displayName && (
                            <p className="text-xs text-destructive font-bold">{errors.displayName.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
                            <Controller
                              name="category"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SSC">SSC</SelectItem>
                                    <SelectItem value="HSC">HSC</SelectItem>
                                    <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                                    <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                                    <SelectItem value="Job Prep">Job Prep</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="batch" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Batch</Label>
                            <Controller
                              name="batch"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-11 rounded-xl">
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
                          <Label htmlFor="photoURL" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Photo URL</Label>
                          <Input
                            id="photoURL"
                            placeholder="https://example.com/avatar.png"
                            {...register('photoURL')}
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-black rounded-xl shadow-lg shadow-primary/20">
                        {isSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Profile
                      </Button>
                    </form>
                  ) : (
                    <p>Could not load profile.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-[#1E293B] text-white rounded-[2rem] overflow-hidden">
                <CardHeader className="p-6">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Focus Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-2xl font-black tracking-tight">{todayStudyMinutes}m</p>
                      <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Today's Effort</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-2xl font-black tracking-tight">{(totalStudyMinutes / 60).toFixed(1)}h</p>
                      <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Total Hustle</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-xl rounded-[2.5rem] bg-card overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-3xl font-black tracking-tighter">My Study Plan</CardTitle>
                      <CardDescription className="font-medium">
                        Map out your subjects and chapters to dominate your exams.
                      </CardDescription>
                    </div>
                    <SubjectManagementTrigger />
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-8">
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

function SubjectManagementTrigger() {
    const { user } = useUser();
    const firestore = useFirestore();
    return (
        <CrudDialog
            trigger={
                <Button className="rounded-full shadow-lg h-12 px-6 font-black shrink-0">
                    <Plus className="mr-2 h-5 w-5" /> Subject
                </Button>
            }
            title="Add New Subject"
            onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
    )
}

function ProfileSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
                <Skeleton className="h-28 w-28 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
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
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-6">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-24 border-2 border-dashed rounded-[3rem] bg-secondary/10">
          <Book className="mx-auto h-16 w-16 text-muted-foreground/20 mb-6" />
          <h3 className="text-xl font-bold mb-2">Your shelf is empty</h3>
          <p className="text-muted-foreground font-medium max-w-xs mx-auto">
            Add your first subject to start building your customized study plan.
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
    <Card className="border-none bg-secondary/20 overflow-hidden rounded-[2rem] shadow-sm hover:shadow-md transition-all duration-300">
      <AccordionItem value={subject.id} className="border-0">
        <div className="flex items-center p-6 md:p-8">
          <AccordionTrigger className="hover:no-underline flex-1 py-0">
            <div className="flex flex-col gap-4 w-full text-left">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <Book className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                        <span className="font-black text-2xl tracking-tight block leading-tight">{subject.name}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            {chapters?.length || 0} Chapters
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex-1 max-w-[240px]">
                        <Progress value={progress} className="h-2.5 bg-background" />
                    </div>
                    <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-widest px-3 h-6">
                        {Math.round(progress)}% Mastery
                    </Badge>
                </div>
            </div>
          </AccordionTrigger>
          <div className="flex items-center gap-2 ml-4">
            <CrudDialog
              trigger={
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-background/50 hover:bg-background shadow-sm">
                  <Edit className="h-5 w-5 text-muted-foreground" />
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
        <AccordionContent className="px-6 md:px-8 pb-8">
          <div className="border-t border-muted/50 pt-8 space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground">Detailed Syllabus</h4>
              <CrudDialog
                trigger={
                  <Button variant="outline" size="sm" className="rounded-full font-bold h-9 px-4 border-primary/20 hover:border-primary/40">
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
              <Skeleton className="h-12 w-full rounded-2xl" />
            ) : chapters && chapters.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {chapters.map((chapter) => (
                    <ChapterItem
                        key={chapter.id}
                        subjectId={subject.id}
                        chapter={chapter}
                    />
                    ))}
              </ul>
            ) : (
              <div className="text-center py-12 bg-background/50 rounded-3xl border-2 border-dashed border-muted/50">
                <p className="text-sm font-bold text-muted-foreground/60 italic">
                  No chapters defined for this subject.
                </p>
              </div>
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
          description: completed ? "Chapter conquered! 🏆" : "Chapter status updated.",
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
        toast({ title: 'Marked for Revision' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error setting to revision' });
      }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
          case 'completed':
            return 'bg-success/5 border-success/20';
          case 'revision':
            return 'bg-orange-500/5 border-orange-500/20';
          case 'pending':
          default:
            return 'bg-card border-transparent';
        }
    };

    const getBadgeVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'revision': return 'secondary';
            default: return 'outline';
        }
    }
  
    return (
      <li className={cn(
          "flex flex-col gap-4 p-5 rounded-[1.5rem] border transition-all duration-300 group shadow-sm hover:shadow-md",
          getStatusStyles(chapter.status)
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <Checkbox
              id={`chapter-${chapter.id}`}
              checked={chapter.status === 'completed'}
              onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
              className="h-6 w-6 rounded-full border-2"
            />
            <label
              htmlFor={`chapter-${chapter.id}`}
              className="flex flex-col cursor-pointer min-w-0"
            >
              <span className={cn(
                  "font-black text-base tracking-tight truncate",
                  chapter.status === 'completed' ? 'line-through text-muted-foreground/60' : 'text-foreground'
              )}>{chapter.name}</span>
              <div className="flex items-center gap-2 mt-1">
                 <Badge variant={getBadgeVariant(chapter.status)} className="capitalize text-[9px] h-4 font-black px-1.5 py-0">
                    {chapter.status}
                 </Badge>
                 {chapter.revision_count > 0 && (
                    <span className="text-[9px] text-primary font-black uppercase tracking-wider">
                        Rev #{chapter.revision_count}
                    </span>
                 )}
              </div>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
             <div className="hidden group-hover:flex items-center gap-1">
                <CrudDialog
                    trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-background">
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
             {chapter.status === 'completed' && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={handleSetToRevision}
                            className="h-8 w-8 rounded-lg text-primary shadow-sm"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                        <p className="font-bold">Mark for Revision</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
             )}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-muted/50">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {chapter.time_spent || 0}m Studied
                </span>
            </div>
            {chapter.last_revision_date && (
                <span className="text-[9px] text-muted-foreground/60 font-bold italic">
                    Last Rev: {new Date(chapter.last_revision_date.seconds * 1000).toLocaleDateString()}
                </span>
            )}
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
        description: `${title.split(' ')[1]} saved successfully.`,
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
      <DialogContent className="rounded-[2.5rem] p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-8 pt-4">
          <div className="space-y-3">
            <Label htmlFor="name" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 rounded-2xl text-lg font-bold"
              placeholder="e.g. Physics, Calculus, etc."
              autoFocus
            />
          </div>
          <DialogFooter className="gap-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="font-bold h-12 rounded-xl">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading} className="font-black h-12 rounded-xl px-8 shadow-lg shadow-primary/20">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Item
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
      toast({ title: "Deleted", description: `${itemName} removed from plan.` });
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
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors">
          <Trash2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[2.5rem] p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-destructive">Delete Entry</DialogTitle>
        </DialogHeader>
        <div className="py-6">
            <p className="text-muted-foreground font-medium text-lg leading-relaxed">
            Are you sure you want to remove <strong className="text-foreground">{itemName}</strong>? This will permanently erase all progress data for this entry.
            </p>
        </div>
        <DialogFooter className="gap-3">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="font-bold h-12 rounded-xl">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="font-black h-12 rounded-xl px-8 shadow-lg shadow-destructive/20"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
