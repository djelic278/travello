import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
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
    mutationFn: async (data: typeof form.getValues) => {
      const response = await fetch(`/api/vehicles${vehicle ? `/${vehicle.id}` : ''}`, {
        method: vehicle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.getValues()), // Get the actual form values
      });
      if (!response.ok) {
        throw new Error('Failed to save vehicle');
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Edit' : 'Add'} Vehicle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid gap-4">
              <Input
                {...form.register("manufacturer")}
                placeholder="Manufacturer"
                label="Manufacturer"
              />
              <Input
                {...form.register("model")}
                placeholder="Model"
                label="Model"
              />
              <Input
                {...form.register("year", { valueAsNumber: true })}
                type="number"
                placeholder="Year"
                label="Year"
              />
              <Input
                {...form.register("licensePlate")}
                placeholder="License Plate"
                label="License Plate"
              />
              <Input
                {...form.register("engineType")}
                placeholder="Engine Type"
                label="Engine Type"
              />
              <Input
                {...form.register("enginePower", { valueAsNumber: true })}
                type="number"
                placeholder="Engine Power (HP)"
                label="Engine Power (HP)"
              />
              <Input
                {...form.register("fuelConsumption", { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="Fuel Consumption (L/100km)"
                label="Fuel Consumption (L/100km)"
              />
              <Select
                onValueChange={(value) => form.setValue("status", value)}
                defaultValue={form.getValues("status")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Input
                {...form.register("currentMileage", { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="Current Mileage"
                label="Current Mileage"
              />
            </div>
            <div className="flex justify-end space-x-4">
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