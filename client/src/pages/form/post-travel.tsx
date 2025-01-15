import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postTravelFormSchema, type PostTravelForm, calculateAllowance, calculateTotalHours } from "@/lib/forms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PostTravelForm() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: form, isLoading } = useQuery({
    queryKey: [`/api/forms/${params.id}`],
    enabled: !!params.id,
  });

  const formHook = useForm<PostTravelForm>({
    resolver: zodResolver(postTravelFormSchema),
    defaultValues: {
      departureTime: form?.departureTime ? new Date(form.departureTime) : new Date(),
      returnTime: form?.returnTime ? new Date(form.returnTime) : new Date(),
      startMileage: form?.startMileage || 0,
      endMileage: form?.endMileage || 0,
      expenses: form?.expenses || [],
    },
  });

  const { fields, append, remove } = formHook.control._fields.expenses || [];
  
  const mutation = useMutation({
    mutationFn: async (data: PostTravelForm & { files: FileList }) => {
      const formData = new FormData();
      
      // Append form fields
      formData.append('departureTime', data.departureTime.toISOString());
      formData.append('returnTime', data.returnTime.toISOString());
      formData.append('startMileage', data.startMileage.toString());
      formData.append('endMileage', data.endMileage.toString());
      formData.append('expenses', JSON.stringify(data.expenses));

      // Append files
      Array.from(data.files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`/api/forms/${params.id}/post-travel`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post-travel form submitted successfully",
      });
      navigate("/");
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

  const totalHours = calculateTotalHours(
    formHook.watch('departureTime'),
    formHook.watch('returnTime')
  );
  
  const allowance = calculateAllowance(totalHours);
  
  const totalExpenses = formHook.watch('expenses').reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );

  const onSubmit = (data: PostTravelForm) => {
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput?.files) {
      toast({
        title: "Error",
        description: "Please select at least one receipt file",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({ ...data, files: fileInput.files });
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Post-Travel Form</CardTitle>
          <CardDescription>
            Complete this form after your travel to claim expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...formHook}>
            <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={formHook.control}
                  name="departureTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departure Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          onChange={(e) =>
                            field.onChange(new Date(e.target.value))
                          }
                          value={field.value?.toISOString().slice(0, 16)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formHook.control}
                  name="returnTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          onChange={(e) =>
                            field.onChange(new Date(e.target.value))
                          }
                          value={field.value?.toISOString().slice(0, 16)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={formHook.control}
                  name="startMileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Mileage (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formHook.control}
                  name="endMileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Mileage (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Receipt Files</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    max={4}
                  />
                </FormControl>
                <FormDescription>
                  Upload up to 4 receipt files (images or PDFs)
                </FormDescription>
                <FormMessage />
              </FormItem>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel>Expenses</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: "", amount: 0 })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount (EUR)</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields?.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={formHook.control}
                            name={`expenses.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={formHook.control}
                            name={`expenses.${index}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value))
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <CardFooter className="flex justify-between border-t pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Hours: {totalHours}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Travel Allowance: €{allowance}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Additional Expenses: €{totalExpenses}
                  </p>
                  <p className="font-semibold">
                    Total Reimbursement: €{allowance + totalExpenses}
                  </p>
                </div>
                <Button type="submit">Submit Form</Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
