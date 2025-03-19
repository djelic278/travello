import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SelectCompanyVehicle, insertCompanyVehicleSchema } from "@/lib/schema";
import { useToast } from "@/hooks/use-toast";

type VehicleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: SelectCompanyVehicle | null;
  onClose: () => void;
};

export function VehicleDialog({ open, onOpenChange, vehicle, onClose }: VehicleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(insertCompanyVehicleSchema),
    defaultValues: vehicle || {
      manufacturer: "",
      model: "",
      year: new Date().getFullYear(),
      licensePlate: "",
      engineType: "",
      enginePower: 0,
      fuelConsumption: 0,
      status: "available",
      currentMileage: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/vehicles${vehicle ? `/${vehicle.id}` : ''}`, {
        method: vehicle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
        title: `Vehicle ${vehicle ? 'updated' : 'added'} successfully`,
        variant: "default",
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Edit' : 'Add'} Vehicle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="flex-1 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer" {...field} />
                    </FormControl>
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
                      <Input type="number" placeholder="Year" {...field} />
                    </FormControl>
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
                      <Input type="number" placeholder="Engine Power" {...field} />
                    </FormControl>
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
                      <Input type="number" step="0.1" placeholder="Fuel Consumption" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Mileage</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Current Mileage" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end space-x-4 pt-4 mt-4 border-t sticky bottom-0 bg-background">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {vehicle ? 'Update' : 'Add'} Vehicle
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}