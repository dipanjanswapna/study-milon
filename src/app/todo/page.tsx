'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';
import { collection, query, where, orderBy, getDocs, doc } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { addStudyTask, updateTaskStatus, deleteTask, type StudyTask } from '@/firebase/firestore/todo';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Sparkles,
  BrainCircuit,
  Lightbulb
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { suggestSchedule, type SuggestScheduleOutput } from '@/ai/flows/suggest-schedule-flow';

export default function TodoPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<SuggestScheduleOutput | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // User Profile for context
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  // Month tasks query
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthTasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
      where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
    );
  }, [user, firestore, currentMonth]);
  const { data: monthTasks } = useCollection<StudyTask>(monthTasksQuery);

  // Day tasks query
  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', dateStr)
    );
  }, [user, firestore, dateStr]);

  const { data: rawTasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  const tasks = useMemo(() => {
    if (!rawTasks) return null;
    return [...rawTasks].sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });
  }, [rawTasks]);

  // Form State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [plannedHours, setPlannedHours] = useState<string>('0');
  const [plannedMinutes, setPlannedMinutes] = useState<string>('25');

  // Subjects & Chapters
  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects'), orderBy('createdAt', 'asc'));
  }, [user, firestore]);
  const { data: subjects } = useCollection(subjectsQuery);

  const chaptersQuery = useMemo(() => {
    if (!user || !selectedSubject) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects', selectedSubject, 'chapters'), orderBy('createdAt', 'asc'));
  }, [user, firestore, selectedSubject]);
  const { data: chapters } = useCollection(chaptersQuery);

  const handleAddTask = async () => {
    if (!user || !selectedSubject || !selectedChapter) return;
    
    const subject = subjects?.find(s => s.id === selectedSubject);
    const chapter = chapters?.find(c => c.id === selectedChapter);

    if (!subject || !chapter) return;

    const totalMinutes = (parseInt(plannedHours, 10) || 0) * 60 + (parseInt(plannedMinutes, 10) || 0);

    if (totalMinutes <= 0) {
      toast({ variant: 'destructive', title: 'Duration must be greater than 0' });
      return;
    }

    setLoading(true);
    try {
      await addStudyTask(firestore, user.uid, {
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        subjectName: subject.name,
        chapterName: chapter.name,
        date: dateStr,
        duration: totalMinutes,
      });
      setIsDialogOpen(false);
      setSelectedSubject(null);
      setSelectedChapter(null);
      setPlannedHours('0');
      setPlannedMinutes('25');
      toast({ title: 'Task added successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error adding task' });
    } finally {
      setLoading(false);
    }
  };

  const handleAiPlan = async () => {
    if (!user || !profile || !subjects) return;
    setAiLoading(true);
    try {
      // Gather roadmap data for AI
      const roadmapData = [];
      for (const sub of subjects) {
        const capsSnap = await getDocs(collection(firestore, 'users', user.uid, 'subjects', sub.id, 'chapters'));
        roadmapData.push({
          id: sub.id,
          name: sub.name,
          chapters: capsSnap.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            status: d.data().status,
            timeSpent: d.data().time_spent || 0
          }))
        });
      }

      const result = await suggestSchedule({
        category: profile.category || 'HSC',
        batch: profile.batch || '2026',
        dailyGoalMinutes: profile.daily_goal_minutes || 360,
        subjects: roadmapData
      });
      setAiSuggestion(result);
      setIsAiOpen(true);
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI Planning Failed', description: 'Could not connect to study advisor.' });
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiTasks = async () => {
    if (!user || !aiSuggestion) return;
    setLoading(true);
    try {
      for (const task of aiSuggestion.suggestedTasks) {
        await addStudyTask(firestore, user.uid, {
          subjectId: task.subjectId,
          chapterId: task.chapterId,
          subjectName: task.subjectName,
          chapterName: task.chapterName,
          date: dateStr,
          duration: task.duration,
        });
      }
      setIsAiOpen(false);
      setAiSuggestion(null);
      toast({ title: 'Plan Applied!', description: 'Your AI suggested tasks are now in your list.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to apply all tasks.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      await updateTaskStatus(firestore, user.uid, taskId, !currentStatus);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error updating task' });
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteTask(firestore, user.uid, taskId);
      toast({ title: 'Task deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error deleting task' });
    }
  };

  const nextMonth = () => setCurrentMonth(addDays(endOfMonth(currentMonth), 1));
  const prevMonth = () => setCurrentMonth(addDays(startOfMonth(currentMonth), -1));

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, 'yyyy-MM-dd');
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isSelected = isSameDay(day, selectedDate);
        const dayTasks = monthTasks?.filter(t => t.date === formattedDate) || [];
        const hasTasks = dayTasks.length > 0;
        const allCompleted = hasTasks && dayTasks.every(t => t.completed);
        const someCompleted = hasTasks && dayTasks.some(t => t.completed) && !allCompleted;

        const cloneDay = day;
        days.push(
          <div
            key={day.toString()}
            className={cn(
              "relative h-16 md:h-20 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer border-2",
              !isCurrentMonth ? "opacity-20 pointer-events-none" : "",
              isSelected 
                ? "bg-destructive border-destructive text-white shadow-lg" 
                : "bg-white border-transparent text-slate-800 hover:border-slate-300"
            )}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <span className={cn("text-lg font-bold", isSelected ? "text-white" : "text-slate-800")}>
              {format(day, 'd')}
            </span>
            <div className="flex flex-col items-center">
              {isSelected ? (
                <span className="text-[10px] font-black uppercase">To-Do</span>
              ) : (
                <>
                  <span className="text-[10px] text-slate-400 font-bold">-</span>
                  {hasTasks && (
                    <div className="flex gap-0.5 mt-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full", allCompleted ? "bg-success" : someCompleted ? "bg-orange-500" : "bg-destructive")} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-2 mb-2" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  const formatDurationDisplay = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
          <ProfileSetupGate>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Calendar Section */}
              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="bg-[#2A2D5B] border-none shadow-2xl rounded-[2rem] p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <h2 className="text-2xl font-black text-white/90 tracking-tighter uppercase">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/10 rounded-full">
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/10 rounded-full">
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 mb-4 text-center">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                      <div key={idx} className={cn("text-xs md:text-sm font-bold", idx === 6 ? "text-destructive" : "text-white/60")}>
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {renderCells()}

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-xs text-white/70 font-medium">Done: Daily Target Complete</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-xs text-white/70 font-medium">In Progress</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Task Section */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight font-headline">
                      {format(selectedDate, 'EEEE, MMM do')}
                    </h2>
                    <p className="text-muted-foreground text-sm">{tasks?.length || 0} tasks planned</p>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      className="rounded-full shadow-sm border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 flex-1"
                      onClick={handleAiPlan}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      AI Plan
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="rounded-full shadow-lg bg-primary hover:bg-primary/90 flex-1">
                          <Plus className="mr-2 h-4 w-4" /> Add Task
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
                        <DialogHeader className="p-6 pb-2 shrink-0">
                          <DialogTitle className="text-xl font-black font-headline">Plan Your Study Session</DialogTitle>
                        </DialogHeader>
                        
                        <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto">
                          <div className="space-y-6 py-2">
                            <div className="space-y-2">
                              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Subject</Label>
                              <Select onValueChange={(val) => {setSelectedSubject(val); setSelectedChapter(null);}}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Choose a subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Chapter</Label>
                              <Select onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Choose a chapter" />
                                </SelectTrigger>
                                <SelectContent>
                                  {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-3">
                              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Planned Duration</Label>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Hours</Label>
                                  <div className="relative">
                                    <Input 
                                      type="number" 
                                      min="0" 
                                      max="23" 
                                      value={plannedHours} 
                                      onChange={(e) => setPlannedHours(e.target.value)}
                                      className="h-11"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Minutes</Label>
                                  <div className="relative">
                                    <Input 
                                      type="number" 
                                      min="0" 
                                      max="59" 
                                      value={plannedMinutes} 
                                      onChange={(e) => setPlannedMinutes(e.target.value)}
                                      className="h-11 pr-10"
                                    />
                                    <Clock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                        
                        <DialogFooter className="p-6 pt-2 shrink-0 border-t bg-secondary/10">
                          <Button onClick={handleAddTask} disabled={loading || !selectedChapter} className="w-full h-12 text-base font-bold rounded-xl shadow-lg shadow-primary/20">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add to Schedule
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Progress Summary Card */}
                <Card className="bg-primary text-primary-foreground overflow-hidden border-none shadow-xl">
                  <CardContent className="p-6">
                      <div className="flex justify-between items-center">
                          <div>
                              <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-widest">Today's Target</p>
                              <h3 className="text-3xl font-black">
                                  {tasks && tasks.length > 0 
                                      ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) 
                                      : 0}%
                              </h3>
                          </div>
                          <CheckCircle2 className="h-10 w-10 opacity-20" />
                      </div>
                  </CardContent>
                </Card>

                {/* Task List */}
                <div className="space-y-3">
                  {tasksLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
                  ) : tasks && tasks.length > 0 ? (
                    tasks.map((task) => (
                      <Card key={task.id} className={cn(
                        "transition-all border-none shadow-sm",
                        task.completed ? "bg-success/5" : "bg-card"
                      )}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <Checkbox 
                            checked={task.completed} 
                            onCheckedChange={() => handleToggle(task.id, task.completed)}
                            className="h-5 w-5 rounded-full border-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-black text-primary uppercase tracking-widest truncate">{task.subjectName}</p>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span className="text-[9px] font-bold">{formatDurationDisplay(task.duration)}</span>
                              </div>
                            </div>
                            <h4 className={cn(
                              "text-base font-bold truncate",
                              task.completed ? "line-through text-muted-foreground" : "text-foreground"
                            )}>
                              {task.chapterName}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" asChild className="text-primary hover:text-primary hover:bg-primary/10 h-9 w-9">
                                  <Link href={`/dashboard?subjectId=${task.subjectId}&chapterId=${task.chapterId}&duration=${task.duration}`}>
                                      <Play className="h-4 w-4 fill-current" />
                                  </Link>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 md:py-16 bg-secondary/20 rounded-3xl border-2 border-dashed border-muted">
                      <div className="mx-auto w-10 h-10 bg-secondary rounded-full flex items-center justify-center mb-4">
                          <Plus className="text-muted-foreground h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold">Empty Schedule</h3>
                      <p className="text-muted-foreground text-xs px-4">Select a subject or use AI to generate a plan.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>

      {/* AI Suggestion Dialog */}
      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-[2rem] overflow-hidden">
           <DialogHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center gap-3">
                 <div className="bg-white/20 p-2 rounded-xl">
                    <BrainCircuit className="h-6 w-6 text-white" />
                 </div>
                 <div>
                    <DialogTitle className="text-2xl font-black">AI Smart Planner</DialogTitle>
                    <DialogDescription className="text-primary-foreground/70">Academic Strategy for {profile?.category} {profile?.batch}</DialogDescription>
                 </div>
              </div>
           </DialogHeader>

           <ScrollArea className="flex-1 p-8">
              <div className="space-y-8">
                 {aiSuggestion && (
                   <>
                     <div className="bg-secondary/30 p-6 rounded-[2rem] border border-primary/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                           <Lightbulb className="h-20 w-20" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Today's Strategy</h4>
                        <p className="text-lg font-medium leading-relaxed italic">"{aiSuggestion.strategyNote}"</p>
                     </div>

                     <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Suggested Hustles</h4>
                        <div className="grid gap-3">
                           {aiSuggestion.suggestedTasks.map((t, i) => (
                             <div key={i} className="p-5 rounded-2xl bg-card border hover:border-primary/30 transition-all">
                                <div className="flex justify-between items-start gap-4">
                                   <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                         <Badge variant="secondary" className="text-[10px] font-bold uppercase">{t.subjectName}</Badge>
                                         <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {formatDurationDisplay(t.duration)}
                                         </span>
                                      </div>
                                      <h5 className="font-bold text-lg">{t.chapterName}</h5>
                                      <p className="text-xs text-muted-foreground font-medium">{t.reason}</p>
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                   </>
                 )}
              </div>
           </ScrollArea>

           <DialogFooter className="p-8 pt-4 bg-secondary/10 border-t">
              <div className="flex gap-3 w-full">
                 <Button variant="ghost" onClick={() => setIsAiOpen(false)} className="flex-1 h-12 font-bold rounded-xl">Cancel</Button>
                 <Button onClick={applyAiTasks} disabled={loading} className="flex-[2] h-12 font-bold rounded-xl shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Apply to Schedule
                 </Button>
              </div>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'secondary' | 'outline', className?: string }) {
  const styles = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-primary text-primary'
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", styles[variant], className)}>
      {children}
    </span>
  );
}
