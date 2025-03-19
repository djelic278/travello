import { ColumnDef } from "@tanstack/react-table";
import { SelectCompanyVehicle } from "@/lib/schema";
import { Badge } from "@/components/ui/badge";

export const columns: ColumnDef<SelectCompanyVehicle>[] = [
  {
    accessorKey: "manufacturer",
    header: "Manufacturer",
  },
  {
    accessorKey: "model",
    header: "Model",
  },
  {
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "licensePlate",
    header: "License Plate",
  },
  {
    accessorKey: "engineType",
    header: "Engine Type",
  },
  {
    accessorKey: "enginePower",
    header: "Power (HP)",
  },
  {
    accessorKey: "fuelConsumption",
    header: "Consumption (L/100km)",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status: string = row.getValue("status");
      const variant = 
        status === 'available' ? 'default' :
        status === 'in_use' ? 'secondary' :
        status === 'maintenance' ? 'destructive' :
        'outline';

      return (
        <Badge variant={variant}>
          {status.replace('_', ' ')}
        </Badge>
      );
    },
  },
  {
    accessorKey: "currentMileage",
    header: "Current Mileage",
    cell: ({ row }) => {
      const mileage = row.getValue("currentMileage") as number;
      return `${mileage.toLocaleString()} km`;
    },
  },
];