
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
  CalendarCheck
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
} from '@radix-ui/react-sortable'; // Corrected alias/import issue often seen with Shadcn starters
// Actually Shadcn typically uses standard sortable:
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

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Simplified Expired Tasks Query: Fetch all incomplete and filter by date locally to avoid index error
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
  }, [user, firestore, currentMonth, monthStart, monthEnd]);
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

  const [localTasks, setLocalTasks] = useState<StudyTask[]>([]);
  useEffect(() => {
    if (rawTasks) {
      const sorted = [...rawTasks].sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocalTasks(sorted);
    }
  }, [rawTasks]);

  // Form State
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
      toast({ title: 'Task added successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error adding task' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAll = async () => {
    if (!user || !expiredTasks || expiredTasks.length === 0) return;
    setLoading(true);
    try {
      await restoreTasks(firestore, user.uid, expiredTasks.map(t => t.id));
      toast({ title: "Roadmap Resynchronized", description: "Expired tasks moved to today's schedule." });
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
              "relative h-16 md:h-20 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer border-2",
              !isCurrentMonth ? "opacity-20 pointer-events-none" : "",
              isSelected 
                ? "bg-primary border-primary text-white shadow-lg" 
                : "bg-white border-transparent text-slate-800 hover:border-slate-300"
            )}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <span className={cn("text-lg font-bold", isSelected ? "text-white" : "text-slate-800")}>
              {format(day, 'd')}
            </span>
            <div className="flex flex-col items-center">
              {isSelected ? (
                <span className="text-[10px] font-black uppercase">Active</span>
              ) : hasTasks ? (
                <div className={cn("w-2 h-2 rounded-full", allCompleted ? "bg-success" : someCompleted ? "bg-orange-500" : "bg-primary")} />
              ) : null}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7 gap-2 mb-2" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div>{rows}</div>;
  };

  const formatDurationDisplay = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          <ProfileSetupGate>
            
            {/* Expired Tasks Banner */}
            {expiredTasks && expiredTasks.length > 0 && isSameDay(selectedDate, new Date()) && (
              <Card className="rounded-[2rem] border-none shadow-2xl bg-orange-500 text-white overflow-hidden animate-in slide-in-from-top duration-500">
                <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/20 rounded-2xl">
                      <History className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black tracking-tighter">Incomplete Objectives Detected</h3>
                      <p className="text-white/80 font-medium text-sm md:text-base">You have {expiredTasks.length} tasks from previous days. Restore them to today's roadmap.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleRestoreAll} 
                    disabled={loading}
                    variant="secondary" 
                    className="rounded-full px-8 h-14 font-black uppercase tracking-widest text-[10px] bg-white text-orange-600 hover:bg-white/90 shadow-xl"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                    Restore All to Today
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Calendar Section */}
              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="bg-[#1A1C3D] border-none shadow-2xl rounded-[2.5rem] p-6 md:p-10">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-xl">
                        <CalendarCheck className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                      </h2>
                    </div>
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                      <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/10 rounded-lg">
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/10 rounded-lg">
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 mb-4 text-center">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={idx} className="text-[10px] font-black uppercase tracking-widest text-white/40">
                        {day}
                      </div>
                    ))}
                  </div>
                  {renderCells()}
                </Card>
              </div>

              {/* Task Section */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter uppercase font-headline">
                      {isSameDay(selectedDate, new Date()) ? "Today's Roadmap" : format(selectedDate, 'MMM do, yyyy')}
                    </h2>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">{localTasks.length} objectives assigned</p>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-2xl shadow-xl shadow-primary/20 h-14 font-black uppercase tracking-widest text-xs">
                        <Plus className="mr-2 h-5 w-5" /> Add New Objective
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-8">
                      <DialogHeader className="pb-4">
                        <DialogTitle className="text-3xl font-black tracking-tighter">New Objective</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh] px-1">
                        <div className="space-y-6 py-2">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Subject</Label>
                            <Select onValueChange={(val) => {setSelectedSubject(val); setSelectedChapter(null);}}>
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="Select Subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Chapter</Label>
                            <Select onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="Select Chapter" />
                              </SelectTrigger>
                              <SelectContent>
                                {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Instructions</Label>
                            <Textarea 
                              placeholder="Note for this session..." 
                              className="min-h-[100px] rounded-xl resize-none"
                              value={taskNote}
                              onChange={(e) => setTaskNote(e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Planned Duration</Label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 px-1">Hours</Label>
                                <Input type="number" min="0" value={plannedHours} onChange={(e) => setPlannedHours(e.target.value)} className="h-12 rounded-xl" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 px-1">Minutes</Label>
                                <Input type="number" min="0" max="59" value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} className="h-12 rounded-xl" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="pt-6 border-t mt-4">
                        <Button onClick={handleAddTask} disabled={loading || !selectedChapter} className="w-full h-14 font-black rounded-xl">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy to Roadmap"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={localTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {tasksLoading ? (
                        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />)
                      ) : localTasks.length > 0 ? (
                        localTasks.map((task) => (
                          <SortableTaskItem 
                            key={task.id} 
                            task={task} 
                            onToggle={(id, val) => updateTaskStatus(firestore, user!.uid, id, val)}
                            onDelete={(id) => deleteTask(firestore, user!.uid, id)}
                            formatDuration={formatDurationDisplay}
                          />
                        ))
                      ) : (
                        <div className="text-center py-20 bg-secondary/20 rounded-[2.5rem] border-2 border-dashed">
                          <Plus className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                          <h3 className="text-xl font-black">Empty Schedule</h3>
                          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">Select a date or add a new objective to begin.</p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function SortableTaskItem({ task, onToggle, onDelete, formatDuration }: { 
  task: StudyTask; 
  onToggle: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
  formatDuration: (mins: number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };

  return (
    <Card ref={setNodeRef} style={style} className={cn(
      "transition-all border-none shadow-xl overflow-hidden rounded-3xl relative group",
      task.completed ? "bg-success/5 opacity-60" : "bg-card hover:scale-[1.02]",
      task.source === 'group' && "ring-2 ring-primary/20",
      isDragging && "shadow-2xl scale-[1.05]"
    )}>
      <CardContent className="p-5 flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary transition-colors p-1">
          <GripVertical className="h-5 w-5" />
        </div>
        <Checkbox checked={task.completed} onCheckedChange={() => onToggle(task.id, task.completed)} className="h-6 w-6 rounded-full border-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 border-primary/20 text-primary">
              {task.subjectName}
            </Badge>
            {task.source === 'group' && (
              <Badge className="text-[8px] font-black uppercase px-1.5 h-4 bg-primary text-white border-none animate-pulse">GUILD</Badge>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="text-[9px] font-bold">{formatDuration(task.duration)}</span>
            </div>
          </div>
          <h4 className={cn("text-base font-black truncate", task.completed && "line-through text-muted-foreground")}>{task.chapterName}</h4>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" asChild className="text-primary rounded-full hover:bg-primary/10 h-10 w-10">
                <Link href="/dashboard"><Play className="h-5 w-5 fill-current" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="text-destructive rounded-full hover:bg-destructive/10 h-10 w-10">
                <Trash2 className="h-5 w-5" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
