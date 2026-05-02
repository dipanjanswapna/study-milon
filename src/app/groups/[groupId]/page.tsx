
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  limit
} from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users2, 
  MessageSquare, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  Flame, 
  AlertTriangle,
  Settings,
  Notebook,
  Megaphone,
  Send,
  Trophy,
  Trash2,
  UserPlus,
  Loader2,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { 
  approveRequest, 
  declineRequest, 
  leaveGroup, 
  deleteGroup,
  addGroupTask,
  addGroupAnnouncement,
  deleteGroupAnnouncement,
  updateGroup,
  cleanupExpiredRequests,
  type StudyGroup,
  type GroupAnnouncement
} from '@/firebase/firestore/groups';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function GroupDashboardPage() {
  const { groupId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // Group Doc
  const groupRef = useMemo(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, loading: groupLoading } = useDoc<StudyGroup>(groupRef as any);

  // Auto-cleanup expired requests on load if admin/mod
  useEffect(() => {
    if (groupId) {
      cleanupExpiredRequests(firestore, groupId as string);
    }
  }, [groupId, firestore]);

  // Announcements
  const announcementsQuery = useMemo(() => {
    return query(collection(firestore, 'groups', groupId as string, 'announcements'), orderBy('createdAt', 'desc'), limit(15));
  }, [firestore, groupId]);
  const { data: announcements } = useCollection<GroupAnnouncement>(announcementsQuery);

  // Requests (for admin)
  const requestsQuery = useMemo(() => {
    return query(collection(firestore, 'groups', groupId as string, 'requests'), where('status', '==', 'pending'));
  }, [firestore, groupId]);
  const { data: requests } = useCollection<any>(requestsQuery);

  // Edit State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editBatch, setEditBatch] = useState('');
  const [editDiscord, setEditDiscord] = useState('');

  useEffect(() => {
    if (group) {
      setEditName(group.name);
      setEditDesc(group.description);
      setEditCat(group.category);
      setEditBatch(group.batch);
      setEditDiscord(group.discordLink);
    }
  }, [group]);

  // Group Members detailed info with task stats
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  const [totalGuildMinutesToday, setTotalGuildMinutesToday] = useState(0);

  useEffect(() => {
    if (group?.members) {
      const fetchMembers = async () => {
        const membersData = [];
        let totalMinutes = 0;
        // Use unique set of member UIDs to prevent duplicate key errors
        const uniqueMemberUids = Array.from(new Set(group.members));
        
        for (const mid of uniqueMemberUids) {
          // Fetch user profile
          const mSnap = await getDocs(query(collection(firestore, 'users'), where('uid', '==', mid)));
          if (!mSnap.empty) {
            const userData = { ...mSnap.docs[0].data(), id: mSnap.docs[0].id };
            totalMinutes += (userData.daily_study_minutes || 0);
            
            // Fetch task stats for this group
            const tasksSnap = await getDocs(query(
              collection(firestore, 'users', mid, 'tasks'), 
              where('groupId', '==', groupId)
            ));
            
            const totalTasks = tasksSnap.docs.length;
            const completedTasks = tasksSnap.docs.filter(d => d.data().completed).length;
            const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            membersData.push({ 
              ...userData, 
              taskProgress, 
              completedTasks, 
              totalTasks 
            });
          }
        }
        setTotalGuildMinutesToday(totalMinutes);
        setMemberProfiles(membersData.sort((a, b) => (b.daily_study_minutes || 0) - (a.daily_study_minutes || 0)));
      };
      fetchMembers();
    }
  }, [group?.members, firestore, groupId]);

  const isCreator = user?.uid === group?.creatorId;
  const isMod = group?.moderators?.includes(user?.uid || '');

  const handleApprove = async (rid: string, uid: string) => {
    try {
      await approveRequest(firestore, groupId as string, rid, uid);
      toast({ title: "Welcome!", description: "Member added to the guild." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    }
  };

  const handleDecline = async (rid: string) => {
    await declineRequest(firestore, groupId as string, rid);
  };

  const handleLeave = async () => {
    setLoading(true);
    try {
      await leaveGroup(firestore, groupId as string, user!.uid);
      router.push('/groups');
      toast({ title: "Guild Left", description: "You have left the study guild." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setLoading(false);
      setIsLeaveOpen(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editName || !editDiscord) return;
    setLoading(true);
    try {
      await updateGroup(firestore, groupId as string, {
        name: editName,
        description: editDesc,
        category: editCat,
        batch: editBatch,
        discordLink: editDiscord
      });
      setIsEditOpen(false);
      toast({ title: "Guild Updated", description: "Your study guild settings have been saved." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    setLoading(true);
    try {
      await deleteGroup(firestore, groupId as string, group.members);
      toast({ title: "Guild Disbanded", description: "The study guild has been permanently deleted." });
      router.push('/groups');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setLoading(true);
    try {
      await addGroupAnnouncement(firestore, groupId as string, user!.uid, user!.displayName || 'Admin', announcementText.trim());
      setAnnouncementText('');
      toast({ title: "Announcement Posted", description: "All guild members can see your message." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (aid: string) => {
    try {
      await deleteGroupAnnouncement(firestore, groupId as string, aid);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    }
  };

  // Task Creation State
  const [taskSub, setTaskSub] = useState('');
  const [taskChap, setTaskChap] = useState('');
  const [taskNote, setTaskNote] = useState('');
  const [taskDurHours, setTaskDurHours] = useState('1');
  const [taskDurMins, setTaskDurMins] = useState('0');

  const handleAddTask = async () => {
    if (!taskSub || !taskChap) return;
    const totalMinutes = (parseInt(taskDurHours) * 60) + parseInt(taskDurMins);
    if (totalMinutes <= 0) return;
    
    setLoading(true);
    try {
      await addGroupTask(firestore, groupId as string, {
        subjectId: 'group-task',
        chapterId: 'group-task-' + Date.now(),
        subjectName: taskSub,
        chapterName: taskChap,
        note: taskNote.trim(),
        date: new Date().toISOString().split('T')[0],
        duration: totalMinutes
      });
      setIsTaskOpen(false);
      setTaskSub('');
      setTaskChap('');
      setTaskNote('');
      toast({ title: "Task Pushed!", description: "All guild members received this task." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (groupLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-40 rounded-[2rem]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="md:col-span-2 h-96 rounded-[2rem]" />
            <Skeleton className="h-96 rounded-[2rem]" />
          </div>
        </div>
      </div>
    );
  }

  if (!group) return <div className="p-20 text-center">Group not found</div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Guild Header */}
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Users2 className="h-48 w-48" />
            </div>
            <CardContent className="p-6 md:p-12 space-y-6 relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary/20 hover:bg-primary/30 text-primary-foreground border-none font-black text-xs uppercase px-3 py-1">
                      {group.category} {group.batch}
                    </Badge>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-white/70">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Leader: {memberProfiles.find(m => m.uid === group.creatorId)?.displayName || 'Leader'}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 rounded-full text-xs font-bold text-orange-400">
                      <Flame className="h-4 w-4" /> Guild Hustle: {totalGuildMinutesToday}m Today
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none text-white">{group.name}</h1>
                  <p className="text-white/60 font-medium max-w-2xl text-base md:text-lg">{group.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {group.discordLink && (
                    <Button asChild variant="secondary" className="rounded-full font-bold px-6 md:px-8 h-12 md:h-14 text-sm md:text-base shadow-lg shadow-primary/20 transition-all hover:scale-105">
                      <a href={group.discordLink} target="_blank">
                        <MessageSquare className="mr-2 h-5 w-5" /> Discord Guild
                      </a>
                    </Button>
                  )}
                  
                  {(isCreator || isMod) && (
                    <div className="flex gap-2">
                       <Dialog open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="rounded-full font-bold px-5 h-12 md:h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white text-sm">
                            <UserPlus className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Requests ({requests?.length || 0})
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-[2rem] border-none">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Join Requests</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[400px] py-4">
                            {requests && requests.length > 0 ? (
                              <div className="space-y-4">
                                {requests.map((req: any) => (
                                  <div key={req.id} className="flex items-center justify-between p-5 bg-secondary/30 rounded-3xl border">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10">
                                        <AvatarImage src={req.userPhoto} />
                                        <AvatarFallback>{req.userName?.[0]}</AvatarFallback>
                                      </Avatar>
                                      <span className="font-bold">{req.userName}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" className="rounded-full font-bold" onClick={() => handleApprove(req.id, req.userId)}>Accept</Button>
                                      <Button size="sm" variant="ghost" className="rounded-full text-destructive font-bold" onClick={() => handleDecline(req.id)}>Decline</Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-10 text-muted-foreground italic">No pending requests.</div>
                            )}
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>

                      {isCreator && (
                        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                          <DialogTrigger asChild>
                             <Button variant="outline" className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-white/5 border-white/10 hover:bg-white/10 text-white">
                                <Settings className="h-5 w-5" />
                             </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl">
                             <DialogHeader>
                                <DialogTitle className="text-2xl font-black">Guild Settings</DialogTitle>
                             </DialogHeader>
                             <div className="space-y-4 py-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Guild Name</Label>
                                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</Label>
                                  <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                                    <Select value={editCat} onValueChange={setEditCat}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="SSC">SSC</SelectItem>
                                        <SelectItem value="HSC">HSC</SelectItem>
                                        <SelectItem value="Admission">Admission</SelectItem>
                                        <SelectItem value="Job Prep">Job Prep</SelectItem>
                                        <SelectItem value="University">University</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Batch</Label>
                                    <Input value={editBatch} onChange={e => setEditBatch(e.target.value)} />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Discord Link</Label>
                                  <Input value={editDiscord} onChange={e => setEditDiscord(e.target.value)} />
                                </div>
                             </div>
                             <DialogFooter>
                                <Button className="w-full h-12 font-black rounded-xl" onClick={handleUpdateGroup} disabled={loading || !editName || !editDiscord}>
                                   {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                                </Button>
                             </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}
                  
                  {isCreator ? (
                    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                      <DialogTrigger asChild>
                         <Button variant="ghost" className="text-white/40 hover:bg-destructive/20 hover:text-white rounded-full h-12 w-12 md:h-14 md:w-14">
                            <Trash2 className="h-5 w-5" />
                         </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2rem] border-none max-sm">
                        <DialogHeader>
                           <DialogTitle className="flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-5 w-5" /> Disband Guild
                           </DialogTitle>
                           <DialogDescription className="font-medium text-base pt-2">
                              Are you absolutely sure? This will remove all members and delete the guild forever.
                           </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex-col gap-2 mt-4">
                           <Button variant="destructive" className="w-full h-12 rounded-xl font-bold" onClick={handleDeleteGroup} disabled={loading}>
                              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Yes, Disband Guild"}
                           </Button>
                           <Button variant="ghost" className="w-full h-12 rounded-xl font-bold" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <AlertDialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" className="text-white/40 hover:bg-destructive/20 hover:text-white rounded-full h-12 w-12 md:h-14 md:w-14">
                          <LogOut className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2rem] border-none max-sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <LogOut className="h-5 w-5" /> Leave Guild
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-medium text-base pt-2">
                            Are you sure you want to leave <strong>{group.name}</strong>? You will lose access to guild objectives and broadcasts.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col gap-2 mt-4">
                          <AlertDialogAction 
                            className="w-full h-12 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                            onClick={handleLeave}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Yes, Leave Guild"}
                          </AlertDialogAction>
                          <AlertDialogCancel className="w-full h-12 rounded-xl font-bold">Stay in Squad</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Main Activity Area (8 cols) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Member Activity Tracker */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b bg-secondary/10 pb-6 gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                      <Trophy className="h-6 w-6 text-primary" /> Member Rankings
                    </CardTitle>
                    <CardDescription className="font-bold text-xs uppercase tracking-widest">Today's Guild Leaders</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-black border-primary/20 text-primary uppercase text-[10px]">
                    {memberProfiles.length} Members Active
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {memberProfiles.map((member, idx) => {
                      const studyProgress = Math.min(100, (member.daily_study_minutes || 0) / (member.daily_goal_minutes || 360) * 100);
                      return (
                        <div key={`${member.uid}-${idx}`} className="p-4 md:p-6 hover:bg-secondary/10 transition-all group">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <Link href={`/profile/${member.uid}`} className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
                              <span className="font-black text-xl md:text-2xl italic text-muted-foreground/20 w-8 group-hover:text-primary transition-colors">#{idx + 1}</span>
                              <div className="relative">
                                <Avatar className="h-12 w-12 md:h-14 md:w-14 ring-2 ring-background shadow-lg">
                                  <AvatarImage src={member.photoURL} />
                                  <AvatarFallback className="font-black text-lg">{member.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                {idx < 3 && (
                                  <div className={cn(
                                    "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm",
                                    idx === 0 ? "bg-yellow-400 text-white" : idx === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
                                  )}>
                                    <Trophy className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1 min-w-0">
                                <p className="font-black text-base md:text-lg tracking-tight truncate group-hover:text-primary transition-colors">{member.displayName}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                   <Badge variant="secondary" className="text-[9px] h-4 uppercase font-black tracking-tighter bg-primary/5 text-primary border-none">
                                      {member.daily_study_minutes || 0}m studied
                                   </Badge>
                                   <Badge variant={member.taskProgress === 100 ? 'default' : 'outline'} className="text-[9px] h-4 uppercase font-black tracking-tighter">
                                      {member.completedTasks}/{member.totalTasks} Tasks
                                   </Badge>
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all ml-auto" />
                            </Link>
                            
                            <div className="flex-1 sm:max-w-[240px] space-y-3">
                               <div className="space-y-1.5">
                                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                     <span>Guild Objectives</span>
                                     <span>{Math.round(member.taskProgress)}%</span>
                                  </div>
                                  <Progress value={member.taskProgress} className="h-2" />
                               </div>
                               <div className="space-y-1.5">
                                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-primary">
                                     <span>Daily Grind</span>
                                     <span>{Math.round(studyProgress)}%</span>
                                  </div>
                                  <Progress value={studyProgress} className="h-2 bg-primary/10" />
                               </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Guild Announcements */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="bg-primary/5 pb-4">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-primary" /> Guild Broadcasts
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-black tracking-widest uppercase">Latest Notices</Badge>
                   </div>
                </CardHeader>
                <CardContent className="p-0">
                   {(isCreator || isMod) && (
                     <div className="p-5 md:p-6 border-b bg-primary/5 space-y-4">
                        <Textarea 
                          placeholder="Post a guild notice or motivational quote..." 
                          className="min-h-[100px] rounded-2xl border-none shadow-inner resize-none bg-white text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/20"
                          value={announcementText}
                          onChange={e => setAnnouncementText(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button 
                            className="rounded-full px-8 h-12 font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20" 
                            onClick={handlePostAnnouncement}
                            disabled={loading || !announcementText.trim()}
                          >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Broadcast
                          </Button>
                        </div>
                     </div>
                   )}
                   <ScrollArea className="h-[400px] md:h-[500px]">
                      <div className="p-6 md:p-8 space-y-8">
                        {announcements && announcements.length > 0 ? (
                          announcements.map((msg) => (
                            <div key={msg.id} className="flex gap-3 md:gap-4 group">
                               <Link href={`/profile/${msg.authorId}`}>
                                 <Avatar className="h-10 w-10 md:h-12 md:w-12 shrink-0 shadow-md transition-transform hover:scale-110">
                                    <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">{msg.authorName?.[0]}</AvatarFallback>
                                 </Avatar>
                               </Link>
                               <div className="space-y-2 flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                     <Link href={`/profile/${msg.authorId}`} className="font-black text-sm md:text-base truncate pr-2 hover:text-primary transition-colors">{msg.authorName}</Link>
                                     <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                                          {msg.createdAt ? format(msg.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                        </span>
                                        {(isCreator || isMod) && (
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive rounded-full hover:bg-destructive/10"
                                            onClick={() => handleDeleteAnnouncement(msg.id)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                     </div>
                                  </div>
                                  <div className="p-4 md:p-5 rounded-3xl rounded-tl-none bg-secondary/30 text-sm md:text-base font-medium leading-relaxed shadow-sm">
                                     {msg.content}
                                  </div>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-20 text-muted-foreground italic space-y-4">
                             <div className="bg-secondary/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                <Megaphone className="h-8 w-8 opacity-20" />
                             </div>
                             <p className="text-[10px] font-black opacity-30 tracking-[0.2em] uppercase">No broadcasts from leadership</p>
                          </div>
                        )}
                      </div>
                   </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Controls (4 cols) */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Guild Tasks Dashboard */}
              <Card className="rounded-[2.5rem] border-none shadow-2xl bg-[#2A2D5B] text-white overflow-hidden relative">
                <div className="absolute -bottom-10 -right-10 opacity-10">
                   <CheckCircle2 className="h-40 w-40" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/10 p-6 md:p-8">
                  <CardTitle className="text-xl md:text-2xl font-black flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-primary" /> Objectives
                  </CardTitle>
                  {(isCreator || isMod) && (
                    <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20">
                          <Plus className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-3xl font-black tracking-tighter">Set Guild Task</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] px-1">
                          <div className="space-y-6 py-6">
                            <div className="space-y-2">
                              <Label className="font-black text-xs uppercase tracking-widest opacity-50">Subject</Label>
                              <Input placeholder="e.g. Higher Math" className="h-12 rounded-xl" value={taskSub} onChange={e => setTaskSub(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="font-black text-xs uppercase tracking-widest opacity-50">Specific Goal / Chapter</Label>
                              <Input placeholder="e.g. Calculus Practice" className="h-12 rounded-xl" value={taskChap} onChange={e => setTaskChap(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="font-black text-xs uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                                <Notebook className="h-3 w-3" /> Note
                              </Label>
                              <Textarea 
                                placeholder="Instructions for the guild members..." 
                                className="min-h-[100px] rounded-xl resize-none"
                                value={taskNote}
                                onChange={e => setTaskNote(e.target.value)}
                              />
                            </div>
                            <div className="space-y-3">
                              <Label className="font-black text-xs uppercase tracking-widest opacity-50">Planned Duration</Label>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Hours</Label>
                                  <Input type="number" min="0" value={taskDurHours} onChange={e => setTaskDurHours(e.target.value)} className="h-12 rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Minutes</Label>
                                  <Input type="number" min="0" max="59" value={taskDurMins} onChange={e => setTaskDurMins(e.target.value)} className="h-12 rounded-xl" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                        <DialogFooter className="pt-4 border-t">
                          <Button onClick={handleAddTask} disabled={loading || !taskSub || !taskChap} className="w-full h-14 font-black text-lg rounded-2xl shadow-xl shadow-primary/20">
                            Push to All Members
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8 relative">
                   <div className="space-y-2">
                      <p className="text-xs text-white/50 font-black uppercase tracking-widest italic">Guild Strategy</p>
                      <p className="text-sm font-medium leading-relaxed text-white/80">
                        Leaders push mandatory tasks directly to every member's central planner. Success depends on everyone hitting their marks.
                      </p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-3xl p-5 md:p-6 border border-white/10 text-center space-y-2">
                         <h4 className="text-2xl md:text-3xl font-black">{memberProfiles.length}</h4>
                         <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-40">Active Squad</p>
                      </div>
                      <div className="bg-white/5 rounded-3xl p-5 md:p-6 border border-white/10 text-center space-y-2">
                         <h4 className="text-2xl md:text-3xl font-black">{totalGuildMinutesToday}</h4>
                         <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-40">Squad Mins</p>
                      </div>
                   </div>

                   <div className="space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/50">
                        <span>Squad Capacity</span>
                        <span>{memberProfiles.length}/{group.memberLimit || 15}</span>
                     </div>
                     <Progress value={(memberProfiles.length / (group.memberLimit || 15)) * 100} className="h-2 bg-white/10" />
                   </div>
                   
                   <div className="p-5 bg-primary/10 rounded-3xl border border-primary/20">
                      <p className="text-xs font-bold leading-relaxed text-primary-foreground">
                        Completing Guild Tasks on time boosts the group's global ranking.
                      </p>
                   </div>
                </CardContent>
              </Card>

              {/* Rules & Guidelines */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="p-6 md:p-8 pb-4">
                  <CardTitle className="text-2xl font-black tracking-tighter">Guild Laws</CardTitle>
                </CardHeader>
                <CardContent className="p-6 md:p-8 pt-0 space-y-6">
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">01</span>
                     <p className="text-sm font-bold text-muted-foreground leading-relaxed">Maximum focus during sessions. No slackers allowed.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">02</span>
                     <p className="text-sm font-bold text-muted-foreground leading-relaxed">Guild tasks must be completed within 24 hours of being pushed.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">03</span>
                     <p className="text-sm font-bold text-muted-foreground leading-relaxed">Support your squad. Share resources in the guild library.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
