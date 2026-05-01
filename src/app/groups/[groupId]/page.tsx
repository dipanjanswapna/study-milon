
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
  Send
} from 'lucide-react';
import { 
  approveRequest, 
  declineRequest, 
  leaveGroup, 
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
  DialogFooter
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
  useEffect(() => {
    if (group?.members) {
      const fetchMembers = async () => {
        const membersData = [];
        for (const mid of group.members) {
          // Fetch user profile
          const mSnap = await getDocs(query(collection(firestore, 'users'), where('uid', '==', mid)));
          if (!mSnap.empty) {
            const userData = { ...mSnap.docs[0].data(), id: mSnap.docs[0].id };
            
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
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-primary text-primary-foreground relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Users2 className="h-40 w-40" />
            </div>
            <CardContent className="p-8 md:p-12 space-y-6 relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-black text-xs uppercase px-3 py-1">
                      {group.category} {group.batch}
                    </Badge>
                    <span className="text-sm font-bold opacity-80 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Leader: {memberProfiles.find(m => m.uid === group.creatorId)?.displayName || 'Leader'}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{group.name}</h1>
                  <p className="text-primary-foreground/80 font-medium max-w-2xl">{group.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {group.discordLink && (
                    <Button asChild variant="secondary" className="rounded-full font-bold px-6 h-12">
                      <a href={group.discordLink} target="_blank">
                        <MessageSquare className="mr-2 h-5 w-5" /> Discord Fast-Link
                      </a>
                    </Button>
                  )}
                  {(isCreator || isMod) && (
                    <Dialog open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="rounded-full font-bold px-6 h-12 bg-white/10 border-white/20 hover:bg-white/20">
                          <UserPlus className="mr-2 h-5 w-5" /> Manage Requests ({requests?.length || 0})
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-black">Membership Requests</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[400px] py-4">
                          {requests && requests.length > 0 ? (
                            <div className="space-y-4">
                              {requests.map((req: any) => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border">
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarImage src={req.userPhoto} />
                                      <AvatarFallback>{req.userName[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-bold">{req.userName}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleApprove(req.id, req.userId)}>Approve</Button>
                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDecline(req.id)}>Decline</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground italic">No pending applications.</div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="ghost" className="text-white hover:bg-destructive/20 hover:text-white" onClick={handleLeave}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Main Activity Area (8 cols) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Member Activity Tracker */}
              <Card className="rounded-[2rem] border-none shadow-xl bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                      <Clock className="h-6 w-6 text-primary" /> Member Activity
                    </CardTitle>
                    <CardDescription>Live study tracking and guild task completion</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {memberProfiles.map((member, idx) => {
                      const studyProgress = Math.min(100, (member.daily_study_minutes || 0) / (member.daily_goal_minutes || 360) * 100);
                      return (
                        <div key={member.uid} className="p-5 rounded-2xl bg-secondary/20 border border-secondary/50 hover:border-primary/30 transition-all">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-xl italic text-muted-foreground/30 w-6">#{idx + 1}</span>
                              <Avatar className="h-12 w-12 ring-2 ring-background">
                                <AvatarImage src={member.photoURL} />
                                <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-lg">{member.displayName}</p>
                                <div className="flex items-center gap-2">
                                   <Badge variant="secondary" className="text-[9px] h-4 uppercase font-bold tracking-tighter">
                                      {member.daily_study_minutes || 0}m studied today
                                   </Badge>
                                   <Badge variant={member.taskProgress === 100 ? 'default' : 'outline'} className="text-[9px] h-4 uppercase font-bold tracking-tighter">
                                      Tasks: {member.completedTasks}/{member.totalTasks}
                                   </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-1 max-w-[200px] space-y-2">
                               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  <span>Task Progress</span>
                                  <span>{Math.round(member.taskProgress)}%</span>
                               </div>
                               <Progress value={member.taskProgress} className="h-1.5" />
                               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                  <span>Study Goal</span>
                                  <span>{Math.round(studyProgress)}%</span>
                               </div>
                               <Progress value={studyProgress} className="h-1.5 bg-primary/10" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Guild Announcements (Chat/Notes area) */}
              <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="bg-secondary/30 pb-4">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-primary" /> Guild Announcements
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-bold">LATEST UPDATES</Badge>
                   </div>
                </CardHeader>
                <CardContent className="p-0">
                   {(isCreator || isMod) && (
                     <div className="p-6 border-b bg-primary/5 space-y-3">
                        <Textarea 
                          placeholder="Post a guild notice or motivational quote..." 
                          className="min-h-[80px] rounded-xl border-none shadow-inner resize-none bg-white"
                          value={announcementText}
                          onChange={e => setAnnouncementText(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button 
                            size="sm" 
                            className="rounded-full px-6 font-bold" 
                            onClick={handlePostAnnouncement}
                            disabled={loading || !announcementText.trim()}
                          >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Broadcast
                          </Button>
                        </div>
                     </div>
                   )}
                   <ScrollArea className="h-[400px]">
                      <div className="p-6 space-y-6">
                        {announcements && announcements.length > 0 ? (
                          announcements.map((msg) => (
                            <div key={msg.id} className="flex gap-4 group">
                               <Avatar className="h-10 w-10 shrink-0">
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{msg.authorName[0]}</AvatarFallback>
                               </Avatar>
                               <div className="space-y-1 flex-1">
                                  <div className="flex items-center justify-between">
                                     <span className="font-black text-sm">{msg.authorName}</span>
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                          {msg.createdAt ? format(msg.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                        </span>
                                        {(isCreator || isMod) && (
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                            onClick={() => handleDeleteAnnouncement(msg.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                     </div>
                                  </div>
                                  <div className="p-4 rounded-2xl rounded-tl-none bg-secondary/40 text-sm font-medium leading-relaxed">
                                     {msg.content}
                                  </div>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-20 text-muted-foreground italic space-y-2">
                             <Megaphone className="h-12 w-12 mx-auto opacity-10" />
                             <p className="text-sm font-bold opacity-30 tracking-widest uppercase">No notices from leadership yet.</p>
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
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-[#2A2D5B] text-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-destructive" /> Guild Objective
                  </CardTitle>
                  {(isCreator || isMod) && (
                    <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-black">Set Guild Objective</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input placeholder="e.g. Physics" value={taskSub} onChange={e => setTaskSub(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Chapter / Goal</Label>
                            <Input placeholder="e.g. Circular Motion" value={taskChap} onChange={e => setTaskChap(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Recommended Time (min)</Label>
                            <Input type="number" value={taskDur} onChange={e => setTaskDur(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddTask} disabled={loading} className="w-full h-12 font-bold">
                            Push to All Members
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                   <p className="text-xs text-white/60 font-medium italic">Leaders push mandatory tasks directly to every member's central planner.</p>
                   
                   {/* Guild Status Board */}
                   <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center space-y-4">
                      <LayoutDashboard className="h-10 w-10 text-white/20 mx-auto" />
                      <div className="space-y-1">
                         <h4 className="text-2xl font-black">{memberProfiles.length}</h4>
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Active Hustlers</p>
                      </div>
                      <Progress value={(memberProfiles.length / (group.memberLimit || 15)) * 100} className="h-1.5 bg-white/10" />
                   </div>
                   
                   <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20">
                      <p className="text-[10px] font-black uppercase text-destructive tracking-widest mb-1">Guild Protocol</p>
                      <p className="text-xs font-medium opacity-80 leading-relaxed">
                        Completing Guild Tasks on time boosts the group's reputation and your personal rank.
                      </p>
                   </div>
                </CardContent>
              </Card>

              {/* Rules & Guidelines */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-tight">Guild Rules</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-4 font-medium text-muted-foreground">
                  <div className="flex gap-3 items-start">
                     <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                     <p>Maximum focus during study sessions. No distractions.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                     <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                     <p>Complete guild tasks within the deadline to maintain eligibility.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                     <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                     <p>Inactivity for 3 days without prior notice results in removal.</p>
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
