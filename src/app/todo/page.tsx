
'use client';

import { useState, useMemo } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { addStudyTask, updateTaskStatus, deleteTask, type StudyTask } from '@/firebase/firestore/todo';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function TodoPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch all tasks for the current month to show indicators on the calendar
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

  // Fetch tasks for the specifically selected date
  // Fixed: Removed orderBy('createdAt', 'asc') to avoid composite index requirement.
  // We will sort the results locally instead.
  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', dateStr)
    );
  }, [user, firestore, dateStr]);

  const { data: rawTasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  // Local sorting for tasks
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

  // Fetch Subjects
  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects'), orderBy('createdAt', 'asc'));
  }, [user, firestore]);
  const { data: subjects } = useCollection(subjectsQuery);

  // Fetch Chapters
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

    setLoading(true);
    try {
      await addStudyTask(firestore, user.uid, {
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        subjectName: subject.name,
        chapterName: chapter.name,
        date: dateStr,
      });
      setIsDialogOpen(false);
      setSelectedSubject(null);
      setSelectedChapter(null);
      toast({ title: 'Task added successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error adding task' });
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

  // Calendar Logic
  const nextMonth = () => setCurrentMonth(addDays(endOfMonth(currentMonth), 1));
  const prevMonth = () => setCurrentMonth(addDays(startOfMonth(currentMonth), -1));

  const renderDays = () => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map((day, index) => (
          <div key={index} className={cn("text-center text-sm font-bold", index === 6 ? "text-destructive" : "text-white/60")}>
            {day}
          </div>
        ))}
      </div>
    );
  };

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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Custom Styled Calendar Card */}
            <div className="lg:col-span-7">
              <Card className="bg-[#2A2D5B] border-none shadow-2xl rounded-[2rem] p-6 md:p-8">
                <div className="flex justify-between items-center mb-8">
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

                {renderDays()}
                {renderCells()}

                <div className="mt-8 space-y-2">
                   <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                      <span className="text-sm text-white/70 font-medium">লেভেল ৩: উভয় টাস্ক সাবমিট</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm text-white/70 font-medium">লেভেল ২: যেকোনো একটি সাবমিট</span>
                   </div>
                </div>
              </Card>
            </div>

            {/* Task Management Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight font-headline">
                    {format(selectedDate, 'EEEE, MMMM do')}
                  </h2>
                  <p className="text-muted-foreground">{tasks?.length || 0} tasks planned</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full shadow-lg bg-primary hover:bg-primary/90">
                      <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Study Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Select Subject</Label>
                        <Select onValueChange={(val) => {setSelectedSubject(val); setSelectedChapter(null);}}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Select Chapter</Label>
                        <Select onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a chapter" />
                          </SelectTrigger>
                          <SelectContent>
                            {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddTask} disabled={loading || !selectedChapter} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add to Schedule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Completion Progress Card */}
              <Card className="bg-primary text-primary-foreground overflow-hidden border-none shadow-xl">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest">Completion Rate</p>
                            <h3 className="text-4xl font-black">
                                {tasks && tasks.length > 0 
                                    ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) 
                                    : 0}%
                            </h3>
                        </div>
                        <CheckCircle2 className="h-12 w-12 opacity-20" />
                    </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {tasksLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
                ) : tasks && tasks.length > 0 ? (
                  tasks.map((task) => (
                    <Card key={task.id} className={cn(
                      "transition-all border-none shadow-sm",
                      task.completed ? "bg-success/5" : "bg-card"
                    )}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <Checkbox 
                          checked={task.completed} 
                          onCheckedChange={() => handleToggle(task.id, task.completed)}
                          className="h-6 w-6 rounded-full border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">{task.subjectName}</p>
                          <h4 className={cn(
                            "text-lg font-bold truncate",
                            task.completed ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {task.chapterName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" asChild className="text-primary hover:text-primary hover:bg-primary/10">
                                <Link href={`/dashboard?subjectId=${task.subjectId}&chapterId=${task.chapterId}`}>
                                    <Play className="h-5 w-5 fill-current" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-16 bg-secondary/20 rounded-3xl border-2 border-dashed border-muted">
                    <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4">
                        <Plus className="text-muted-foreground h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">No tasks for today</h3>
                    <p className="text-muted-foreground text-sm">Select a subject and chapter to begin.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
