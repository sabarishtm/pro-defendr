import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import type { ContentItem } from "@shared/schema";

interface TableMeta {
  onOpenModeration?: (item: ContentItem) => void;
}

export const columns: ColumnDef<ContentItem>[] = [
  {
    accessorKey: "content",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          Content
          {column.getCanSort() && (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </div>
      );
    },
    cell: ({ row }) => {
      const content = row.getValue("content") as string;
      return (
        <div className="max-w-[500px] truncate">
          {content}
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          Type
          {column.getCanSort() && (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </div>
      );
    },
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return <Badge variant="outline">{type}</Badge>;
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          Priority
          {column.getCanSort() && (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </div>
      );
    },
    cell: ({ row }) => {
      const priority = row.getValue("priority") as number;
      return (
        <Badge variant={priority > 1 ? "destructive" : "secondary"}>
          {priority === 1 ? "Low" : "High"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <div className="flex items-center">
          Status
          {column.getCanSort() && (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </div>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={
          status === "approved" 
            ? "secondary" 
            : status === "rejected"
            ? "destructive"
            : "outline"
        }>
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as TableMeta;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => meta.onOpenModeration?.(item)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];