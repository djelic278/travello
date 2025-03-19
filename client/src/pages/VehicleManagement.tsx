import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { columns } from "@/components/vehicles/columns";
import { VehicleDialog } from "@/components/vehicles/VehicleDialog";
import { useState } from "react";
import { SelectCompanyVehicle } from "@/lib/schema";

export default function VehicleManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<SelectCompanyVehicle | null>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles');
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      return response.json();
    },
  });

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
        onRowClick={(row) => {
          setSelectedVehicle(row.original);
          setIsDialogOpen(true);
        }}
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
    </div>
  );
}
