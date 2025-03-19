import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { SelectCompanyVehicle } from "@/lib/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

type MileageRecord = {
  id: number;
  startDate: string;
  endDate: string;
  startMileage: number;
  endMileage: number;
  notes?: string;
};

const columns: ColumnDef<MileageRecord>[] = [
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => format(new Date(row.getValue("startDate")), "PPP"),
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => format(new Date(row.getValue("endDate")), "PPP"),
  },
  {
    accessorKey: "startMileage",
    header: "Start Mileage",
    cell: ({ row }) => `${row.getValue<number>("startMileage").toLocaleString()} km`,
  },
  {
    accessorKey: "endMileage",
    header: "End Mileage",
    cell: ({ row }) => `${row.getValue<number>("endMileage").toLocaleString()} km`,
  },
  {
    accessorKey: "distance",
    header: "Distance",
    cell: ({ row }) => {
      const distance = row.getValue<number>("endMileage") - row.getValue<number>("startMileage");
      return `${distance.toLocaleString()} km`;
    },
  },
  {
    accessorKey: "notes",
    header: "Notes",
  },
];

interface MileageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: SelectCompanyVehicle | null;
}

export function MileageDialog({ open, onOpenChange, vehicle }: MileageDialogProps) {
  const { data: mileageRecords = [], isLoading } = useQuery({
    queryKey: ['/api/vehicles', vehicle?.id, 'mileage'],
    queryFn: async () => {
      if (!vehicle) return [];
      const response = await fetch(`/api/vehicles/${vehicle.id}/mileage`);
      if (!response.ok) throw new Error('Failed to fetch mileage records');
      const data = await response.json();
      // Transform the dates into the correct format
      return data.map((record: any) => ({
        ...record,
        startDate: new Date(record.startDate).toISOString(),
        endDate: new Date(record.endDate).toISOString(),
      }));
    },
    enabled: !!vehicle,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Mileage History - {vehicle?.manufacturer} {vehicle?.model} ({vehicle?.licensePlate})
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <DataTable
            columns={columns}
            data={mileageRecords}
            isLoading={isLoading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}