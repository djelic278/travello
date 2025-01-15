import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();

  const { data: forms, isLoading } = useQuery<any[]>({
    queryKey: ["/api/forms"],
  });

  const approveMutation = useMutation({
    mutationFn: async (formId: number) => {
      const res = await fetch(`/api/forms/${formId}/approve`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form approved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Travel Allowance Forms</CardTitle>
          <CardDescription>
            Manage your travel allowance requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user.isAdmin && (
            <div className="mb-4">
              <Link href="/form/pre-travel">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Travel Request
                </Button>
              </Link>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms?.map((form) => (
                <TableRow key={form.id}>
                  <TableCell>{form.destination}</TableCell>
                  <TableCell>
                    {new Date(form.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{form.status}</TableCell>
                  <TableCell>
                    {user.isAdmin && form.status === "pending_approval" ? (
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(form.id)}
                      >
                        Approve
                      </Button>
                    ) : form.status === "approved" ? (
                      <Link href={`/form/post-travel/${form.id}`}>
                        <Button size="sm">Complete Post-Travel</Button>
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
