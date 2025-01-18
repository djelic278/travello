import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Plus, FileText, Download, Check, X } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  const { data: forms, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/forms"],
    refetchInterval: 60000, // Refetch every minute
  });

  // Mutation for approving/rejecting forms
  const { mutate: updateApproval } = useMutation({
    mutationFn: async ({ formId, approved }: { formId: number; approved: boolean }) => {
      const response = await fetch(`/api/forms/${formId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      refetch(); // Refresh the forms list
      toast({
        title: "Success",
        description: "Travel request status updated successfully",
      });
    },
  });

  const handleApproval = (formId: number, approved: boolean) => {
    updateApproval({ formId, approved });
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/forms/export', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'travel-forms.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Travel forms exported successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export travel forms",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Travel Allowance Requests</CardTitle>
          <CardDescription>
            View and manage your travel allowance requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-between items-center">
            <Button asChild>
              <Link href="/new-request">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Link>
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Duration (days)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms?.map((form) => (
                <TableRow key={form.id}>
                  <TableCell>{form.destination}</TableCell>
                  <TableCell>
                    {new Date(form.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{form.duration}</TableCell>
                  <TableCell>{form.status}</TableCell>
                  <TableCell>{form.approvalStatus}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {form.approvalStatus === 'pending' && (
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                            onClick={() => handleApproval(form.id, true)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleApproval(form.id, false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {form.approvalStatus === 'approved' && form.status === 'pre_travel_submitted' && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/forms/${form.id}/post-travel`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Submit Post-Travel Form
                        </Link>
                      </Button>
                    )}
                    {form.approvalStatus === 'rejected' && (
                      <span className="text-sm text-red-500">
                        Request rejected
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!forms?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No travel requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}