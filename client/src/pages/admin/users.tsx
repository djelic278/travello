import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";

type User = {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'company_admin' | 'user';
  companyId?: number;
  createdAt: string;
};

type Company = {
  id: number;
  name: string;
};

export default function UsersAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      console.log('Updating role:', { userId, role });
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Role update failed:', errorData);
        throw new Error(errorData.message || 'Failed to update user role');
      }

      const data = await response.json();
      console.log('Role update successful:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Role update mutation error:', error);
      toast({
        title: "Error Updating Role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ userId, companyId }: { userId: number; companyId?: number }) => {
      console.log('Updating company:', { userId, companyId });
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Company update failed:', errorData);
        throw new Error(errorData.message || 'Failed to update user company');
      }

      const data = await response.json();
      console.log('Company update successful:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Company Updated",
        description: "User's company has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Company update mutation error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (updateRoleMutation.isPending) {
      console.log('Update already in progress, skipping');
      return;
    }

    console.log('Handling role change:', { userId, newRole });
    try {
      await updateRoleMutation.mutateAsync({ 
        userId, 
        role: newRole as 'super_admin' | 'company_admin' | 'user' 
      });
    } catch (error) {
      console.error('Role change failed:', error);
    }
  };

  const handleCompanyChange = async (userId: number, newCompanyId: string) => {
    if (updateCompanyMutation.isPending) {
      console.log('Update already in progress, skipping');
      return;
    }

    console.log('Handling company change:', { userId, newCompanyId });
    try {
      await updateCompanyMutation.mutateAsync({
        userId,
        companyId: newCompanyId === "" ? undefined : parseInt(newCompanyId),
      });
    } catch (error) {
      console.error('Company change failed:', error);
    }
  };

  if (usersLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredUsers = selectedRole
    ? users.filter(user => user.role === selectedRole)
    : users;

  return (
    <motion.div 
      className="container mx-auto py-6"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeIn}
    >
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/admin" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select
              value={selectedRole || ""}
              onValueChange={(value) => setSelectedRole(value || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="company_admin">Company Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                  <TableHead>Current Company</TableHead>
                  <TableHead>Change Company</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === 'super_admin'
                            ? "destructive"
                            : user.role === 'company_admin'
                            ? "default"
                            : "secondary"
                        }
                      >
                        {user.role === 'super_admin'
                          ? "Super Admin"
                          : user.role === 'company_admin'
                          ? "Company Admin"
                          : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.companyId ? companies.find(c => c.id === user.companyId)?.name : "Not Assigned"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.companyId?.toString() || ""}
                        onValueChange={(newCompanyId) => handleCompanyChange(user.id, newCompanyId)}
                        disabled={updateCompanyMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No Company</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}