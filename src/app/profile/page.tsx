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
  CardFooter,
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
  School,
  Phone,
  User as UserIcon,
  Target,
  Download,
  Apple,
  Monitor,
  Smartphone,
  Info,
  Sparkles
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
  religion: z.enum(['Muslim', 'Hindu']),
  batch: z.string().min(1, 'Batch is required.'),
  institution: z.string().min(2, 'Institution name must be at least 2 characters.').or(z.literal('')),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits.').or(z.literal('')),
  dailyGoalHours: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 0, 'Invalid hours'),
  dailyGoalMinutes: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) < 60, 'Invalid minutes'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type UserProfile = {
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: any;
  role?: 'student' | 'admin';
  religion?: 'Muslim' | 'Hindu';
  total_study_minutes?: number;
  daily_study_minutes?: number;
  daily_goal_minutes?: number;
  category?: string;
  batch?: string;
  institution?: string;
  phoneNumber?: string;
};

const YEARS = Array.from({ length: 18 }, (_, i) => (2023 + i).toString());

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
      religion: 'Muslim',
      batch: '2026',
      institution: '',
      phoneNumber: '',
      dailyGoalHours: '6',
      dailyGoalMinutes: '0',
    }
  });

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      toast({
        title: "PWA Installation",
        description: "To install, open your browser menu (usually three dots or share icon) and select 'Add to Home Screen' or 'Install App'.",
      });
    }
  };

  const showAppleInstructions = () => {
    toast({
      title: "iOS Installation",
      description: "Tap the 'Share' icon (square with arrow) and select 'Add to Home Screen' to install Study Milon.",
    });
  };

  useEffect(() => {
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          
          const totalGoal = data.daily_goal_minutes || 360;
          const h = Math.floor(totalGoal / 60);
          const m = totalGoal % 60;

          reset({
            displayName: data.displayName || '',
            photoURL: data.photoURL || '',
            category: (data.category as any) || 'HSC',
            religion: data.religion || 'Muslim',
            batch: data.batch || '2026',
            institution: data.institution || '',
            phoneNumber: data.phoneNumber || '',
            dailyGoalHours: h.toString(),
            dailyGoalMinutes: m.toString(),
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
      const daily_goal_minutes = (parseInt(data.dailyGoalHours) * 60) + parseInt(data.dailyGoalMinutes);

      await updateUserProfile(firestore, user.uid, {
        displayName: data.displayName,
        photoURL: data.photoURL,
        religion: data.religion,
        category: data.category as any,
        batch: data.batch,
        institution: data.institution,
        phoneNumber: data.phoneNumber,
        daily_goal_minutes: daily_goal_minutes,
      });

      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, {
          displayName: data.displayName,
          photoURL: data.photoURL,
        });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your academic identity and goals have been updated successfully.',
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
      .join('')
      .substring(0, 2);
  };

  const totalStudyMinutes = profile?.total_study_minutes || 0;
  const todayStudyMinutes = profile?.daily_study_minutes || 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Personal Information Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <CardTitle>Academic Profile</CardTitle>
                </div>
                <CardDescription>
                  Manage your student identity and academic details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading || userLoading ? (
                  <ProfileSkeleton />
                ) : profile ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="flex items-center gap-6 pb-6 border-b">
                      <Avatar className="h-20 w-20 border">
                        <AvatarImage src={profile.photoURL || ''} alt={profile.displayName || ''} />
                        <AvatarFallback className="text-xl font-bold bg-secondary text-primary">
                          {getInitials(profile.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold">{profile.displayName}</h3>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                        <div className="flex gap-4 pt-2">
                          <div className="text-xs">
                            <span className="font-bold text-primary">{todayStudyMinutes}m</span>
                            <span className="text-muted-foreground ml-1">Today</span>
                          </div>
                          <div className="text-xs">
                            <span className="font-bold text-primary">{(totalStudyMinutes / 60).toFixed(1)}h</span>
                            <span className="text-muted-foreground ml-1">Total</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" {...register('displayName')} placeholder="Your name" />
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
                                <SelectTrigger>
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
                          <Label htmlFor="batch">Batch</Label>
                          <Controller
                            name="batch"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
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
                        <Label htmlFor="religion">Religion (For Dashboard Widget)</Label>
                        <Controller
                          name="religion"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <SelectValue placeholder="Select Religion" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Muslim">Muslim</SelectItem>
                                <SelectItem value="Hindu">Hindu</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="institution">School / College</Label>
                        <div className="relative">
                          <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="institution" className="pl-9" placeholder="e.g. Dhaka College" {...register('institution')} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Mobile Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="phoneNumber" className="pl-9" placeholder="01XXXXXXXXX" {...register('phoneNumber')} />
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="photoURL">Profile Photo URL</Label>
                        <Input id="photoURL" placeholder="https://..." {...register('photoURL')} />
                      </div>
                    </div>

                    {/* Daily Goal Section */}
                    <div className="pt-6 border-t">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-bold uppercase tracking-wider">Daily Study Goal</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dailyGoalHours">Hours</Label>
                          <Input id="dailyGoalHours" type="number" {...register('dailyGoalHours')} min="0" />
                          {errors.dailyGoalHours && <p className="text-xs text-destructive">{errors.dailyGoalHours.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dailyGoalMinutes">Minutes</Label>
                          <Input id="dailyGoalMinutes" type="number" {...register('dailyGoalMinutes')} min="0" max="59" />
                          {errors.dailyGoalMinutes && <p className="text-xs text-destructive">{errors.dailyGoalMinutes.message}</p>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Setting a daily goal helps us track your progress on the dashboard.
                      </p>
                    </div>

                    {/* Download App Section */}
                    <div className="pt-8 border-t">
                      <div className="flex items-center gap-2 mb-4">
                        <Download className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-bold uppercase tracking-wider">Download App</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={showAppleInstructions}>
                            <Apple className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Apple</span>
                         </Button>
                         <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={handleInstall}>
                            <Monitor className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Windows</span>
                         </Button>
                         <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={handleInstall}>
                            <Smartphone className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Android</span>
                         </Button>
                      </div>
                      <div className="mt-4 flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
                         <Info className="h-4 w-4 text-primary shrink-0" />
                         <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            Study Milon supports PWA installation. After installing, the app will work offline and the timer will run more accurately.
                         </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Profile & Goals
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Profile not found.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Academic Planning Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Book className="h-5 w-5 text-primary" />
                    <CardTitle>Academic Roadmap</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your subjects and track chapter progress.
                  </CardDescription>
                </div>
                <SubjectManagementTrigger />
              </CardHeader>
              <CardContent>
                <SubjectManagement />
              </CardContent>
            </Card>

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
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Subject
                </Button>
            }
            title="Add Subject"
            onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
    )
}

function ProfileSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-60" />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
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
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-secondary/10">
          <Book className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
          <h3 className="font-semibold">No subjects added</h3>
          <p className="text-sm text-muted-foreground mb-4">Start by adding your first subject.</p>
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
    <AccordionItem value={subject.id} className="border rounded-lg px-4 bg-secondary/5">
      <div className="flex items-center justify-between py-2">
        <AccordionTrigger className="hover:no-underline flex-1 pr-4">
          <div className="flex flex-col gap-2 w-full text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">{subject.name}</span>
              <span className="text-xs text-muted-foreground font-medium">{chapters?.length || 0} Chapters</span>
            </div>
            <div className="flex items-center gap-4 w-full">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-xs font-bold w-8">{Math.round(progress)}%</span>
            </div>
          </div>
        </AccordionTrigger>
        <div className="flex items-center gap-1 ml-2">
          <CrudDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8">
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
      <AccordionContent className="pt-4">
        <div className="bg-background rounded-lg p-4 space-y-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chapters</h4>
            <CrudDialog
              trigger={
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="mr-2 h-4 w-4" /> Add Chapter
                </Button>
              }
              title="Add Chapter"
              onSubmit={async (name) =>
                addChapter(firestore, user!.uid, subject.id, name)
              }
            />
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : chapters && chapters.length > 0 ? (
            <ul className="grid gap-3">
              {chapters.map((chapter) => (
                <ChapterItem
                  key={chapter.id}
                  subjectId={subject.id}
                  chapter={chapter}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 italic">
              No chapters registered.
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
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
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error updating status' });
      }
    };
  
    const handleSetToRevision = async () => {
      if (!user) return;
      try {
        await updateChapterStatus(firestore, user.uid, subjectId, chapter.id, 'revision');
        toast({ title: 'Marked for Revision' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error setting to revision' });
      }
    };
  
    return (
      <li className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-card transition-colors",
        chapter.status === 'completed' && "bg-success/5 border-success/20",
        chapter.status === 'revision' && "bg-orange-500/5 border-orange-500/20"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <Checkbox
            id={`chapter-${chapter.id}`}
            checked={chapter.status === 'completed'}
            onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
          />
          <div className="min-w-0">
            <label
              htmlFor={`chapter-${chapter.id}`}
              className={cn(
                "text-sm font-semibold cursor-pointer block truncate",
                chapter.status === 'completed' && "line-through text-muted-foreground"
              )}
            >
              {chapter.name}
            </label>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={chapter.status === 'completed' ? 'default' : chapter.status === 'revision' ? 'secondary' : 'outline'} className="text-[9px] px-1.5 h-4 uppercase">
                {chapter.status}
              </Badge>
              {chapter.revision_count > 0 && (
                <span className="text-[9px] text-primary font-bold">
                  Rev: {chapter.revision_count}
                </span>
              )}
              {chapter.time_spent > 0 && (
                <span className="text-[9px] text-muted-foreground">
                  {chapter.time_spent}m
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CrudDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Edit className="h-3 w-3" />
              </Button>
            }
            title="Edit Chapter"
            initialValue={chapter.name}
            onSubmit={async (name) =>
              updateChapter(firestore, user!.uid, subjectId, chapter.id, name)
            }
          />
          {chapter.status === 'completed' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleSetToRevision} className="h-7 w-7 text-primary">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark for Revision</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
      setOpen(false);
      setName('');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
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
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Confirmation</DialogTitle>
        </DialogHeader>
        <div className="py-4">
            <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
            </p>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
