import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { columns } from "@/components/vehicles/columns";
import { VehicleDialog } from "@/components/vehicles/VehicleDialog";
import { MileageDialog } from "@/components/vehicles/MileageDialog";
import { useState, useEffect } from "react";
import { SelectCompanyVehicle } from "@/lib/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

export default function VehicleManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMileageDialogOpen, setIsMileageDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<SelectCompanyVehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<SelectCompanyVehicle | null>(null);
  const [mileageVehicle, setMileageVehicle] = useState<SelectCompanyVehicle | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['/api/vehicles', user?.companyId],
    queryFn: async () => {
      const response = await fetch('/api/vehicles');
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      const data = await response.json();
      
      // If user is not super_admin, filter vehicles by company
      if (user && user.role !== 'super_admin' && user.companyId) {
        return data.filter((vehicle: SelectCompanyVehicle) => 
          vehicle.companyId === user.companyId
        );
      }
      
      return data;
    },
    enabled: !!user, // Only run query when user data is available
  });

  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete vehicle');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete vehicle',
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const handleEdit = (event: CustomEvent<SelectCompanyVehicle>) => {
      setSelectedVehicle(event.detail);
      setIsDialogOpen(true);
    };

    const handleDelete = (event: CustomEvent<SelectCompanyVehicle>) => {
      setDeleteVehicle(event.detail);
    };

    const handleViewMileage = (event: CustomEvent<SelectCompanyVehicle>) => {
      setMileageVehicle(event.detail);
      setIsMileageDialogOpen(true);
    };

    document.addEventListener('edit-vehicle', handleEdit as EventListener);
    document.addEventListener('delete-vehicle', handleDelete as EventListener);
    document.addEventListener('view-mileage', handleViewMileage as EventListener);

    return () => {
      document.removeEventListener('edit-vehicle', handleEdit as EventListener);
      document.removeEventListener('delete-vehicle', handleDelete as EventListener);
      document.removeEventListener('view-mileage', handleViewMileage as EventListener);
    };
  }, []);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Company Vehicle Fleet</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={vehicles || []}
        isLoading={isLoading}
      />

      <VehicleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        vehicle={selectedVehicle}
        onClose={() => {
          setSelectedVehicle(null);
          setIsDialogOpen(false);
        }}
      />

      <MileageDialog
        open={isMileageDialogOpen}
        onOpenChange={setIsMileageDialogOpen}
        vehicle={mileageVehicle}
      />

      <AlertDialog 
        open={deleteVehicle !== null} 
        onOpenChange={(open) => !open && setDeleteVehicle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vehicle
              {deleteVehicle && ` ${deleteVehicle.manufacturer} ${deleteVehicle.model}`}
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteVehicle) {
                  deleteMutation.mutate(deleteVehicle.id);
                  setDeleteVehicle(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}