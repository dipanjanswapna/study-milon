
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
  School,
  Phone,
  User as UserIcon,
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
  institution: z.string().min(2, 'Institution name must be at least 2 characters.').or(z.literal('')),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits.').or(z.literal('')),
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
      institution: '',
      phoneNumber: '',
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
            institution: data.institution || '',
            phoneNumber: data.phoneNumber || '',
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
        institution: data.institution,
        phoneNumber: data.phoneNumber,
      });

      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, {
          displayName: data.displayName,
          photoURL: data.photoURL,
        });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your academic identity has been updated successfully.',
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
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
            
            {/* Left Column: Personal Information */}
            <div className="xl:col-span-4 space-y-8">
              <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden bg-card">
                <CardHeader className="bg-primary p-8 md:p-10 pb-16">
                  <div className="flex items-center gap-3 text-primary-foreground/90">
                    <UserIcon className="h-5 w-5" />
                    <CardTitle className="text-xl font-black uppercase tracking-widest">Student Profile</CardTitle>
                  </div>
                </CardHeader>
                
                <CardContent className="px-6 md:px-10 -mt-10">
                  {loading || userLoading ? (
                    <ProfileSkeleton />
                  ) : profile ? (
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-8 bg-card rounded-[2rem] p-6 md:p-10 shadow-xl border"
                    >
                      <div className="flex flex-col items-center space-y-6">
                        <div className="relative group">
                          <Avatar className="h-32 w-32 border-4 border-background shadow-2xl transition-transform duration-300 group-hover:scale-105">
                            <AvatarImage
                              src={profile.photoURL || ''}
                              alt={profile.displayName || ''}
                            />
                            <AvatarFallback className="text-4xl bg-secondary font-black text-primary">
                              {getInitials(profile.displayName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="text-center space-y-1">
                          <h3 className="text-3xl font-black tracking-tighter leading-tight">
                            {profile.displayName}
                          </h3>
                          <Badge variant="outline" className="font-bold text-muted-foreground bg-muted/30">
                            {profile.email}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Label htmlFor="displayName" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Display Name</Label>
                          <Input id="displayName" {...register('displayName')} className="h-12 rounded-xl border-muted bg-muted/10 font-bold focus:bg-background transition-all" />
                          {errors.displayName && (
                            <p className="text-xs text-destructive font-bold mt-1">{errors.displayName.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Label htmlFor="category" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Category</Label>
                            <Controller
                              name="category"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-12 rounded-xl border-muted bg-muted/10 font-bold">
                                    <SelectValue placeholder="Current" />
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
                          <div className="space-y-3">
                            <Label htmlFor="batch" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Batch</Label>
                            <Controller
                              name="batch"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-12 rounded-xl border-muted bg-muted/10 font-bold">
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

                        <div className="space-y-3">
                          <Label htmlFor="institution" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">School / College</Label>
                          <div className="relative">
                            <School className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                            <Input 
                              id="institution" 
                              placeholder="e.g. Dhaka College" 
                              {...register('institution')} 
                              className="h-12 pl-12 rounded-xl border-muted bg-muted/10 font-bold focus:bg-background transition-all" 
                            />
                          </div>
                          {errors.institution && (
                            <p className="text-xs text-destructive font-bold mt-1">{errors.institution.message}</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="phoneNumber" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Mobile Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                            <Input 
                              id="phoneNumber" 
                              placeholder="01XXXXXXXXX" 
                              {...register('phoneNumber')} 
                              className="h-12 pl-12 rounded-xl border-muted bg-muted/10 font-bold focus:bg-background transition-all" 
                            />
                          </div>
                          {errors.phoneNumber && (
                            <p className="text-xs text-destructive font-bold mt-1">{errors.phoneNumber.message}</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="photoURL" className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-1">Profile Photo URL</Label>
                          <Input
                            id="photoURL"
                            placeholder="https://..."
                            {...register('photoURL')}
                            className="h-12 rounded-xl border-muted bg-muted/10 font-bold"
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="w-full h-14 font-black text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          'Save Identity'
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="text-center py-20">
                        <p className="text-muted-foreground">Unable to fetch profile.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[2.5rem] overflow-hidden p-8 md:p-10 space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/20 rounded-2xl">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="text-xl font-black uppercase tracking-widest">The Hustle</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-1">
                      <p className="text-3xl font-black tracking-tight">{todayStudyMinutes}m</p>
                      <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Today</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-1">
                      <p className="text-3xl font-black tracking-tight">{(totalStudyMinutes / 60).toFixed(1)}h</p>
                      <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Total</p>
                    </div>
                  </div>
              </Card>
            </div>

            {/* Right Column: Academic Planning */}
            <div className="xl:col-span-8 space-y-10">
              <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] rounded-[3rem] bg-card overflow-hidden">
                <CardHeader className="p-10 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                         <Book className="h-6 w-6 text-primary" />
                         <CardTitle className="text-4xl font-black tracking-tighter">Academic Roadmap</CardTitle>
                      </div>
                      <CardDescription className="text-lg font-medium text-muted-foreground/80 max-w-lg">
                        Structure your syllabus, track every chapter, and maintain a consistent revision loop.
                      </CardDescription>
                    </div>
                    <SubjectManagementTrigger />
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-10 pt-6">
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
                <Button className="rounded-full shadow-2xl h-14 px-8 text-lg font-black shrink-0 hover:scale-105 active:scale-95 transition-all">
                    <Plus className="mr-2 h-6 w-6" /> Add Subject
                </Button>
            }
            title="Create New Subject"
            onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
    )
}

function ProfileSkeleton() {
    return (
        <div className="space-y-8 py-10">
            <div className="flex flex-col items-center space-y-6">
                <Skeleton className="h-32 w-32 rounded-full" />
                <div className="space-y-3">
                    <Skeleton className="h-6 w-[200px] mx-auto" />
                    <Skeleton className="h-4 w-[150px] mx-auto" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
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
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-[2.5rem]" />
        <Skeleton className="h-32 w-full rounded-[2.5rem]" />
        <Skeleton className="h-32 w-full rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-8">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-32 px-6 border-4 border-dashed rounded-[3.5rem] bg-secondary/10 group hover:bg-secondary/20 transition-all duration-500">
          <div className="mx-auto w-24 h-24 bg-background rounded-full flex items-center justify-center shadow-inner mb-8 group-hover:scale-110 transition-transform">
             <Book className="h-12 w-12 text-muted-foreground/30" />
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-3">Your Roadmap is Blank</h3>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto text-lg leading-relaxed">
            Begin your journey by adding your first subject. Every elite student starts with a clear plan.
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
    <Card className="border-none bg-secondary/10 overflow-hidden rounded-[2.5rem] shadow-sm hover:shadow-xl hover:bg-secondary/20 transition-all duration-500 group/subject">
      <AccordionItem value={subject.id} className="border-0">
        <div className="flex items-center p-8 md:p-10">
          <AccordionTrigger className="hover:no-underline flex-1 py-0 [&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-primary">
            <div className="flex flex-col gap-6 w-full text-left">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-background rounded-3xl shadow-sm group-hover/subject:scale-110 transition-transform">
                        <Book className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <span className="font-black text-3xl tracking-tight block leading-tight">{subject.name}</span>
                        <div className="flex items-center gap-3">
                           <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-background border-none shadow-sm px-3 h-6">
                               {chapters?.length || 0} Modules
                           </Badge>
                           <span className="text-xs font-bold text-muted-foreground italic">
                               Started {new Date(subject.createdAt?.seconds * 1000).toLocaleDateString()}
                           </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-8 pr-10">
                    <div className="flex-1 max-w-[320px]">
                        <Progress value={progress} className="h-3 bg-background/50 shadow-inner" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="font-black text-2xl tracking-tighter text-primary">{Math.round(progress)}%</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mastered</span>
                    </div>
                </div>
            </div>
          </AccordionTrigger>
          <div className="flex items-center gap-3 ml-4">
            <CrudDialog
              trigger={
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-background/50 hover:bg-background shadow-sm hover:shadow-md transition-all">
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
        <AccordionContent className="px-8 md:px-10 pb-10">
          <div className="bg-background rounded-[2rem] p-6 md:p-8 space-y-8 shadow-inner border border-muted/30">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground/60">Module Breakdown</h4>
                <p className="text-sm font-bold text-muted-foreground">Detailed syllabus for this course</p>
              </div>
              <CrudDialog
                trigger={
                  <Button variant="outline" size="lg" className="rounded-2xl font-black h-12 px-6 border-primary/20 hover:border-primary/40 hover:bg-primary/5 shadow-sm">
                    <Plus className="mr-2 h-5 w-5" /> Add Chapter
                  </Button>
                }
                title="Register New Chapter"
                onSubmit={async (name) =>
                  addChapter(firestore, user!.uid, subject.id, name)
                }
              />
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : chapters && chapters.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                    {chapters.map((chapter) => (
                    <ChapterItem
                        key={chapter.id}
                        subjectId={subject.id}
                        chapter={chapter}
                    />
                    ))}
              </ul>
            ) : (
              <div className="text-center py-20 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-muted/40">
                <p className="text-lg font-bold text-muted-foreground/50 italic px-4">
                  Define your learning path by adding chapters to this subject.
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
          description: completed ? "Milestone reached! Chapter conquered. 🏆" : "Status reset.",
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
        toast({ title: 'Marked for Review', description: "This chapter will now appear in your revision cycles." });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error setting to revision' });
      }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
          case 'completed':
            return 'bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/10';
          case 'revision':
            return 'bg-orange-500/5 border-orange-500/20 ring-1 ring-orange-500/10';
          case 'pending':
          default:
            return 'bg-background border-muted shadow-sm';
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
          "flex flex-col gap-4 p-6 rounded-[2rem] border transition-all duration-300 group shadow-sm hover:shadow-xl",
          getStatusStyles(chapter.status)
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <Checkbox
              id={`chapter-${chapter.id}`}
              checked={chapter.status === 'completed'}
              onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
              className="h-7 w-7 rounded-full border-2 transition-transform active:scale-90"
            />
            <label
              htmlFor={`chapter-${chapter.id}`}
              className="flex flex-col cursor-pointer min-w-0"
            >
              <span className={cn(
                  "font-black text-xl tracking-tighter truncate",
                  chapter.status === 'completed' ? 'line-through text-muted-foreground/50' : 'text-foreground'
              )}>{chapter.name}</span>
              <div className="flex items-center gap-3 mt-1">
                 <Badge variant={getBadgeVariant(chapter.status)} className="capitalize text-[10px] h-5 font-black px-2 py-0 tracking-widest">
                    {chapter.status}
                 </Badge>
                 {chapter.revision_count > 0 && (
                    <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Rev #{chapter.revision_count}
                    </span>
                 )}
              </div>
            </label>
          </div>
          <div className="flex items-center gap-2">
             <div className="hidden group-hover:flex items-center gap-2">
                <CrudDialog
                    trigger={
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-background shadow-sm">
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
                            className="h-9 w-9 rounded-xl text-primary shadow-lg shadow-primary/10 border-primary/20"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl p-3 font-bold">
                        <p>Initiate Revision Cycle</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
             )}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground">
                <div className="p-1.5 bg-muted rounded-lg">
                    <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-foreground/80">
                    {chapter.time_spent || 0}m <span className="text-muted-foreground/60">Studied</span>
                </span>
            </div>
            {chapter.last_revision_date && (
                <span className="text-[10px] text-muted-foreground/60 font-black italic tracking-tight">
                    Last: {new Date(chapter.last_revision_date.seconds * 1000).toLocaleDateString()}
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
        title: "Record Updated",
        description: `${title.split(' ')[1]} preserved in database.`,
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
      <DialogContent className="rounded-[3rem] p-10 max-w-md border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black tracking-tighter">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-10 pt-6">
          <div className="space-y-4">
            <Label htmlFor="name" className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground px-1">Identity Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-16 rounded-[1.5rem] text-xl font-bold bg-muted/20 border-muted px-6 focus:bg-background transition-all"
              placeholder="e.g. Higher Math, Organic Chemistry..."
              autoFocus
            />
          </div>
          <DialogFooter className="gap-4">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="font-bold h-14 rounded-2xl flex-1">
                Discard
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading} className="font-black h-14 rounded-2xl px-10 flex-1 shadow-xl shadow-primary/20">
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Save Data
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
      toast({ title: "Removed Successfully", description: `${itemName} is no longer in your roadmap.` });
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
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-destructive/30 hover:text-destructive hover:bg-destructive/5 transition-all">
          <Trash2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[3rem] p-10 max-w-md border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black tracking-tighter text-destructive">Wipe Record?</DialogTitle>
        </DialogHeader>
        <div className="py-8">
            <p className="text-muted-foreground font-semibold text-xl leading-snug">
            Are you certain about removing <strong className="text-foreground">{itemName}</strong>? All associated study hours and progress data will be lost forever.
            </p>
        </div>
        <DialogFooter className="gap-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="font-bold h-14 rounded-2xl flex-1">
              Abort
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="font-black h-14 rounded-2xl px-10 flex-1 shadow-xl shadow-destructive/20"
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Confirm Wipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
