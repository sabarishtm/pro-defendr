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
      const sorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="hover:bg-muted px-0"
        >
          Content
          <ArrowUpDown className={`ml-2 h-4 w-4 ${sorted ? "opacity-100" : "opacity-50"}`} />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="max-w-[500px] truncate">{row.getValue("content")}</div>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="hover:bg-muted px-0"
        >
          Type
          <ArrowUpDown className={`ml-2 h-4 w-4 ${sorted ? "opacity-100" : "opacity-50"}`} />
        </Button>
      );
    },
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("type")}</Badge>
    ),
  },
  {
    accessorKey: "priority",
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="hover:bg-muted px-0"
        >
          Priority
          <ArrowUpDown className={`ml-2 h-4 w-4 ${sorted ? "opacity-100" : "opacity-50"}`} />
        </Button>
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
      const sorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="hover:bg-muted px-0"
        >
          Status
          <ArrowUpDown className={`ml-2 h-4 w-4 ${sorted ? "opacity-100" : "opacity-50"}`} />
        </Button>
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
      const meta = table.options.meta as TableMeta;
      return (
        <Button
          variant="outline"
          size="icon"
          onClick={() => meta.onOpenModeration?.(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      );
    },
  },
];