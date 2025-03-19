import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  onRowClick?: (row: { original: TData }) => void;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  onRowClick,
}: DataTableProps<TData>) {
  const table = useTable({
    data,
    columns,
  });

  if (isLoading) {
    return (
      <div className="w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex space-x-4 mb-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.column.columnDef.header as string}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.({ original: row.original })}
              className={onRowClick ? "cursor-pointer hover:bg-muted" : ""}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {cell.column.columnDef.cell
                    ? cell.column.columnDef.cell(cell.getContext())
                    : cell.getValue() as string}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
