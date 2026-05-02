
'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Users2, 
  Clock, 
  Trash2, 
  BarChart3, 
  ShieldCheck, 
  Search,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Timer,
  Plus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { deleteGroup, type StudyGroup } from '@/firebase/firestore/groups';
import { deleteUserProfile, SUPER_ADMIN_UID } from '@/firebase/firestore/users';
import { addExam, deleteExam } from '@/firebase/firestore/exams';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Fetch Users
  const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: users, loading: usersLoading } = useCollection<any>(usersQuery);

  // Fetch Groups
  const groupsQuery = useMemo(() => query(collection(firestore, 'groups'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: groups, loading: groupsLoading } = useCollection<StudyGroup>(groupsQuery);

  // Fetch Exams
  const examsQuery = useMemo(() => query(collection(firestore, 'exams'), orderBy('examDate', 'asc')), [firestore]);
  const { data: exams, loading: examsLoading } = useCollection<any>(examsQuery);

  const stats = useMemo(() => {
    if (!users || !groups) return { totalUsers: 0, totalMinutes: 0, totalGroups: 0 };
    const totalMinutes = users.reduce((acc: number, u: any) => acc + (u.total_study_minutes || 0), 0);
    return {
      totalUsers: users.length,
      totalMinutes: totalMinutes,
      totalGroups: groups.length,
    };
  }, [users, groups]);

  // Exam Form State
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examCategory, setExamCategory] = useState('HSC');
  const [examDesc, setExamDesc] = useState('');

  const handleAddExam = async () => {
    if (!examTitle || !examDate) return;
    setLoadingAction('exam');
    try {
      await addExam(firestore, {
        title: examTitle,
        examDate: Timestamp.fromDate(new Date(examDate)),
        category: examCategory,
        description: examDesc
      });
      setIsExamOpen(false);
      setExamTitle('');
      setExamDate('');
      toast({ title: 'Exam Added', description: 'Students can now track this countdown.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    setLoadingAction(examId);
    try {
      await deleteExam(firestore, examId);
      toast({ title: 'Exam Removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteGroup = async (groupId: string, members: string[]) => {
    setLoadingAction(groupId);
    try {
      await deleteGroup(firestore, groupId, members);
      toast({ title: 'Guild Disbanded', description: 'The study guild has been removed from the platform.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === SUPER_ADMIN_UID) {
      toast({ variant: 'destructive', title: 'Action Denied', description: 'The Super Admin cannot be deleted.' });
      return;
    }
    
    setLoadingAction(userId);
    try {
      await deleteUserProfile(firestore, userId);
      toast({ title: 'Student Removed', description: 'The user profile has been successfully deleted.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const filteredUsers = users?.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                Command Center
              </h1>
              <p className="text-muted-foreground font-medium">Global platform oversight and management.</p>
            </div>
            <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search students..." 
                 className="pl-9 h-10 rounded-xl"
                 value={searchTerm}
                 onChange={(e) => setSearch(e.target.value)}
               />
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground">
              <CardContent className="p-8 flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground/70 text-xs font-black uppercase tracking-widest">Total Students</p>
                  <h3 className="text-4xl font-black mt-1">{stats.totalUsers}</h3>
                </div>
                <Users className="h-12 w-12 opacity-20" />
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl bg-card">
              <CardContent className="p-8 flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-black uppercase tracking-widest">Global Hustle</p>
                  <h3 className="text-4xl font-black mt-1">{(stats.totalMinutes / 60).toFixed(0)}h</h3>
                  <p className="text-[10px] font-bold text-primary uppercase mt-1">Total Study Hours</p>
                </div>
                <Clock className="h-12 w-12 text-primary opacity-20" />
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl bg-card">
              <CardContent className="p-8 flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-black uppercase tracking-widest">Active Squads</p>
                  <h3 className="text-4xl font-black mt-1">{stats.totalGroups}</h3>
                  <p className="text-[10px] font-bold text-primary uppercase mt-1">Guilds Formed</p>
                </div>
                <Users2 className="h-12 w-12 text-primary opacity-20" />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-secondary/50 p-1 rounded-xl h-12 w-full max-w-lg">
              <TabsTrigger value="users" className="rounded-lg font-bold flex-1">Students</TabsTrigger>
              <TabsTrigger value="guilds" className="rounded-lg font-bold flex-1">Guilds</TabsTrigger>
              <TabsTrigger value="exams" className="rounded-lg font-bold flex-1">Exams</TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg font-bold flex-1">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
                <CardHeader className="bg-secondary/20 pb-4">
                   <CardTitle className="text-xl font-black">User Directory</CardTitle>
                   <CardDescription>Manage student profiles and platform access.</CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase">Student</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Academic Info</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Total Hustle</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Joined</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : filteredUsers?.map((user: any) => (
                        <TableRow key={user.uid} className="hover:bg-secondary/10 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-background">
                                <AvatarImage src={user.photoURL} />
                                <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-sm">{user.displayName}</p>
                                <p className="text-[10px] text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                               <Badge variant="outline" className="text-[9px] font-black uppercase">{user.category || 'N/A'}</Badge>
                               <Badge variant="secondary" className="text-[9px] font-black">{user.batch || 'N/A'}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[200px]">{user.institution || 'No Institution Set'}</p>
                          </TableCell>
                          <TableCell className="text-right">
                             <p className="font-black text-primary text-base">{(user.total_study_minutes || 0).toLocaleString()}m</p>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-medium">
                            {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                             {user.uid !== SUPER_ADMIN_UID && (
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                                     disabled={loadingAction === user.uid}
                                   >
                                      {loadingAction === user.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                   </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent className="rounded-[2rem] border-none max-w-sm">
                                   <AlertDialogHeader>
                                     <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black">
                                       <AlertTriangle className="h-5 w-5" /> Delete Student
                                     </AlertDialogTitle>
                                     <AlertDialogDescription className="font-medium text-base">
                                       Are you sure? This will permanently delete <strong>{user.displayName}</strong>'s profile and remove them from any study guilds.
                                     </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter className="flex-col gap-2">
                                     <AlertDialogAction 
                                       onClick={() => handleDeleteUser(user.uid, user.displayName)}
                                       className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black h-12"
                                     >
                                       Yes, Delete Student
                                     </AlertDialogAction>
                                     <AlertDialogCancel className="rounded-xl font-bold h-12">Cancel</AlertDialogCancel>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                             )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="guilds">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupsLoading ? (
                  <div className="col-span-full py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                ) : groups?.map((group) => (
                  <Card key={group.id} className="rounded-[2.5rem] border-none shadow-xl overflow-hidden group">
                    <CardHeader className="bg-secondary/10 pb-4">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] uppercase">
                          {group.category} {group.batch}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase">
                           <Users className="h-3 w-3" />
                           {group.memberCount}/{group.memberLimit}
                        </div>
                      </div>
                      <CardTitle className="text-xl font-black mt-2">{group.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{group.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t">
                         <Button variant="outline" size="sm" className="rounded-xl font-bold h-9" asChild>
                            <a href={group.discordLink} target="_blank"><ExternalLink className="h-3.5 w-3.5 mr-2" /> Discord</a>
                         </Button>
                         
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full"
                                 disabled={loadingAction === group.id}
                               >
                                  {loadingAction === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                               </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none max-w-sm">
                               <AlertDialogHeader>
                                 <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black">
                                   <AlertTriangle className="h-5 w-5" /> Disband Guild
                                 </AlertDialogTitle>
                                 <AlertDialogDescription className="font-medium text-base">
                                   Are you absolutely sure? This will remove all <strong>{group.memberCount}</strong> members from <strong>{group.name}</strong> and delete the guild forever.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter className="flex-col gap-2">
                                 <AlertDialogAction 
                                   onClick={() => handleDeleteGroup(group.id, group.members)}
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black h-12"
                                 >
                                   Yes, Disband Guild
                                 </AlertDialogAction>
                                 <AlertDialogCancel className="rounded-xl font-bold h-12">Keep Guild</AlertDialogCancel>
                               </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="exams" className="space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-xl font-black flex items-center gap-2"><Timer className="h-5 w-5 text-primary" /> Global Exam Schedules</h2>
                 <Dialog open={isExamOpen} onOpenChange={setIsExamOpen}>
                   <DialogTrigger asChild>
                     <Button className="rounded-xl font-bold"><Plus className="h-4 w-4 mr-2" /> Add Exam</Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-md rounded-[2rem]">
                     <DialogHeader>
                       <DialogTitle className="text-2xl font-black">Post Exam Schedule</DialogTitle>
                     </DialogHeader>
                     <div className="space-y-4 py-4">
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase">Exam Title</Label>
                         <Input placeholder="e.g. HSC 2026 Board Final" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase">Exam Date & Time</Label>
                         <Input type="datetime-local" value={examDate} onChange={e => setExamDate(e.target.value)} />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase">Category</Label>
                         <Select value={examCategory} onValueChange={setExamCategory}>
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="SSC">SSC</SelectItem>
                             <SelectItem value="HSC">HSC</SelectItem>
                             <SelectItem value="Admission">Admission</SelectItem>
                             <SelectItem value="Job Prep">Job Prep</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase">Description</Label>
                         <Textarea placeholder="Short details about the exam..." value={examDesc} onChange={e => setExamDesc(e.target.value)} />
                       </div>
                     </div>
                     <DialogFooter>
                       <Button className="w-full h-12 font-black rounded-xl" onClick={handleAddExam} disabled={loadingAction === 'exam' || !examTitle || !examDate}>
                         {loadingAction === 'exam' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Launch Countdown'}
                       </Button>
                     </DialogFooter>
                   </DialogContent>
                 </Dialog>
              </div>

              <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase">Exam</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Category</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examsLoading ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : exams?.map((exam: any) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-bold">{exam.title}</TableCell>
                          <TableCell className="text-sm">
                            {exam.examDate ? new Date(exam.examDate.toDate()).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="text-[9px] font-black uppercase">{exam.category}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive rounded-full"
                              onClick={() => handleDeleteExam(exam.id)}
                              disabled={loadingAction === exam.id}
                            >
                              {loadingAction === exam.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card className="rounded-[2rem] border-none shadow-xl p-12 text-center space-y-4 bg-secondary/5 border-2 border-dashed">
                 <div className="bg-primary/10 p-6 rounded-full w-fit mx-auto">
                    <BarChart3 className="h-12 w-12 text-primary" />
                 </div>
                 <h3 className="text-2xl font-black tracking-tighter">Advanced Analytics Engine</h3>
                 <p className="text-muted-foreground max-w-md mx-auto font-medium">
                    Deep insights into retention rates, batch-wise performance, and peak study hours as the platform scales.
                 </p>
                 <Button variant="outline" className="rounded-full font-bold px-8">Coming Soon</Button>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminRoute>
  );
}
