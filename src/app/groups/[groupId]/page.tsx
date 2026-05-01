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
  LayoutDashboard, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  ExternalLink,
  Clock,
  LogOut,
  UserPlus,
  Loader2,
  Trash2,
  Megaphone,
  Send,
  Trophy,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { 
  approveRequest, 
  declineRequest, 
  leaveGroup, 
  deleteGroup,
  addGroupTask,
  addGroupAnnouncement,
  deleteGroupAnnouncement,
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

export default function GroupDashboardPage() {
  const { groupId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // Group Doc
  const groupRef = useMemo(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, loading: groupLoading } = useDoc<StudyGroup>(groupRef as any);

  // Announcements
  const announcementsQuery = useMemo(() => {
    return query(collection(firestore, 'groups', groupId as string, 'announcements'), orderBy('createdAt', 'desc'), limit(10));
  }, [firestore, groupId]);
  const { data: announcements } = useCollection<GroupAnnouncement>(announcementsQuery);

  // Requests (for admin)
  const requestsQuery = useMemo(() => {
    return query(collection(firestore, 'groups', groupId as string, 'requests'), where('status', '==', 'pending'));
  }, [firestore, groupId]);
  const { data: requests } = useCollection<any>(requestsQuery);

  // Group Members detailed info with task stats
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  const [totalGuildMinutesToday, setTotalGuildMinutesToday] = useState(0);

  useEffect(() => {
    if (group?.members) {
      const fetchMembers = async () => {
        const membersData = [];
        let totalMinutes = 0;
        for (const mid of group.members) {
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
    if (confirm("Are you sure you want to leave this guild?")) {
      await leaveGroup(firestore, groupId as string, user!.uid);
      router.push('/groups');
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
  const [taskDur, setTaskDur] = useState('60');

  const handleAddTask = async () => {
    if (!taskSub || !taskChap) return;
    setLoading(true);
    try {
      await addGroupTask(firestore, groupId as string, {
        subjectId: 'group-task',
        chapterId: 'group-task-' + Date.now(),
        subjectName: taskSub,
        chapterName: taskChap,
        date: new Date().toISOString().split('T')[0],
        duration: parseInt(taskDur)
      });
      setIsTaskOpen(false);
      setTaskSub('');
      setTaskChap('');
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
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Guild Header */}
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Users2 className="h-48 w-48" />
            </div>
            <CardContent className="p-8 md:p-12 space-y-6 relative">
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
                  <p className="text-white/60 font-medium max-w-2xl text-lg">{group.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {group.discordLink && (
                    <Button asChild variant="secondary" className="rounded-full font-bold px-8 h-14 text-base shadow-lg shadow-primary/20 transition-all hover:scale-105">
                      <a href={group.discordLink} target="_blank">
                        <MessageSquare className="mr-2 h-5 w-5" /> Discord Guild
                      </a>
                    </Button>
                  )}
                  {(isCreator || isMod) && (
                    <Dialog open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="rounded-full font-bold px-6 h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white">
                          <UserPlus className="mr-2 h-5 w-5" /> Requests ({requests?.length || 0})
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
                  )}
                  
                  {isCreator ? (
                    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                      <DialogTrigger asChild>
                         <Button variant="ghost" className="text-white/40 hover:bg-destructive/20 hover:text-white rounded-full h-14 w-14">
                            <Trash2 className="h-5 w-5" />
                         </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2rem] border-none max-w-sm">
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
                    <Button variant="ghost" className="text-white/40 hover:bg-destructive/20 hover:text-white rounded-full h-14 w-14" onClick={handleLeave}>
                      <LogOut className="h-5 w-5" />
                    </Button>
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
                <CardHeader className="flex flex-row items-center justify-between border-b bg-secondary/10 pb-6">
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                      <Trophy className="h-6 w-6 text-primary" /> Member Rankings
                    </CardTitle>
                    <CardDescription className="font-bold text-xs uppercase tracking-widest">Today's Guild Leaders</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {memberProfiles.map((member, idx) => {
                      const studyProgress = Math.min(100, (member.daily_study_minutes || 0) / (member.daily_goal_minutes || 360) * 100);
                      return (
                        <div key={member.uid} className="p-6 hover:bg-secondary/10 transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                              <span className="font-black text-2xl italic text-muted-foreground/20 w-8 group-hover:text-primary transition-colors">#{idx + 1}</span>
                              <Avatar className="h-14 w-14 ring-2 ring-background shadow-lg">
                                <AvatarImage src={member.photoURL} />
                                <AvatarFallback className="font-black text-lg">{member.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              <div className="space-y-1">
                                <p className="font-black text-lg tracking-tight">{member.displayName}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                   <Badge variant="secondary" className="text-[10px] h-5 uppercase font-black tracking-tighter bg-primary/5 text-primary border-none">
                                      {member.daily_study_minutes || 0}m studied
                                   </Badge>
                                   <Badge variant={member.taskProgress === 100 ? 'default' : 'outline'} className="text-[10px] h-5 uppercase font-black tracking-tighter">
                                      {member.completedTasks}/{member.totalTasks} Tasks
                                   </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-1 max-w-[240px] space-y-3">
                               <div className="space-y-1.5">
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                     <span>Guild Objective</span>
                                     <span>{Math.round(member.taskProgress)}%</span>
                                  </div>
                                  <Progress value={member.taskProgress} className="h-2" />
                               </div>
                               <div className="space-y-1.5">
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
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
                     <div className="p-6 border-b bg-primary/5 space-y-4">
                        <Textarea 
                          placeholder="Post a guild notice or motivational quote..." 
                          className="min-h-[100px] rounded-2xl border-none shadow-inner resize-none bg-white text-base font-medium"
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
                   <ScrollArea className="h-[500px]">
                      <div className="p-8 space-y-8">
                        {announcements && announcements.length > 0 ? (
                          announcements.map((msg) => (
                            <div key={msg.id} className="flex gap-4 group">
                               <Avatar className="h-12 w-12 shrink-0 shadow-md">
                                  <AvatarFallback className="bg-primary/10 text-primary font-black">{msg.authorName?.[0]}</AvatarFallback>
                               </Avatar>
                               <div className="space-y-2 flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                     <span className="font-black text-base">{msg.authorName}</span>
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                          {msg.createdAt ? format(msg.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                        </span>
                                        {(isCreator || isMod) && (
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive rounded-full hover:bg-destructive/10"
                                            onClick={() => handleDeleteAnnouncement(msg.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                     </div>
                                  </div>
                                  <div className="p-5 rounded-3xl rounded-tl-none bg-secondary/30 text-base font-medium leading-relaxed shadow-sm">
                                     {msg.content}
                                  </div>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-24 text-muted-foreground italic space-y-4">
                             <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <Megaphone className="h-10 w-10 opacity-20" />
                             </div>
                             <p className="text-xs font-black opacity-30 tracking-[0.2em] uppercase">No broadcasts from leadership</p>
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
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/10 p-8">
                  <CardTitle className="text-2xl font-black flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-primary" /> Objectives
                  </CardTitle>
                  {(isCreator || isMod) && (
                    <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20">
                          <Plus className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none">
                        <DialogHeader>
                          <DialogTitle className="text-3xl font-black tracking-tighter">Set Guild Task</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-6">
                          <div className="space-y-2">
                            <Label className="font-black text-xs uppercase tracking-widest opacity-50">Subject</Label>
                            <Input placeholder="e.g. Higher Math" className="h-12 rounded-xl" value={taskSub} onChange={e => setTaskSub(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-black text-xs uppercase tracking-widest opacity-50">Specific Goal</Label>
                            <Input placeholder="e.g. Calculus Practice" className="h-12 rounded-xl" value={taskChap} onChange={e => setTaskChap(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-black text-xs uppercase tracking-widest opacity-50">Target Duration (min)</Label>
                            <Input type="number" className="h-12 rounded-xl" value={taskDur} onChange={e => setTaskDur(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddTask} disabled={loading} className="w-full h-14 font-black text-lg rounded-2xl shadow-xl shadow-primary/20">
                            Push to All Members
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="p-8 space-y-8 relative">
                   <div className="space-y-2">
                      <p className="text-xs text-white/50 font-black uppercase tracking-widest italic">Guild Strategy</p>
                      <p className="text-sm font-medium leading-relaxed text-white/80">
                        Leaders push mandatory tasks directly to every member's central planner. Success depends on everyone hitting their marks.
                      </p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center space-y-2">
                         <h4 className="text-3xl font-black">{memberProfiles.length}</h4>
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Active Squad</p>
                      </div>
                      <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center space-y-2">
                         <h4 className="text-3xl font-black">{totalGuildMinutesToday}</h4>
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Squad Mins</p>
                      </div>
                   </div>

                   <Progress value={(memberProfiles.length / (group.memberLimit || 15)) * 100} className="h-2 bg-white/10" />
                   
                   <div className="p-5 bg-primary/10 rounded-3xl border border-primary/20">
                      <p className="text-xs font-bold leading-relaxed text-primary-foreground">
                        Completing Guild Tasks on time boosts the group's global ranking.
                      </p>
                   </div>
                </CardContent>
              </Card>

              {/* Rules & Guidelines */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-black tracking-tighter">Guild Laws</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">01</span>
                     <p className="text-sm font-bold text-muted-foreground leading-relaxed">Maximum focus during sessions. No slackers allowed.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">02</span>
                     <p className="text-sm font-bold text-muted-foreground leading-relaxed">Guild tasks must be completed within 24 hours of being pushed.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                     <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">03</span>
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
