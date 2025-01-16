import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postTravelFormSchema, type PostTravelForm, calculateAllowance, calculateTotalHours, calculateDistanceAllowance } from "@/lib/forms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PostTravelForm() {
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

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
      expenses: [],
      files: []
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: formHook.control,
    name: "expenses"
  });

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

  // Calculate total kilometers
  const startMileage = formHook.watch('startMileage');
  const endMileage = formHook.watch('endMileage');
  const totalKilometers = Math.max(0, endMileage - startMileage);

  // Calculate allowances
  const totalHours = calculateTotalHours(
    formHook.watch('departureTime'),
    formHook.watch('returnTime')
  );

  const timeAllowance = calculateAllowance(
    totalHours,
    settings?.dailyAllowance ? parseFloat(settings.dailyAllowance) : 35
  );

  const distanceAllowance = calculateDistanceAllowance(
    totalKilometers,
    settings?.kilometerRate ? parseFloat(settings.kilometerRate) : 0.3
  );

  const totalExpenses = formHook.watch('expenses').reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );

  // Ensure prepaidAmount is a number
  const prepaidAmount = form?.requestedPrepayment ? parseFloat(form.requestedPrepayment.toString()) : 0;
  const totalAllowances = timeAllowance + distanceAllowance + totalExpenses;
  const finalReimbursement = totalAllowances - prepaidAmount;

  const onSubmit = (data: PostTravelForm) => {
    const files = formHook.watch('files');
    if (!files || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one receipt file",
        variant: "destructive",
      });
      return;
    }
    // Instead of submitting directly, show the signature dialog
    setShowSignatureDialog(true);
  };

  const handleSignAndSubmit = () => {
    const data = formHook.getValues();
    const files = formHook.watch('files');
    mutation.mutate({ ...data, files: new FileList(files) });
    setShowSignatureDialog(false);
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
          {/* Pre-travel form details */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-base">{form?.firstName} {form?.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Destination</p>
                <p className="text-base">{form?.destination}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project Code</p>
                <p className="text-base">{form?.projectCode}</p>
              </div>
            </div>
          </div>

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
                      <FormDescription>
                        Total Hours: {totalHours}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                <div className="flex items-end">
                  <div className="w-full">
                    <FormLabel>Total Distance</FormLabel>
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                      {totalKilometers} km
                    </div>
                  </div>
                </div>
              </div>

              <FormItem>
                <FormLabel>Receipt Files</FormLabel>
                <div className="space-y-4">
                  <label
                    className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-primary/50 focus:outline-none">
                    <div className="flex flex-col items-center space-y-2">
                      <span className="flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="font-medium text-gray-600">
                          Drop files to attach, or <span className="text-primary underline">browse</span>
                        </span>
                      </span>
                      <span className="text-xs text-gray-500">Up to 4 files (images or PDFs)</span>
                    </div>
                    <FormControl>
                      <Input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        max={4}
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const existingFiles = formHook.watch('files') || [];
                          const newFiles = [...existingFiles, ...files].slice(0, 4);
                          formHook.setValue('files', newFiles);
                        }}
                      />
                    </FormControl>
                  </label>

                  {/* Display selected files */}
                  {formHook.watch('files')?.length > 0 && (
                    <div className="space-y-2">
                      {Array.from(formHook.watch('files')).map((file: File, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const files = formHook.watch('files');
                              const newFiles = Array.from(files).filter((_, i) => i !== index);
                              formHook.setValue('files', newFiles);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    {fields.map((field, index) => (
                      <TableRow key={index}>
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
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Hours: {totalHours}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Time-based Allowance: €{timeAllowance.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Distance Allowance ({totalKilometers} km × €{settings?.kilometerRate || '0.30'}/km): €{distanceAllowance.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Additional Expenses: €{totalExpenses.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Prepaid Amount: -€{prepaidAmount.toFixed(2)}
                  </p>
                  <p className="font-semibold">
                    Total Reimbursement: €{finalReimbursement.toFixed(2)}
                  </p>
                  <p className="text-sm italic text-muted-foreground">
                    {finalReimbursement >= 0
                      ? "*Amount to be paid out to employee"
                      : "*Amount to be returned to the company"}
                  </p>
                </div>
                <Button type="submit">Submit Form</Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Digital Signature Confirmation</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Do you want to digitally sign this document and submit?
              </p>
              <p className="font-medium text-destructive">
                Your digital signature will be placed on the form and you are legally responsible for its contents!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSignatureDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSignAndSubmit}
            >
              Sign and Submit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}