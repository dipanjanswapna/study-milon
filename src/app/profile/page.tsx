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
  Sparkles,
  Settings,
  Settings2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  GripVertical
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
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  photoURL: z.string().url('Please enter a valid URL.').or(z.literal('')),
  category: z.enum(['SSC', 'HSC', 'Admission 1st', 'Admission 2nd', 'Job Prep', 'University']),
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
        description: "To install, open your browser menu and select 'Add to Home Screen'.",
      });
    }
  };

  const showAppleInstructions = () => {
    toast({
      title: "iOS Installation",
      description: "Tap the 'Share' icon and select 'Add to Home Screen'.",
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
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          
          {/* Hero Banner */}
          <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <UserIcon className="h-20 w-20 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-4 md:p-6 relative z-10 space-y-1">
              <div className="space-y-0.5 text-center md:text-left">
                <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Academic Profile</h1>
                <p className="text-white/60 font-medium max-w-xl text-[9px] md:text-xs">
                  Manage your student identity, set daily hustle goals, and build your roadmap.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Form Settings */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="bg-secondary/10 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                      <Settings className="h-4 w-4 text-primary" /> Identity Settings
                    </CardTitle>
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-7 px-3 rounded-lg font-black uppercase tracking-widest text-[8px] bg-background shadow-sm hover:bg-primary hover:text-white transition-all" 
                         asChild
                       >
                          <Link href="/profile/settings">
                             <Settings2 className="mr-1 h-3 w-3" /> Focus Mode
                          </Link>
                       </Button>
                       <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest text-primary border-primary/20">Edit Mode</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {loading || userLoading ? (
                    <ProfileSkeleton />
                  ) : profile ? (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-secondary/30">
                        <div className="relative">
                           <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                              <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName || ''} />
                              <AvatarFallback className="text-xl font-black bg-secondary text-primary">
                                {getInitials(profile.displayName)}
                              </AvatarFallback>
                           </Avatar>
                           <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full shadow-md">
                              <Sparkles className="h-3 w-3" />
                           </div>
                        </div>
                        <div className="text-center sm:text-left space-y-1">
                          <h3 className="text-lg font-black tracking-tight">{profile.displayName}</h3>
                          <p className="text-xs text-muted-foreground font-medium">{profile.email}</p>
                          <div className="flex justify-center sm:justify-start gap-4 pt-2">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Today</span>
                                <span className="text-sm font-black">{profile.daily_study_minutes || 0}m</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Total</span>
                                <span className="text-sm font-black">{( (profile.total_study_minutes || 0) / 60).toFixed(1)}h</span>
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</Label>
                          <Input className="h-10 rounded-lg text-sm font-medium" {...register('displayName')} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                            <Controller
                              name="category"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-10 rounded-lg text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="SSC">SSC</SelectItem>
                                    <SelectItem value="HSC">HSC</SelectItem>
                                    <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                                    <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                                    <SelectItem value="Job Prep">Job Prep</SelectItem>
                                    <SelectItem value="University">University</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Batch</Label>
                            <Controller
                              name="batch"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-10 rounded-lg text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {YEARS.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Religion</Label>
                          <Controller
                            name="religion"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-10 rounded-lg text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Muslim">Muslim</SelectItem>
                                  <SelectItem value="Hindu">Hindu</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Institution</Label>
                          <Input className="h-10 rounded-lg text-sm font-medium" {...register('institution')} placeholder="e.g. Dhaka College" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                          <Input className="h-10 rounded-lg text-sm font-medium" {...register('phoneNumber')} placeholder="01XXXXXXXXX" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Photo URL</Label>
                          <Input className="h-10 rounded-lg text-xs font-medium" {...register('photoURL')} placeholder="https://..." />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-secondary/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="h-4 w-4 text-primary" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Daily Study Goal</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 max-w-sm">
                          <div className="space-y-1.5">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-1">Hours</Label>
                            <Input type="number" className="h-10 rounded-lg text-sm font-bold" {...register('dailyGoalHours')} min="0" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-1">Minutes</Label>
                            <Input type="number" className="h-10 rounded-lg text-sm font-bold" {...register('dailyGoalMinutes')} min="0" max="59" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-secondary/30">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </CardContent>
              </Card>

              {/* App Download Section */}
              <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="bg-primary/5 pb-4 border-b">
                   <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                      <Download className="h-4 w-4 text-primary" /> Focus Everywhere
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                   <div className="grid grid-cols-3 gap-3">
                      <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={showAppleInstructions}>
                         <Apple className="h-6 w-6 group-hover:scale-110 transition-transform" />
                         <span className="text-[8px] font-black uppercase tracking-tighter">iOS</span>
                      </Button>
                      <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={handleInstall}>
                         <Monitor className="h-6 w-6 group-hover:scale-110 transition-transform" />
                         <span className="text-[8px] font-black uppercase tracking-tighter">Windows</span>
                      </Button>
                      <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all group" onClick={handleInstall}>
                         <Smartphone className="h-6 w-6 group-hover:scale-110 transition-transform" />
                         <span className="text-[8px] font-black uppercase tracking-tighter">Android</span>
                      </Button>
                   </div>
                   <div className="mt-4 flex items-center gap-3 p-4 bg-secondary/20 rounded-xl">
                      <Info className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                        Study Milon supports PWA installation. Installing as an app enables background timer protection and offline access.
                      </p>
                   </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Roadmap */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <h2 className="text-base font-black tracking-tighter uppercase leading-none">Academic Roadmap</h2>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Syllabus Overview</p>
                </div>
                <SubjectManagementTrigger />
              </div>

              <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                <div className="p-3 border-b bg-secondary/10 flex items-center justify-between">
                  <h3 className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                     <BookOpen className="h-3 w-3 text-primary" /> Subject Directory
                  </h3>
                </div>
                
                <ScrollArea className="h-[600px]">
                   <div className="p-2">
                      <SubjectManagement />
                   </div>
                </ScrollArea>
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
                <Button size="sm" className="rounded-lg shadow-md h-9 px-4 font-black uppercase tracking-widest text-[9px]">
                    <Plus className="mr-1 h-3 w-3" /> Add Subject
                </Button>
            }
            title="Create New Subject"
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
      <div className="space-y-3 p-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-3">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-20 px-6 space-y-4">
          <div className="bg-secondary/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
              <Book className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <h3 className="text-sm font-black tracking-tighter uppercase text-muted-foreground">Empty Roadmap</h3>
          <p className="text-[10px] text-muted-foreground font-medium">Add subjects to start building your academic sequence.</p>
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
      collection(firestore, 'users', user.uid, 'subjects', subject.id, 'chapters'),
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
    <AccordionItem value={subject.id} className="border rounded-xl bg-card transition-all hover:bg-primary/[0.02]">
      <div className="flex items-center justify-between p-3 sm:p-4">
        <AccordionTrigger className="hover:no-underline flex-1 pr-2">
          <div className="flex flex-col gap-2 w-full text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight truncate">{subject.name}</span>
              <Badge variant="secondary" className="text-[8px] font-black uppercase h-4 px-1.5 shrink-0">{chapters?.length || 0} Chaps</Badge>
            </div>
            <div className="flex items-center gap-3 w-full">
              <Progress value={progress} className="h-1.5 flex-1 bg-secondary" />
              <span className="text-[9px] font-black w-6 text-primary">{Math.round(progress)}%</span>
            </div>
          </div>
        </AccordionTrigger>
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          <CrudDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-full hover:bg-primary/10">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            }
            title="Update Subject Name"
            initialValue={subject.name}
            onSubmit={async (name) => updateSubject(firestore, user!.uid, subject.id, name)}
          />
          <DeleteDialog
            onDelete={async () => deleteSubject(firestore, user!.uid, subject.id)}
            itemName={subject.name}
          />
        </div>
      </div>
      <AccordionContent className="pt-0 border-t border-secondary/30">
        <div className="bg-secondary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Chapters Registry</h4>
            <CrudDialog
              trigger={
                <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg font-black uppercase tracking-widest text-[8px]">
                  <Plus className="mr-1 h-2.5 w-2.5" /> Add New
                </Button>
              }
              title="New Chapter Entry"
              onSubmit={async (name) => addChapter(firestore, user!.uid, subject.id, name)}
            />
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : chapters && chapters.length > 0 ? (
            <ul className="divide-y divide-secondary/30 border rounded-xl overflow-hidden bg-card">
              {chapters.map((chapter) => (
                <ChapterItem
                  key={chapter.id}
                  subjectId={subject.id}
                  chapter={chapter}
                />
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 bg-secondary/10 rounded-xl border border-dashed">
               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Empty Registry</p>
            </div>
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
        toast({ variant: 'destructive', title: 'Status Update Error' });
      }
    };
  
    const handleSetToRevision = async () => {
      if (!user) return;
      try {
        await updateChapterStatus(firestore, user.uid, subjectId, chapter.id, 'revision');
        toast({ title: 'Marked for Revision' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error setting status' });
      }
    };
  
    return (
      <li className={cn(
        "flex items-center justify-between p-3 transition-colors hover:bg-primary/[0.02] group/chap",
        chapter.status === 'completed' && "bg-success/5",
        chapter.status === 'revision' && "bg-orange-500/5"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <Checkbox
            id={`chapter-${chapter.id}`}
            checked={chapter.status === 'completed'}
            onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
            className="h-4 w-4 rounded-full"
          />
          <div className="min-w-0">
            <label
              htmlFor={`chapter-${chapter.id}`}
              className={cn(
                "text-xs font-bold cursor-pointer block truncate tracking-tight",
                chapter.status === 'completed' && "line-through text-muted-foreground opacity-50"
              )}
            >
              {chapter.name}
            </label>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={chapter.status === 'completed' ? 'default' : chapter.status === 'revision' ? 'secondary' : 'outline'} className="text-[7px] px-1 h-3.5 uppercase font-black tracking-tighter">
                {chapter.status}
              </Badge>
              {chapter.revision_count > 0 && (
                <span className="text-[7px] text-primary font-black uppercase tracking-tighter">
                  Rev: {chapter.revision_count}
                </span>
              )}
              {chapter.time_spent > 0 && (
                <span className="text-[7px] text-muted-foreground font-bold tracking-tighter">
                  {chapter.time_spent}m focused
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/chap:opacity-100 transition-opacity">
          <CrudDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary rounded-full hover:bg-primary/10">
                <Edit className="h-3 w-3" />
              </Button>
            }
            title="Edit Chapter Name"
            initialValue={chapter.name}
            onSubmit={async (name) => updateChapter(firestore, user!.uid, subjectId, chapter.id, name)}
          />
          {chapter.status === 'completed' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleSetToRevision} className="h-7 w-7 text-orange-500 rounded-full hover:bg-orange-500/10">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[9px] font-black uppercase">Mark for Revision</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <DeleteDialog
            onDelete={async () => deleteChapter(firestore, user!.uid, subjectId, chapter.id)}
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
      toast({ variant: 'destructive', title: 'Operation Failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => setName(initialValue)}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight uppercase">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entry Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Higher Mathematics"
              className="h-11 rounded-lg text-sm font-medium"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full h-11 font-black rounded-lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Save'}
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
      toast({ variant: 'destructive', title: 'Delete Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-full hover:bg-destructive/10">
          <Trash2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight text-destructive">Confirm Removal</DialogTitle>
        </DialogHeader>
        <div className="py-4">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
            Are you sure you want to permanently remove <strong>{itemName}</strong>? This action cannot be reversed.
            </p>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="rounded-lg h-10 font-bold">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg h-10 font-black uppercase tracking-widest text-[10px]"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Yes, Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
