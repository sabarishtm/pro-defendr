import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { ContentItem } from "@shared/schema";

interface TableMeta {
  onOpenModeration?: (item: ContentItem) => void;
}

export const columns: ColumnDef<ContentItem>[] = [
  {
    accessorKey: "content",
    header: "Content",
    cell: ({ row }) => (
      <div className="max-w-[400px] truncate">
        {row.getValue("content")}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("type")}</Badge>
    ),
  },
  {
    accessorKey: "priority",
    header: "Priority",
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
    header: "Status",
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
    header: "",
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