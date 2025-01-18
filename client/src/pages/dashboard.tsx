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
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, slideIn, buttonTapAnimation, staggeredList, listItem } from "@/lib/animations";

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  const { data: forms, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/forms"],
    refetchInterval: 60000,
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
      <motion.div 
        className="flex items-center justify-center min-h-screen"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={fadeIn}
      >
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="container mx-auto py-6"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeIn}
    >
      <Card>
        <CardHeader>
          <motion.div variants={slideIn}>
            <CardTitle>Travel Allowance Requests</CardTitle>
            <CardDescription>
              View and manage your travel allowance requests
            </CardDescription>
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-between items-center">
            <motion.div whileTap={buttonTapAnimation}>
              <Button asChild>
                <Link href="/new-request">
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Link>
              </Button>
            </motion.div>
            <motion.div whileTap={buttonTapAnimation}>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
            </motion.div>
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
            <motion.tbody
              variants={staggeredList}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <AnimatePresence>
                {forms?.map((form) => (
                  <motion.tr
                    key={form.id}
                    variants={listItem}
                    layout
                  >
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
                            <motion.div whileTap={buttonTapAnimation}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600"
                                onClick={() => handleApproval(form.id, true)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </motion.div>
                            <motion.div whileTap={buttonTapAnimation}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600"
                                onClick={() => handleApproval(form.id, false)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {form.approvalStatus === 'approved' && form.status === 'pre_travel_submitted' && (
                        <motion.div whileTap={buttonTapAnimation}>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/forms/${form.id}/post-travel`}>
                              <FileText className="mr-2 h-4 w-4" />
                              Submit Post-Travel Form
                            </Link>
                          </Button>
                        </motion.div>
                      )}
                      {form.approvalStatus === 'rejected' && (
                        <span className="text-sm text-red-500">
                          Request rejected
                        </span>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {!forms?.length && (
                <motion.tr variants={fadeIn}>
                  <TableCell colSpan={6} className="text-center">
                    No travel requests found
                  </TableCell>
                </motion.tr>
              )}
            </motion.tbody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}