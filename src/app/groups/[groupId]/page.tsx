
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs 
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
  Trash2
} from 'lucide-react';
import { 
  approveRequest, 
  declineRequest, 
  leaveGroup, 
  addGroupTask,
  type StudyGroup 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function GroupDashboardPage() {
  const { groupId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Group Doc
  const groupRef = useMemo(() => doc(firestore, 'groups', groupId as string), [firestore, groupId]);
  const { data: group, loading: groupLoading } = useDoc<StudyGroup>(groupRef as any);

  // Requests (for admin)
  const requestsQuery = useMemo(() => {
    return query(collection(firestore, 'groups', groupId as string, 'requests'), where('status', '==', 'pending'));
  }, [firestore, groupId]);
  const { data: requests } = useCollection<any>(requestsQuery);

  // Group Members detailed info
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  useEffect(() => {
    if (group?.members) {
      const fetchMembers = async () => {
        const membersData = [];
        for (const mid of group.members) {
          const mSnap = await getDocs(query(collection(firestore, 'users'), where('uid', '==', mid)));
          if (!mSnap.empty) {
            membersData.push({ ...mSnap.docs[0].data(), id: mSnap.docs[0].id });
          }
        }
        setMemberProfiles(membersData.sort((a, b) => (b.daily_study_minutes || 0) - (a.daily_study_minutes || 0)));
      };
      fetchMembers();
    }
  }, [group?.members, firestore]);

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

  if (!group) return <div>Group not found</div>;

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
                      <ShieldCheck className="h-4 w-4" /> Admin: {memberProfiles.find(m => m.uid === group.creatorId)?.displayName || 'Leader'}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{group.name}</h1>
                  <p className="text-primary-foreground/80 font-medium max-w-2xl">{group.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {group.discordLink && (
                    <Button asChild variant="secondary" className="rounded-full font-bold px-6 h-12">
                      <a href={group.discordLink} target="_blank">
                        <MessageSquare className="mr-2 h-5 w-5" /> Discord Guild
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Member Activity Tracker */}
            <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <Clock className="h-6 w-6 text-primary" /> Member Activity
                  </CardTitle>
                  <CardDescription>Live study tracking for today</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memberProfiles.map((member, idx) => {
                    const progress = Math.min(100, (member.daily_study_minutes || 0) / (member.daily_goal_minutes || 360) * 100);
                    return (
                      <div key={member.uid} className="p-4 rounded-2xl bg-secondary/30 border border-secondary/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <span className="font-black text-xl italic text-muted-foreground/30 w-6">#{idx + 1}</span>
                            <Avatar className="h-10 w-10 ring-2 ring-background">
                              <AvatarImage src={member.photoURL} />
                              <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold">{member.displayName}</p>
                              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                {member.daily_study_minutes || 0}m studied today
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-sm font-black text-primary">{Math.round(progress)}%</span>
                          </div>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Guild Tasks & Rules */}
            <div className="space-y-8">
              <Card className="rounded-[2rem] border-none shadow-xl bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> Guild Tasks
                  </CardTitle>
                  {(isCreator || isMod) && (
                    <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 text-primary">
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
                <CardContent>
                   <p className="text-xs text-muted-foreground mb-4 font-medium italic">Leaders can push mandatory study tasks to all members' personal todo lists.</p>
                   <div className="p-12 text-center space-y-2">
                      <LayoutDashboard className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground font-bold">Guild tasks sync instantly with your personal Central Todo List.</p>
                   </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-none shadow-xl bg-[#2A2D5B] text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-tight">Guild Rules</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3 opacity-90 font-medium">
                  <p>1. Maximum focus during study sessions.</p>
                  <p>2. Complete guild tasks within the deadline.</p>
                  <p>3. Be active in the Discord voice channel for live sessions.</p>
                  <p>4. Inactivity for 3 days may result in removal.</p>
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
