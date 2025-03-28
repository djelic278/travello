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

// Helper function to format dates safely
const formatDateCell = (dateValue: unknown, fieldName: string): string => {
  try {
    if (dateValue === null || dateValue === undefined) return "N/A";
    
    // Handle string date values
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return format(date, "PPP");
      }
    }
    
    // Handle Date objects
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return format(dateValue, "PPP");
      }
    }
    
    // If we got here, it's an invalid date
    return `Invalid date format`;
  } catch (error) {
    console.error(`Error formatting ${fieldName}:`, error, dateValue);
    return "Error";
  }
};

const columns: ColumnDef<MileageRecord>[] = [
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => formatDateCell(row.getValue("startDate"), "startDate"),
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => formatDateCell(row.getValue("endDate"), "endDate"),
  },
  {
    accessorKey: "startMileage",
    header: "Start Mileage",
    cell: ({ row }) => {
      const value = row.getValue<number | undefined>("startMileage");
      return value !== undefined ? `${value.toLocaleString()} km` : "N/A";
    },
  },
  {
    accessorKey: "endMileage",
    header: "End Mileage",
    cell: ({ row }) => {
      const value = row.getValue<number | undefined>("endMileage");
      return value !== undefined ? `${value.toLocaleString()} km` : "N/A";
    },
  },
  {
    accessorKey: "distance",
    header: "Distance",
    cell: ({ row }) => {
      const startMileage = row.getValue<number | undefined>("startMileage");
      const endMileage = row.getValue<number | undefined>("endMileage");
      
      if (startMileage !== undefined && endMileage !== undefined) {
        const distance = endMileage - startMileage;
        return `${distance.toLocaleString()} km`;
      }
      return "N/A";
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
      return response.json();
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