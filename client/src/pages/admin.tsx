import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

// Define invitation schema
const invitationSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type Invitation = {
  id: number;
  email: string;
  type: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  emailPreviewUrl?: string; // Added emailPreviewUrl
};

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviting, setIsInviting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const form = useForm<z.infer<typeof invitationSchema>>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
    },
  });

  // Fetch pending invitations
  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['/api/invitations'],
  });

  const filteredInvitations = invitations.filter(invitation => 
    statusFilter === "all" ? true : invitation.status === statusFilter
  );

  const inviteCompanyAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          type: 'company_admin'
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent",
        description: "The company admin invitation has been sent successfully.",
      });
      if (data.emailPreviewUrl) {
        toast({
          title: "Email Preview Available",
          description: "View the email at: " + data.emailPreviewUrl,
        });
      }
      setIsInviting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Resent",
        description: "The invitation has been resent successfully.",
      });
      if (data.emailPreviewUrl) {
        toast({
          title: "Email Preview Available",
          description: "View the email at: " + data.emailPreviewUrl,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Deleted",
        description: "The invitation has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'accepted':
        return 'success';
      case 'expired':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Administration</CardTitle>
          <CardDescription>
            Manage company administrators and system settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">Company Admin Invitations</h3>
                  <p className="text-sm text-muted-foreground">
                    Track and manage all company administrator invitations
                  </p>
                </div>
                <Dialog open={isInviting} onOpenChange={setIsInviting}>
                  <DialogTrigger asChild>
                    <Button>
                      Send New Invitation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Company Admin Invitation</DialogTitle>
                      <DialogDescription>
                        Enter the email address of the new company administrator
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((data) => {
                          inviteCompanyAdminMutation.mutate(data.email);
                        })}
                        className="space-y-4"
                      >
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="example@company.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          disabled={inviteCompanyAdminMutation.isPending}
                        >
                          {inviteCompanyAdminMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Send Invitation
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(invitation.status)}>
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={
                            new Date(invitation.expiresAt) < new Date() 
                              ? "text-destructive" 
                              : "text-foreground"
                          }>
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {invitation.emailPreviewUrl && (
                            <a
                              href={invitation.emailPreviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center"
                            >
                              View Email <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => resendInvitationMutation.mutate(invitation.id)}
                              disabled={resendInvitationMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                              disabled={deleteInvitationMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredInvitations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No invitations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}