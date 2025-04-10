import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postTravelFormSchema, type PostTravelForm, calculateAllowance, calculateTotalHours, calculateDistanceAllowance, formatDateForInput } from "@/lib/forms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFormLoading } from "@/hooks/use-form-loading";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, X, Camera, FileText } from "lucide-react";
import { FormWrapper } from "@/components/ui/form-wrapper";

interface TravelFormData {
  departureTime?: string;
  returnTime?: string;
  startMileage?: number;
  endMileage?: number;
  requestedPrepayment?: number;
  firstName?: string;
  lastName?: string;
  destination?: string;
  projectCode?: string;
}

export default function PostTravelForm() {
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { startLoading, stopLoading } = useFormLoading();

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const { data: form, isLoading } = useQuery<TravelFormData>({
    queryKey: [`/api/forms/${params.id}`],
    enabled: !!params.id,
  });

  const formHook = useForm<PostTravelForm>({
    resolver: zodResolver(postTravelFormSchema),
    defaultValues: {
      departureTime: '',
      returnTime: '',
      startMileage: 0,
      endMileage: 0,
      expenses: [],
      files: [],
    },
  });
  
  // Update form values when data is available
  useEffect(() => {
    if (form) {
      formHook.setValue('departureTime', formatDateForInput(form.departureTime));
      formHook.setValue('returnTime', formatDateForInput(form.returnTime));
      formHook.setValue('startMileage', form.startMileage || 0);
      formHook.setValue('endMileage', form.endMileage || 0);
    }
  }, [form, formHook]);

  const { fields, append, remove } = useFieldArray({
    control: formHook.control,
    name: "expenses"
  });

  // Watch form values for calculations
  const startMileage = formHook.watch('startMileage');
  const endMileage = formHook.watch('endMileage');
  const departureTime = formHook.watch('departureTime');
  const returnTime = formHook.watch('returnTime');

  // Calculate values
  const totalKilometers = Math.max(0, endMileage - startMileage);
  const totalHours = calculateTotalHours(departureTime, returnTime);
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
  const prepaidAmount = form?.requestedPrepayment ? parseFloat(form.requestedPrepayment.toString()) : 0;
  const totalAllowances = timeAllowance + distanceAllowance + totalExpenses;
  const finalReimbursement = totalAllowances - prepaidAmount;

  const mutation = useMutation({
    mutationFn: async (data: PostTravelForm) => {
      try {
        startLoading("post-travel-form");
        
        // Separate file upload from form data
        let filesData;
        if (data.files && data.files.length > 0) {
          filesData = new FormData();
          for (const file of data.files) {
            filesData.append('files', file);
          }
        }
        
        // Validate and process date values
        let departureTime: string;
        let returnTime: string;
        
        try {
          // Validate departure time
          const departureDate = new Date(data.departureTime);
          if (isNaN(departureDate.getTime())) {
            throw new Error("Invalid departure time format");
          }
          departureTime = departureDate.toISOString();
          
          // Validate return time
          const returnDate = new Date(data.returnTime);
          if (isNaN(returnDate.getTime())) {
            throw new Error("Invalid return time format");
          }
          returnTime = returnDate.toISOString();
        } catch (error: any) {
          throw new Error(error?.message || "Invalid date format for departure or return time");
        }
        
        // Use JSON instead of FormData for non-file data
        const jsonData = {
          departureTime,
          returnTime,
          startMileage: data.startMileage,
          endMileage: data.endMileage,
          expenses: data.expenses,
        };

        // For now, submit only the JSON data (file uploads will be implemented later)
        // If the user has selected files, show a notification
        if (data.files && data.files.length > 0) {
          console.warn("File uploads not yet implemented on the server");
          toast({
            title: "File Upload Not Available",
            description: "Receipt file upload will be available in a future update.",
            variant: "warning",
          });
        }
        
        // Send data as JSON
        const res = await fetch(`/api/forms/${params.id}/post-travel`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonData),
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText);
        }

        return res.json();
      } catch (error) {
        console.error('Form submission error:', error);
        throw error;
      } finally {
        stopLoading();
      }
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

  const onSubmit = (data: PostTravelForm) => {
    mutation.mutate(data);
    setShowSignatureDialog(true);
  };

  const handleSignAndSubmit = () => {
    //This function is already handled in onSubmit
  };

  return (
    <div className="container mx-auto py-6">
      <FormWrapper formId="post-travel-form">
        <Form {...formHook}>
          <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post-Travel Form</CardTitle>
                <CardDescription>
                  Complete this form after your travel to claim expenses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={formHook.control}
                    name="departureTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            value={field.value ? formatDateForInput(field.value) : ''}
                            onChange={(e) => {
                              try {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                  field.onChange(date.toISOString());
                                } else {
                                  console.error("Invalid date input:", e.target.value);
                                }
                              } catch (error) {
                                console.error("Error parsing date:", error);
                              }
                            }}
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
                        <FormLabel>Return Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            value={field.value ? formatDateForInput(field.value) : ''}
                            onChange={(e) => {
                              try {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                  field.onChange(date.toISOString());
                                } else {
                                  console.error("Invalid date input:", e.target.value);
                                }
                              } catch (error) {
                                console.error("Error parsing date:", error);
                              }
                            }}
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
                <FormField
                  control={formHook.control}
                  name="files"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Receipt Files</FormLabel>
                      <div className="space-y-4">
                        <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-primary/50 focus:outline-none">
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
                                if (files.length > 4) {
                                  toast({
                                    title: "Error",
                                    description: "Maximum 4 files allowed",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                onChange(files);
                              }}
                              {...field}
                            />
                          </FormControl>
                        </label>

                        {/* Display selected files */}
                        {Array.isArray(value) && value.length > 0 && (
                          <div className="space-y-2">
                            {value.map((file: File, index: number) => (
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
                                    const newFiles = Array.isArray(value) ? [...value] : [];
                                    newFiles.splice(index, 1);
                                    onChange(newFiles);
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
                  )}
                />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <FormLabel>Expenses</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Create a file input element
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.multiple = false;

                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append('receipt', file);

                            try {
                              const response = await fetch('/api/ocr/receipt', {
                                method: 'POST',
                                body: formData,
                                credentials: 'include',
                              });

                              if (!response.ok) throw new Error('Failed to process receipt');

                              const result = await response.json();

                              append({
                                name: result.name || 'Receipt expense',
                                amount: result.amount || 0,
                              });

                              toast({
                                title: "Receipt Processed",
                                description: "The expense has been added from the receipt.",
                              });
                            } catch (error: any) {
                              toast({
                                title: "Error",
                                description: error?.message || "Failed to process receipt",
                                variant: "destructive",
                              });
                            }
                          };

                          input.click();
                        }}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Scan Receipt
                      </Button>
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
              </CardContent>
            </Card>
          </form>
        </Form>
      </FormWrapper>
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