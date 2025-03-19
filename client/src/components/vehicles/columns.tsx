import { ColumnDef } from "@tanstack/react-table";
import { SelectCompanyVehicle } from "@/lib/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, LineChart } from "lucide-react";

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
  {
    id: "actions",
    cell: ({ row }) => {
      const vehicle = row.original;

      return (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              document.dispatchEvent(new CustomEvent('view-mileage', { detail: vehicle }));
            }}
          >
            <LineChart className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              document.dispatchEvent(new CustomEvent('edit-vehicle', { detail: vehicle }));
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 p-0 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              document.dispatchEvent(new CustomEvent('delete-vehicle', { detail: vehicle }));
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];