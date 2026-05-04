'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { addStudyTask, updateTaskStatus, deleteTask, updateTasksOrder, restoreTasks, type StudyTask } from '@/firebase/firestore/todo';
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
import { Textarea } from '@/components/ui/textarea';
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
  ChevronLeft, 
  ChevronRight,
  Clock,
  GripVertical,
  History,
  Zap,
  CalendarCheck,
  BookOpen,
  Users2,
  Calendar as CalendarIcon,
  List,
  Target,
  Flame,
  Layout
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// DnD Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function TodoPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allIncompleteTasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('completed', '==', false)
    );
  }, [user, firestore]);
  const { data: allIncompleteTasks } = useCollection<StudyTask>(allIncompleteTasksQuery);

  const expiredTasks = useMemo(() => {
    if (!allIncompleteTasks) return [];
    return allIncompleteTasks
      .filter(t => t.date < todayStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allIncompleteTasks, todayStr]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthTasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
      where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
    );
  }, [user, firestore, currentMonth, monthStart, monthEnd]);
  const { data: monthTasks } = useCollection<StudyTask>(monthTasksQuery);

  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', dateStr)
    );
  }, [user, firestore, dateStr]);
  const { data: rawTasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  const [localTasks, setLocalTasks] = useState<StudyTask[]>([]);
  useEffect(() => {
    if (rawTasks) {
      const sorted = [...rawTasks].sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocalTasks(sorted);
    }
  }, [rawTasks]);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [taskNote, setTaskNote] = useState<string>('');
  const [plannedHours, setPlannedHours] = useState<string>('0');
  const [plannedMinutes, setPlannedMinutes] = useState<string>('25');

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
      const nextOrder = localTasks.length > 0 ? Math.max(...localTasks.map(t => t.order || 0)) + 1 : 0;
      await addStudyTask(firestore, user.uid, {
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        subjectName: subject.name,
        chapterName: chapter.name,
        note: taskNote.trim(),
        date: dateStr,
        duration: totalMinutes,
        source: 'personal'
      }, nextOrder);
      
      setIsDialogOpen(false);
      setSelectedSubject(null);
      setSelectedChapter(null);
      setTaskNote('');
      setPlannedHours('0');
      setPlannedMinutes('25');
      toast({ title: 'Objective deployed to roadmap!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error adding objective' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAll = async () => {
    if (!user || !expiredTasks || expiredTasks.length === 0) return;
    setLoading(true);
    try {
      await restoreTasks(firestore, user.uid, expiredTasks.map(t => t.id));
      toast({ title: "Roadmap Resynchronized", description: "All expired objectives moved to today." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to restore tasks" });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!user || !over || active.id === over.id) return;
    setLocalTasks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const newArray = arrayMove(items, oldIndex, newIndex);
      const updates = newArray.map((t, idx) => ({ id: t.id, order: idx }));
      updateTasksOrder(firestore, user.uid, updates);
      return newArray;
    });
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
              "relative h-12 sm:h-16 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer border-2",
              !isCurrentMonth ? "opacity-5 pointer-events-none" : "",
              isSelected 
                ? "bg-primary border-primary text-white shadow-lg scale-105 z-10" 
                : "bg-white/5 border-transparent text-white/70 hover:border-white/10"
            )}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <span className={cn("text-xs sm:text-base font-black", isSelected ? "text-white" : "text-white/80")}>
              {format(day, 'd')}
            </span>
            {hasTasks && !isSelected && (
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shadow-[0_0_5px_rgba(255,255,255,0.5)]", allCompleted ? "bg-success" : someCompleted ? "bg-orange-500" : "bg-primary")} />
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7 gap-2 mb-2" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div>{rows}</div>;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <ProfileSetupGate>
            
            {/* Hero Banner - Elite Design */}
            <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 transition-transform group-hover:rotate-45 duration-1000">
                <Layout className="h-32 w-32" />
              </div>
              <CardContent className="p-8 md:p-12 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="space-y-3 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-lg px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-primary-foreground uppercase tracking-[0.2em]">
                       <Zap className="h-3 w-3 fill-current" />
                       Strategic Planner
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Your Study Roadmap</h1>
                    <p className="text-white/60 font-medium text-sm md:text-base max-w-lg">
                      Plan your sessions, track chapter progress, and synchronize your hustle with the Million Minute Quest.
                    </p>
                  </div>
                  <div className="flex flex-col items-center md:items-end gap-3">
                     <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-inner flex items-center gap-4">
                        <div className="text-center">
                           <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Tasks Today</p>
                           <p className="text-2xl font-black">{localTasks.length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                           <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Done</p>
                           <p className="text-2xl font-black text-primary">{localTasks.filter(t => t.completed).length}</p>
                        </div>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expired Tasks Warning */}
            {expiredTasks && expiredTasks.length > 0 && isSameDay(selectedDate, new Date()) && (
              <Card className="rounded-[1.5rem] border-none shadow-xl bg-gradient-to-r from-orange-500 to-red-600 text-white overflow-hidden animate-in slide-in-from-top duration-700">
                <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                      <History className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight leading-none uppercase">Pending Objectives</h3>
                      <p className="text-white/80 font-medium text-xs mt-1">You have {expiredTasks.length} unfinished tasks from previous days.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleRestoreAll} 
                    disabled={loading}
                    variant="secondary" 
                    className="rounded-xl px-6 h-11 font-black uppercase tracking-widest text-[10px] bg-white text-orange-600 hover:bg-white/90 shadow-2xl w-full sm:w-auto transition-transform hover:scale-105 active:scale-95"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                    Move to Today
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Calendar Card */}
              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="bg-[#1A1C3D] border-none shadow-2xl rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden">
                  <div className="absolute -bottom-10 -left-10 opacity-5">
                     <CalendarIcon className="h-48 w-48" />
                  </div>
                  
                  <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/20 rounded-2xl shadow-inner border border-white/5">
                        <CalendarCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg md:text-2xl font-black text-white tracking-tighter uppercase leading-none">
                          {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Calendar Feed</p>
                      </div>
                    </div>
                    <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                      <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/10 rounded-xl h-10 w-10">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/10 rounded-xl h-10 w-10">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 mb-4 text-center relative z-10">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={idx} className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="relative z-10">
                    {renderCells()}
                  </div>
                </Card>
              </div>

              {/* Right Column: Task List Management */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                
                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black tracking-tighter uppercase leading-none">
                      {isSameDay(selectedDate, new Date()) ? "Today's Grind" : format(selectedDate, 'MMM do')}
                    </h2>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                      <List className="h-3 w-3 text-primary" /> {localTasks.length} Objectives Active
                    </p>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6 font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all">
                        <Plus className="mr-1.5 h-4 w-4" /> New Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                      <div className="bg-primary p-8 text-white">
                         <DialogHeader>
                           <DialogTitle className="text-3xl font-black tracking-tighter uppercase">New Objective</DialogTitle>
                           <DialogDescription className="text-white/70 font-medium text-xs">Define your target for {format(selectedDate, 'MMMM do')}.</DialogDescription>
                         </DialogHeader>
                      </div>
                      <ScrollArea className="max-h-[60vh] p-8 pt-6">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Subject</Label>
                            <Select onValueChange={(val) => {setSelectedSubject(val); setSelectedChapter(null);}}>
                              <SelectTrigger className="h-12 rounded-xl border-2 bg-secondary/20 border-transparent focus:border-primary transition-all">
                                <SelectValue placeholder="Choose subject..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Chapter</Label>
                            <Select onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                              <SelectTrigger className="h-12 rounded-xl border-2 bg-secondary/20 border-transparent focus:border-primary transition-all">
                                <SelectValue placeholder="Choose chapter..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Focus Points / Notes</Label>
                            <Textarea 
                              placeholder="e.g. Complete exercise 3.1 & MCQ" 
                              className="min-h-[100px] rounded-xl border-2 bg-secondary/20 border-transparent focus:border-primary transition-all resize-none text-sm font-medium"
                              value={taskNote}
                              onChange={(e) => setTaskNote(e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Duration</Label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-2">Hours</Label>
                                <Input type="number" min="0" value={plannedHours} onChange={(e) => setPlannedHours(e.target.value)} className="h-12 rounded-xl border-2 bg-secondary/20 border-transparent focus:border-primary transition-all font-black text-center" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-2">Minutes</Label>
                                <Input type="number" min="0" max="59" value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} className="h-12 rounded-xl border-2 bg-secondary/20 border-transparent focus:border-primary transition-all font-black text-center" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                      <div className="p-8 pt-0">
                        <Button onClick={handleAddTask} disabled={loading || !selectedChapter} className="w-full h-14 font-black rounded-2xl shadow-xl shadow-primary/20 text-lg">
                          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Deploy Objective"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card className="rounded-[2.5rem] border-none shadow-2xl bg-card overflow-hidden">
                  <div className="p-5 border-b bg-secondary/10 flex items-center justify-between px-6">
                    <h3 className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                       <Target className="h-4 w-4 text-primary" /> Active Queue
                    </h3>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-white border-primary/20 text-primary">Sortable</Badge>
                  </div>
                  
                  <ScrollArea className="h-[520px]">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <div className="divide-y divide-secondary/30">
                        {tasksLoading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-6 flex items-center gap-4">
                              <Skeleton className="w-8 h-8 rounded-xl" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-3 w-1/2 rounded" />
                              </div>
                            </div>
                          ))
                        ) : localTasks.length > 0 ? (
                          <SortableContext items={localTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            {localTasks.map((task) => (
                              <SortableTaskItem 
                                key={task.id} 
                                task={task} 
                                onToggle={(id, val) => updateTaskStatus(firestore, user!.uid, id, val)}
                                onDelete={(id) => deleteTask(firestore, user!.uid, id)}
                              />
                            ))}
                          </SortableContext>
                        ) : (
                          <div className="py-24 text-center space-y-6 px-10">
                            <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <Zap className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                            <div className="space-y-2">
                               <h3 className="text-lg font-black tracking-tighter uppercase text-muted-foreground/60">Roadmap Empty</h3>
                               <p className="text-xs text-muted-foreground/40 font-medium leading-relaxed">
                                  No objectives mapped for this date. Add a task to begin your focus session.
                               </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </DndContext>
                  </ScrollArea>
                </Card>

              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function SortableTaskItem({ task, onToggle, onDelete }: { 
  task: StudyTask; 
  onToggle: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.6 : 1 };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center justify-between p-5 sm:p-6 transition-all group border-l-4 border-transparent", 
        task.completed ? "bg-secondary/5 border-l-success" : "hover:bg-primary/[0.02] border-l-primary/10"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-primary transition-colors p-1 shrink-0">
          <GripVertical className="h-5 w-5" />
        </div>
        
        <div className="relative shrink-0">
           <Checkbox 
             checked={task.completed} 
             onCheckedChange={() => onToggle(task.id, task.completed)} 
             className="h-6 w-6 rounded-full border-primary/20 data-[state=checked]:bg-success data-[state=checked]:border-success transition-all shadow-sm" 
           />
        </div>
        
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-black text-sm sm:text-base truncate transition-colors tracking-tight uppercase leading-none", 
              task.completed && "line-through text-muted-foreground opacity-50"
            )}>
              {task.chapterName}
            </h4>
            {task.source === 'group' && (
              <Badge className="text-[7px] font-black uppercase px-2 h-4 bg-primary text-white border-none shadow-sm">GUILD</Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-1.5 text-primary">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                <span className="text-[9px] font-black uppercase tracking-widest">{task.subjectName}</span>
             </div>
             <div className="flex items-center gap-1.5 text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-md">
                <Clock className="h-3 w-3" />
                <span className="text-[9px] font-bold uppercase tracking-tight">{formatDuration(task.duration)}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-4">
        {isDragging ? null : (
          <>
            {!task.completed && (
              <Button variant="ghost" size="icon" asChild className="text-primary rounded-full hover:bg-primary/10 h-9 w-9 shadow-sm hover:shadow-md transition-all">
                <Link href="/dashboard"><Play className="h-4 w-4 fill-current" /></Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="text-destructive/30 hover:text-destructive rounded-full hover:bg-destructive/10 h-9 w-9 transition-all">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
