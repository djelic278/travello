import { useQuery } from "@tanstack/react-query";
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
import { Plus, FileText, Download } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const { data: forms, isLoading } = useQuery<any[]>({
    queryKey: ["/api/forms"],
    refetchInterval: 60000, // Refetch every minute
  });

  const handleExport = async () => {
    try {
      const response = await fetch('/api/forms/export', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'travel-forms.xlsx';

      // Trigger download
      document.body.appendChild(a);
      a.click();

      // Cleanup
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
                <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell className="text-right">
                    {form.status === 'pending' ? (
                      <span className="text-sm text-muted-foreground">
                        Awaiting approval
                      </span>
                    ) : form.status === 'approved' ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/forms/${form.id}/post-travel`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Submit Form 2
                        </Link>
                      </Button>
                    ) : form.status === 'submitted' ? (
                      <span className="text-sm text-muted-foreground">
                        Form 2 submitted
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!forms?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
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