import React, { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Check, ChevronsUpDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceInput } from "@/components/voice-input";

// Helper component for form labels with tooltips
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
  const [inputValue, setInputValue] = useState("");

  // Initialize form with default values
  const form = useForm<PreTravelForm>({
    resolver: zodResolver(preTraveFormSchema),
    defaultValues: {
      submissionLocation: "",
      submissionDate: new Date(),
      company: "",
      firstName: "",
      lastName: "",
      isReturnTrip: true,
      duration: 1,
      requestedPrepayment: 0,
      startDate: new Date(),
      destination: "",
      tripPurpose: "",
      transportType: "",
      transportDetails: "",
      projectCode: "",
      isCompanyVehicle: false,
      companyVehicleId: undefined,
    },
  });

  // Watch for company vehicle toggle
  const isCompanyVehicle = form.watch("isCompanyVehicle");

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    }
  });

  // Fetch companies data if user has companyId
  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await fetch('/api/companies', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    enabled: !!user?.companyId,
  });

  // Find user's company from companies list
  const userCompany = user?.companyId && companies ? 
    companies.find((c: any) => c.id === user.companyId) : null;

  // Fetch company vehicles when needed
  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    },
    enabled: isCompanyVehicle && !!user?.companyId,
  });

  // Default locations until API endpoint is available
  const previousLocations = [
    "Zagreb", 
    "Split", 
    "Rijeka", 
    "Osijek", 
    "Dubrovnik"
  ];

  // Handle voice input data
  const handleVoiceData = (data: Record<string, any>) => {
    try {
      // Update form fields based on voice data
      if (data.firstName) {
        form.setValue('firstName', data.firstName);
        toast({
          title: "First Name Updated",
          description: `Set to ${data.firstName}`,
        });
      }
      if (data.lastName) {
        form.setValue('lastName', data.lastName);
        toast({
          title: "Last Name Updated",
          description: `Set to ${data.lastName}`,
        });
      }
      if (data.destination) {
        form.setValue('destination', data.destination);
        toast({
          title: "Destination Updated",
          description: `Set to ${data.destination}`,
        });
      }
      if (data.tripPurpose) {
        form.setValue('tripPurpose', data.tripPurpose);
        toast({
          title: "Trip Purpose Updated",
          description: `Set to ${data.tripPurpose}`,
        });
      }
      if (data.transportType) {
        form.setValue('transportType', data.transportType);
        toast({
          title: "Transport Type Updated",
          description: `Set to ${data.transportType}`,
        });
      }
      if (data.transportDetails) {
        form.setValue('transportDetails', data.transportDetails);
        toast({
          title: "Transport Details Updated",
          description: `Set to ${data.transportDetails}`,
        });
      }
      if (data.projectCode) {
        form.setValue('projectCode', data.projectCode);
        toast({
          title: "Project Code Updated",
          description: `Set to ${data.projectCode}`,
        });
      }
      if (data.duration !== undefined) {
        const durationValue = parseInt(String(data.duration));
        if (!isNaN(durationValue)) {
          form.setValue('duration', durationValue);
          toast({
            title: "Duration Updated",
            description: `Set to ${durationValue} days`,
          });
        }
      }
      if (data.requestedPrepayment !== undefined) {
        const prepaymentValue = parseFloat(String(data.requestedPrepayment));
        if (!isNaN(prepaymentValue)) {
          form.setValue('requestedPrepayment', prepaymentValue);
          toast({
            title: "Requested Prepayment Updated",
            description: `Set to €${prepaymentValue.toFixed(2)}`,
          });
        }
      }
      if (data.startDate) {
        const date = new Date(data.startDate);
        if (!isNaN(date.getTime())) {
          form.setValue('startDate', date);
          toast({
            title: "Start Date Updated",
            description: `Set to ${date.toLocaleDateString()}`,
          });
        }
      }
      if (data.submissionLocation) {
        form.setValue('submissionLocation', data.submissionLocation);
        setInputValue(data.submissionLocation);
        toast({
          title: "Submission Location Updated",
          description: `Set to ${data.submissionLocation}`,
        });
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast({
        title: "Voice Input Error",
        description: "There was an error processing your voice input. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Form submission mutation
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

  // Populate form with user data when available
  React.useEffect(() => {
    if (user) {
      // Always apply user data when available
      form.setValue('firstName', user.firstName || '');
      form.setValue('lastName', user.lastName || '');
      
      // Set company value if available
      if (userCompany && userCompany.name) {
        form.setValue('company', userCompany.name);
      }
      
      console.log('Setting form values from user profile:', {
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        companyName: userCompany?.name
      });
    }
  }, [user, userCompany, form]);

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
          {/* Voice input section */}
          <div className="mb-6">
            <VoiceInput
              onDataReceived={handleVoiceData}
              className="mb-4"
            />
            <p className="text-sm text-muted-foreground">
              Try saying: "I'm John Smith traveling to Berlin, Germany for a business meeting. Project code XYZ-123. I need transportation by train, departing on March 15th 2025 for 5 days. Request prepayment of 500 euros."
            </p>
          </div>

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
                              onClick={() => setOpen(true)}
                            >
                              {field.value || "Select or enter location..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or enter new location..."
                              value={inputValue}
                              onValueChange={(value) => {
                                setInputValue(value);
                                form.setValue("submissionLocation", value);
                              }}
                            />
                            <CommandEmpty>
                              Press enter to use "{inputValue}"
                            </CommandEmpty>
                            <CommandGroup>
                              {previousLocations.map((location: string) => (
                                <CommandItem
                                  key={location}
                                  value={location}
                                  onSelect={() => {
                                    form.setValue("submissionLocation", location);
                                    setInputValue(location);
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

              {/* Company field */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip
                        label="Company"
                        description={fieldDescriptions.company}
                      />
                      <FormControl>
                        <Input {...field} disabled className="bg-muted" />
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
              <div className="space-y-4">
                {/* Company Vehicle Switch */}
                <FormField
                  control={form.control}
                  name="isCompanyVehicle"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Use Company Vehicle</FormLabel>
                        <FormDescription>
                          Toggle to select a company vehicle for your travel
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue('companyVehicleId', undefined);
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

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
                            <Input 
                              {...field} 
                              placeholder="e.g., Car, Train" 
                              disabled={isCompanyVehicle}
                              value={isCompanyVehicle ? 'Company Car' : field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-6">
                    {isCompanyVehicle ? (
                      <FormField
                        control={form.control}
                        name="companyVehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabelWithTooltip
                              label="Select Company Vehicle"
                              description={fieldDescriptions.companyVehicleId}
                            />
                            <Select
                              onValueChange={(value) => field.onChange(Number(value))}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a company vehicle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicles.map((vehicle: any) => (
                                  <SelectItem 
                                    key={vehicle.id} 
                                    value={vehicle.id.toString()}
                                  >
                                    {vehicle.manufacturer} {vehicle.model} - {vehicle.licensePlate}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
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
                              <Input {...field} placeholder="Transport details or private vehicle information" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
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
              </div>

              {/* Date and Duration row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip
                        label="Travel Start Date"
                        description={fieldDescriptions.startDate}
                      />
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              field.onChange(date);
                            }
                          }}
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
                          min={1}
                          {...field}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value > 0) {
                              field.onChange(value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Project and Prepayment row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="projectCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithTooltip
                        label="Project Code (optional)"
                        description={fieldDescriptions.projectCode}
                      />
                      <FormControl>
                        <Input {...field} placeholder="e.g., PRJ-1234" />
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
                        label="Requested Prepayment (€)"
                        description={fieldDescriptions.requestedPrepayment}
                      />
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value >= 0) {
                              field.onChange(value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end mt-8">
                <Button variant="outline" type="button" className="mr-2" onClick={() => navigate("/")}>
                  Cancel
                </Button>
                <Button type="submit">Submit Travel Request</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}