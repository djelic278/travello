import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const updateProfileSchema = z.object({
  position: z.string().min(1, "Position is required"),
  dateOfBirth: z.string().optional(),
  preferredEmail: z.string().email("Invalid email address"),
  companyId: z.number().optional(),
  theme: z.enum(['light', 'dark', 'system'] as const),
  emailNotifications: z.boolean(),
  dashboardLayout: z.object({ type: z.string() }),
});

const addCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  contactEmail: z.string().email("Invalid contact email").optional(),
  adminEmail: z.string().email("Invalid admin email").optional(),
});

type Company = {
  id: number;
  name: string;
  address?: string;
  vatNumber?: string;
  contactEmail?: string;
  adminEmail?: string;
};

type UpdateProfileForm = z.infer<typeof updateProfileSchema>;
type AddCompanyForm = z.infer<typeof addCompanySchema>;

export default function ProfilePage() {
  // All hooks at the top level
  const { user, isLoading: userLoading } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingCompany, setIsAddingCompany] = useState(false);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: !!user, // Only fetch companies when user is available
  });

  const form = useForm<UpdateProfileForm>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      position: "",
      dateOfBirth: "",
      preferredEmail: "",
      companyId: undefined,
      theme: 'system',
      emailNotifications: true,
      dashboardLayout: { type: 'default' },
    },
  });

  const companyForm = useForm<AddCompanyForm>({
    resolver: zodResolver(addCompanySchema),
    defaultValues: {
      name: "",
      address: "",
      vatNumber: "",
      contactEmail: "",
      adminEmail: "",
    },
  });

  // Update form when user data is available
  useEffect(() => {
    if (user) {
      form.reset({
        position: user.position || "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        preferredEmail: user.preferredEmail || user.email || "",
        companyId: user.companyId || undefined,
        theme: (user.theme as "light" | "dark" | "system") || 'system',
        emailNotifications: user.emailNotifications ?? true,
        dashboardLayout: user.dashboardLayout || { type: 'default' },
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileForm) => {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
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

  const addCompanyMutation = useMutation({
    mutationFn: async (data: AddCompanyForm) => {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      form.setValue('companyId', data.id); //Corrected to set companyId
      setIsAddingCompany(false);
      companyForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Company Added",
        description: "New company has been added successfully.",
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

  const onSubmit = (data: UpdateProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const onAddCompany = (data: AddCompanyForm) => {
    addCompanyMutation.mutate(data);
  };

  // Show loading state while initial data is being fetched
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Profile & Preferences</CardTitle>
              <CardDescription>
                Update your profile information, company details, and preferences
              </CardDescription>
            </div>
            <Badge variant={user.role === 'super_admin' ? "destructive" : user.role === 'company_admin' ? "default" : "secondary"}>
              {user.role === 'super_admin' ? "Super Admin" : user.role === 'company_admin' ? "Company Admin" : "User"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profile">Profile Information</TabsTrigger>
                  <TabsTrigger value="company">Company Details</TabsTrigger>
                  <TabsTrigger value="preferences">Preferences</TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position in Company</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferredEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <Select
                              value={field.value?.toString() || ""}
                              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a company" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {companies.map((company) => (
                                  <SelectItem
                                    key={company.id}
                                    value={company.id.toString()}
                                  >
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Dialog open={isAddingCompany} onOpenChange={setIsAddingCompany}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline">
                            + Add New Company
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Company</DialogTitle>
                            <DialogDescription>
                              Enter the details of the new company
                            </DialogDescription>
                          </DialogHeader>

                          <Form {...companyForm}>
                            <form
                              onSubmit={companyForm.handleSubmit(onAddCompany)}
                              className="space-y-4"
                            >
                              <FormField
                                control={companyForm.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Company Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={companyForm.control}
                                name="address"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Address (Optional)</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={companyForm.control}
                                name="vatNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>VAT Number (Optional)</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={companyForm.control}
                                name="contactEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Contact Email (Optional)</FormLabel>
                                    <FormControl>
                                      <Input type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={companyForm.control}
                                name="adminEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Administrator Email (Optional)</FormLabel>
                                    <FormControl>
                                      <Input type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <Button
                                type="submit"
                                disabled={addCompanyMutation.isPending}
                              >
                                {addCompanyMutation.isPending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Add Company
                              </Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="company">
                  <div className="space-y-6">
                    {!user.companyId ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="text-lg font-medium mb-2">No Company Selected</div>
                        <p className="text-sm text-muted-foreground mb-4">
                          You are not currently associated with any company.
                        </p>
                        <Dialog open={isAddingCompany} onOpenChange={setIsAddingCompany}>
                          <DialogTrigger asChild>
                            <Button type="button">+ Add New Company</Button>
                          </DialogTrigger>
                        </Dialog>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {companies.length > 0 && (() => {
                          const userCompany = companies.find(c => c.id === user.companyId);
                          if (!userCompany) return null;
                          
                          return (
                            <>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-medium text-sm mb-1">Company Name</h3>
                                  <p className="text-sm">{userCompany.name}</p>
                                </div>
                                
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-medium text-sm mb-1">VAT Number</h3>
                                  <p className="text-sm">{userCompany.vatNumber || 'Not provided'}</p>
                                </div>
                                
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-medium text-sm mb-1">Address</h3>
                                  <p className="text-sm">{userCompany.address || 'Not provided'}</p>
                                </div>
                                
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-medium text-sm mb-1">Contact Email</h3>
                                  <p className="text-sm">{userCompany.contactEmail || 'Not provided'}</p>
                                </div>
                                
                                <div className="bg-muted/50 p-4 rounded-lg col-span-full">
                                  <h3 className="font-medium text-sm mb-1">Administrator Email</h3>
                                  <p className="text-sm">{userCompany.adminEmail || 'Not provided'}</p>
                                </div>
                              </div>
                              
                              {user.role === 'super_admin' || user.role === 'company_admin' ? (
                                <div className="pt-4">
                                  <Button type="button" variant="outline" onClick={() => {
                                    // Pre-fill the form with company data when editing
                                    companyForm.reset({
                                      name: userCompany.name,
                                      address: userCompany.address || '',
                                      vatNumber: userCompany.vatNumber || '',
                                      contactEmail: userCompany.contactEmail || '',
                                      adminEmail: userCompany.adminEmail || '',
                                    });
                                    setIsAddingCompany(true);
                                  }}>
                                    Edit Company Details
                                  </Button>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preferences">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Theme</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose how Travel Allowance System looks to you
                      </p>
                      <div className="mt-3">
                        <FormField
                          control={form.control}
                          name="theme"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select theme" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="light">Light</SelectItem>
                                  <SelectItem value="dark">Dark</SelectItem>
                                  <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium">Email Notifications</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure your email notification preferences
                      </p>
                      <div className="mt-3">
                        <FormField
                          control={form.control}
                          name="emailNotifications"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Email Notifications</FormLabel>
                                <FormDescription>
                                  Receive notifications about your travel requests
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium">Dashboard Layout</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred dashboard layout
                      </p>
                      <div className="mt-3">
                        <FormField
                          control={form.control}
                          name="dashboardLayout"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                value={field.value?.type || 'default'}
                                onValueChange={(value) =>
                                  field.onChange({ type: value })
                                }
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select layout" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="default">Default</SelectItem>
                                  <SelectItem value="compact">Compact</SelectItem>
                                  <SelectItem value="comfortable">Comfortable</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}