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
import { Plus } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const { data: forms, isLoading } = useQuery<any[]>({
    queryKey: ["/api/forms"],
  });

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
          <div className="mb-4">
            <Button asChild>
              <Link href="/new-request">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Link>
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Duration (days)</TableHead>
                <TableHead>Status</TableHead>
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
                </TableRow>
              ))}
              {!forms?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
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