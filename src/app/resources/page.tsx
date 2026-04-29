'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, query, orderBy } from 'firebase/firestore';

import { useCollection, useUser, useFirestore } from '@/firebase';
import { addResource, deleteResource, type Resource, type ResourceInput } from '@/firebase/firestore/resources';
import { useToast } from '@/hooks/use-toast';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Trash2, Link as LinkIcon, FileText } from 'lucide-react';
import Link from 'next/link';

const resourceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  url: z.string().url('Please enter a valid URL.'),
  type: z.enum(['link', 'pdf']),
});

export default function ResourcesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResourceInput>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      type: 'link',
    }
  });

  const resourcesQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'resources'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: resources, loading: resourcesLoading } = useCollection<Resource>(resourcesQuery);

  const onSubmit = async (data: ResourceInput) => {
    if (!user) return;
    try {
      await addResource(firestore, user.uid, data);
      toast({
        title: 'Resource Added',
        description: 'Your new resource has been saved.',
      });
      reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save resource. Please try again.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteResource(firestore, user.uid, id);
      toast({
        title: 'Resource Deleted',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete resource.',
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Add a New Resource</CardTitle>
                <CardDescription>
                  Save important links or documents for your study sessions.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" {...register('title')} />
                    {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="url">URL</Label>
                    <Input id="url" placeholder="https://example.com" {...register('url')} />
                    {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="type">Type</Label>
                     <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="link">Link</SelectItem>
                              <SelectItem value="pdf">PDF Document</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Resource
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Resource Library</CardTitle>
              </CardHeader>
              <CardContent>
                {resourcesLoading ? (
                   <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                   </div>
                ) : resources && resources.length > 0 ? (
                  <ul className="space-y-3">
                    {resources.map((resource) => (
                      <li key={resource.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-4">
                           {resource.type === 'link' ? <LinkIcon className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                           <Link href={resource.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                              {resource.title}
                           </Link>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(resource.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete Resource</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Your resource library is empty. Add a link or document to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
