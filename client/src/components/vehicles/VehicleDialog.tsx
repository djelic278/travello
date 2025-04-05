import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { InsertCompanyVehicle, insertCompanyVehicleSchema } from "@/lib/schema";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useUser } from "@/hooks/use-user";

type VehicleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: InsertCompanyVehicle | null;
  onClose: () => void;
};

export function VehicleDialog({ open, onOpenChange, vehicle, onClose }: VehicleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  // Fetch companies for dropdown
  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
    enabled: open, // Only fetch when dialog is open
  });
  
  const form = useForm<InsertCompanyVehicle>({
    resolver: zodResolver(insertCompanyVehicleSchema),
    defaultValues: {
      manufacturer: "",
      model: "",
      year: new Date().getFullYear(),
      licensePlate: "",
      engineType: "",
      enginePower: 0,
      fuelConsumption: 0,
      status: "available",
      currentMileage: 0,
      companyId: user?.companyId || 1,
    },
  });

  // Effect to set the company based on user profile when form opens
  useEffect(() => {
    if (open && !vehicle && user?.companyId) {
      form.setValue('companyId', user.companyId);
    }
  }, [open, user, form, vehicle]);

  // Update form values when vehicle changes
  useEffect(() => {
    if (vehicle) {
      form.reset({
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        year: Number(vehicle.year),
        licensePlate: vehicle.licensePlate,
        engineType: vehicle.engineType,
        enginePower: Number(vehicle.enginePower),
        fuelConsumption: Number(vehicle.fuelConsumption),
        status: vehicle.status,
        currentMileage: Number(vehicle.currentMileage),
        companyId: Number(vehicle.companyId),
      });
    } else {
      form.reset({
        manufacturer: "",
        model: "",
        year: new Date().getFullYear(),
        licensePlate: "",
        engineType: "",
        enginePower: 0,
        fuelConsumption: 0,
        status: "available",
        currentMileage: 0,
        companyId: user?.companyId || 1,
      });
    }
  }, [vehicle, form, user]);

  const mutation = useMutation({
    mutationFn: async (data: InsertCompanyVehicle) => {
      // Ensure numeric fields are numbers
      const processedData = {
        ...data,
        year: Number(data.year),
        enginePower: Number(data.enginePower),
        fuelConsumption: Number(data.fuelConsumption),
        currentMileage: Number(data.currentMileage),
        companyId: Number(data.companyId),
      };

      console.log('Submitting vehicle data:', processedData);
      const response = await fetch(vehicle ? `/api/vehicles/${vehicle.id}` : '/api/vehicles', {
        method: vehicle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save vehicle');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({
        title: "Success",
        description: `Vehicle ${vehicle ? 'updated' : 'added'} successfully`,
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      
      // Check for specific error messages related to license plate
      let errorMessage = error.message;
      if (error.message?.includes('license_plate') || error.message?.includes('unique constraint')) {
        errorMessage = "This license plate is already in use. Please use a different one.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[425px] h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{vehicle ? 'Edit' : 'Add'} Vehicle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))} 
            className="flex flex-col h-full"
          >
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Model" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Year"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licensePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Plate</FormLabel>
                    <FormControl>
                      <Input placeholder="License Plate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="engineType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engine Type</FormLabel>
                    <FormControl>
                      <Input placeholder="Engine Type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enginePower"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engine Power (HP)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Engine Power"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fuelConsumption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Consumption (L/100km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="Fuel Consumption"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in_use">In Use</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Mileage (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="Current Mileage"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Show company selector for admin users, but use hidden field for regular users */}
              {user?.role === 'super_admin' && companies.length > 0 ? (
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(Number(value))} 
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={String(company.id)}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                /* For regular users, show which company the vehicle will be associated with */
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input 
                          value={companies.find(c => c.id === user?.companyId)?.name || 'Your Company'} 
                          disabled 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div className="mt-auto p-6 border-t bg-background">
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {vehicle ? 'Update' : 'Add'} Vehicle
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}