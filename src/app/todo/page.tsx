
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { addStudyTask, updateTaskStatus, deleteTask, type StudyTask } from '@/firebase/firestore/todo';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  Circle, 
  Calendar as CalendarIcon,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function TodoPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch tasks for the selected date
  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', dateStr),
      orderBy('createdAt', 'asc')
    );
  }, [user, firestore, dateStr]);

  const { data: tasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  // Form State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // Fetch Subjects for the dropdown
  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects'), orderBy('createdAt', 'asc'));
  }, [user, firestore]);
  const { data: subjects } = useCollection(subjectsQuery);

  // Fetch Chapters for the selected subject
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Calendar Section */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-primary/5 border-b pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" /> Study Planner
                  </CardTitle>
                  <CardDescription>Select a date to manage your tasks</CardDescription>
                </CardHeader>
                <CardContent className="p-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className="rounded-md border-none shadow-none"
                    classNames={{
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
                        day_today: "bg-accent text-accent-foreground font-bold",
                    }}
                  />
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="bg-primary text-primary-foreground overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-primary-foreground/70 text-sm font-semibold uppercase tracking-wider">Completion Rate</p>
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
            </div>

            {/* Tasks Section */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight font-headline">
                    {format(selectedDate, 'EEEE, MMMM do')}
                  </h2>
                  <p className="text-muted-foreground">{tasks?.length || 0} tasks planned</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full shadow-lg">
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

              <div className="space-y-3">
                {tasksLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
                ) : tasks && tasks.length > 0 ? (
                  tasks.map((task) => (
                    <Card key={task.id} className={`transition-all border-l-4 ${task.completed ? 'border-l-success opacity-75' : 'border-l-primary'}`}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <Checkbox 
                          checked={task.completed} 
                          onCheckedChange={() => handleToggle(task.id, task.completed)}
                          className="h-6 w-6 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{task.subjectName}</p>
                          <h4 className={`text-lg font-bold truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.chapterName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard?subjectId=${task.subjectId}&chapterId=${task.chapterId}`}>
                                    <Play className="h-5 w-5 text-primary" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-20 bg-secondary/20 rounded-3xl border-2 border-dashed">
                    <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4">
                        <Plus className="text-muted-foreground h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">No tasks for this day</h3>
                    <p className="text-muted-foreground text-sm">Tap "Add Task" to start planning.</p>
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
