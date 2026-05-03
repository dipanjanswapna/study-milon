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
  List
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

  const personalTasks = useMemo(() => localTasks.filter(t => t.source !== 'group'), [localTasks]);
  const guildTasks = useMemo(() => localTasks.filter(t => t.source === 'group'), [localTasks]);

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
              !isCurrentMonth ? "opacity-10 pointer-events-none" : "",
              isSelected 
                ? "bg-primary border-primary text-white shadow-lg z-10" 
                : "bg-white/5 border-transparent text-white/70 hover:border-white/20"
            )}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <span className={cn("text-xs sm:text-base font-black", isSelected ? "text-white" : "text-white/80")}>
              {format(day, 'd')}
            </span>
            {hasTasks && !isSelected && (
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1", allCompleted ? "bg-success" : someCompleted ? "bg-orange-500" : "bg-primary")} />
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
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          <ProfileSetupGate>
            
            {/* Hero Banner (Leaderboard Style) */}
            <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <CalendarIcon className="h-20 w-20 transition-transform group-hover:scale-110 duration-1000" />
              </div>
              <CardContent className="p-4 md:p-6 relative z-10 space-y-1">
                <div className="space-y-0.5 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <div className="inline-flex items-center gap-1 bg-primary/20 backdrop-blur-lg px-2 py-0.5 rounded-full border border-white/10 text-[8px] font-black text-primary-foreground uppercase tracking-widest">
                       <Zap className="h-2 w-2 fill-current" />
                       Hustle Execution
                    </div>
                  </div>
                  <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Study Roadmap</h1>
                  <p className="text-white/60 font-medium max-w-xl text-[9px] md:text-xs">
                    Plan your sessions, track chapter progress, and synchronize with your goals.
                  </p>
                </div>
              </CardContent>
            </Card>

            {expiredTasks && expiredTasks.length > 0 && isSameDay(selectedDate, new Date()) && (
              <Card className="rounded-xl border-none shadow-lg bg-orange-500 text-white overflow-hidden animate-in slide-in-from-top duration-500">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight">Unfinished Hustle Detected</h3>
                      <p className="text-white/80 font-medium text-[10px]">You have {expiredTasks.length} objectives from previous days.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleRestoreAll} 
                    disabled={loading}
                    variant="secondary" 
                    className="rounded-lg px-4 h-9 font-black uppercase tracking-widest text-[9px] bg-white text-orange-600 hover:bg-white/90 shadow-sm w-full sm:w-auto"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="mr-1.5 h-3 w-3 fill-current" />}
                    Restore All
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Calendar (Leaderboard Filter Style) */}
              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="bg-[#1A1C3D] border-none shadow-xl rounded-xl p-4 md:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/20 rounded-lg">
                        <CalendarCheck className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-sm md:text-base font-black text-white tracking-tighter uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                      </h2>
                    </div>
                    <div className="flex gap-1.5 bg-white/5 p-1 rounded-lg">
                      <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/10 h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/10 h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 mb-2 text-center">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={idx} className="text-[8px] font-black uppercase tracking-widest text-white/40">
                        {day}
                      </div>
                    ))}
                  </div>
                  {renderCells()}
                </Card>
              </div>

              {/* Right Column: Task List (Leaderboard Directory Style) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <h2 className="text-base font-black tracking-tighter uppercase leading-none">
                      {isSameDay(selectedDate, new Date()) ? "Today's Roadmap" : format(selectedDate, 'MMM do')}
                    </h2>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">
                      {localTasks.length} Objectives Assigned
                    </p>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="rounded-lg shadow-md h-9 px-4 font-black uppercase tracking-widest text-[9px]">
                        <Plus className="mr-1 h-3 w-3" /> New Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-xl border-none shadow-2xl p-6">
                      <DialogHeader className="pb-4">
                        <DialogTitle className="text-xl font-black tracking-tighter uppercase">New Objective</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh] pr-2">
                        <div className="space-y-4 py-2">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Subject</Label>
                            <Select onValueChange={(val) => {setSelectedSubject(val); setSelectedChapter(null);}}>
                              <SelectTrigger className="h-10 rounded-lg">
                                <SelectValue placeholder="Choose subject..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Chapter</Label>
                            <Select onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                              <SelectTrigger className="h-10 rounded-lg">
                                <SelectValue placeholder="Choose chapter..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instructions</Label>
                            <Textarea 
                              placeholder="Focus points..." 
                              className="min-h-[80px] rounded-lg resize-none text-sm"
                              value={taskNote}
                              onChange={(e) => setTaskNote(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Planned Duration</Label>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-1">Hours</Label>
                                <Input type="number" min="0" value={plannedHours} onChange={(e) => setPlannedHours(e.target.value)} className="h-10 rounded-lg" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase text-muted-foreground/60 px-1">Minutes</Label>
                                <Input type="number" min="0" max="59" value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} className="h-10 rounded-lg" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="pt-4 border-t mt-4">
                        <Button onClick={handleAddTask} disabled={loading || !selectedChapter} className="w-full h-11 font-black rounded-lg shadow-lg">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy Task"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <div className="p-3 border-b bg-secondary/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                       <List className="h-3 w-3 text-primary" /> Objective Queue
                    </h3>
                  </div>
                  
                  <ScrollArea className="h-[450px]">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <div className="divide-y divide-secondary/30">
                        {tasksLoading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-4 flex items-center gap-3">
                              <div className="w-8 h-8 bg-muted animate-pulse rounded-lg" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                                <div className="h-2 w-1/3 bg-muted animate-pulse rounded" />
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
                          <div className="py-20 text-center space-y-4 px-6">
                            <div className="bg-secondary/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                                <Zap className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-sm font-black tracking-tighter uppercase text-muted-foreground">Empty Roadmap</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">Select a date and add objectives to begin tracking.</p>
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
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };

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
        "flex items-center justify-between p-3 sm:p-4 hover:bg-primary/[0.03] transition-all group", 
        task.completed && "bg-secondary/10"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-primary transition-colors p-1">
          <GripVertical className="h-4 w-4" />
        </div>
        
        <Checkbox 
          checked={task.completed} 
          onCheckedChange={() => onToggle(task.id, task.completed)} 
          className="h-5 w-5 rounded-full border-primary shrink-0" 
        />
        
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <h4 className={cn(
              "font-bold text-[11px] sm:text-sm truncate transition-colors tracking-tight", 
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.chapterName}
            </h4>
            {task.source === 'group' && (
              <Badge className="text-[6px] font-black uppercase px-1 h-3 bg-primary text-white border-none">GUILD</Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             <div className="flex items-center gap-1 text-primary">
                <BookOpen className="h-2 w-2" />
                <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tight">{task.subjectName}</span>
             </div>
             <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-2 w-2" />
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-tight">{formatDuration(task.duration)}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" asChild className="text-primary rounded-full hover:bg-primary/10 h-7 w-7">
          <Link href="/dashboard"><Play className="h-3 w-3 fill-current" /></Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="text-destructive rounded-full hover:bg-destructive/10 h-7 w-7">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
