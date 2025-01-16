import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { preTraveFormSchema, type PreTravelForm, fieldDescriptions } from "@/lib/forms";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useState } from "react";
import { Check, ChevronsUpDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function FormLabelWithTooltip({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center gap-2">
      <FormLabel>{label}</FormLabel>
      <HoverCard>
        <HoverCardTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <p className="text-sm text-muted-foreground">{description}</p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export default function PreTravelForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Fetch previous submission locations
  const { data: previousLocations } = useQuery<string[]>({
    queryKey: ["/api/submission-locations"],
  });

  const form = useForm<PreTravelForm>({
    resolver: zodResolver(preTraveFormSchema),
    defaultValues: {
      submissionLocation: "",
      submissionDate: new Date(),
      firstName: "",
      lastName: "",
      isReturnTrip: true,
      duration: 1,
      requestedPrepayment: 0, // Added default value for prepayment
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PreTravelForm) => {
      const res = await fetch("/api/forms/pre-travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate.toISOString(),
          submissionDate: data.submissionDate.toISOString(),
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Travel request submitted successfully",
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

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Pre-Travel Form</CardTitle>
          <CardDescription>
            Submit this form before starting your travel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-6"
            >
              {/* Location and Date row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="submissionLocation"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabelWithTooltip 
                        label="Form Submission Location" 
                        description={fieldDescriptions.submissionLocation}
                      />
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value || "Select location..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search location..." />
                            <CommandEmpty>No location found.</CommandEmpty>
                            <CommandGroup>
                              {previousLocations?.map((location) => (
                                <CommandItem
                                  key={location}
                                  value={location}
                                  onSelect={() => {
                                    form.setValue("submissionLocation", location);
                                    setOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      location === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {location}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="submissionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Form Submission Date"
                        description={fieldDescriptions.submissionDate}
                      />
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Name row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="First Name"
                        description={fieldDescriptions.firstName}
                      />
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Last Name"
                        description={fieldDescriptions.lastName}
                      />
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Destination and Purpose row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabelWithTooltip 
                        label="Destination"
                        description={fieldDescriptions.destination}
                      />
                      <FormControl>
                        <Input {...field} className="w-4/5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tripPurpose"
                  render={({ field }) => (
                    <FormItem className="flex-[1.2]">
                      <FormLabelWithTooltip 
                        label="Trip Purpose"
                        description={fieldDescriptions.tripPurpose}
                      />
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Transport and Return Trip row */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="transportType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabelWithTooltip 
                          label="Transport Type"
                          description={fieldDescriptions.transportType}
                        />
                        <FormControl>
                          <Input {...field} placeholder="e.g., Car, Train" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name="transportDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabelWithTooltip 
                          label="Transport Details"
                          description={fieldDescriptions.transportDetails}
                        />
                        <FormControl>
                          <Input {...field} placeholder="Car type & registration (if applicable)" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="isReturnTrip"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 h-[90%]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <FormLabel className="text-base">Return Trip</FormLabel>
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <p className="text-sm text-muted-foreground">
                                  {fieldDescriptions.isReturnTrip}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          </div>
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

              {/* Date and Duration row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Start Date"
                        description={fieldDescriptions.startDate}
                      />
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) =>
                            field.onChange(new Date(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Duration (days)"
                        description={fieldDescriptions.duration}
                      />
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Project Code and Prepayment row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="projectCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Project Code"
                        description={fieldDescriptions.projectCode}
                      />
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requestedPrepayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip 
                        label="Requested Prepayment (EUR)"
                        description={fieldDescriptions.requestedPrepayment}
                      />
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> After completing your travel, you are required to submit Form 2 (post-travel form) within 10 days of your return date to justify the travel expenses and reconcile any prepayments.
                </p>
              </div>

              <Button type="submit" className="w-full">
                Submit for Approval
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}