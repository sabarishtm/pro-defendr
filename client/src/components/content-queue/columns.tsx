import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import type { ContentItem } from "@shared/schema";

interface TableMeta {
  onOpenModeration?: (item: ContentItem) => void;
}

const SortButton = ({ column, children }: { column: any; children: React.ReactNode }) => {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="-ml-4"
    >
      {children}
      <ArrowUpDown className={`ml-2 h-4 w-4 ${sorted ? "opacity-100" : "opacity-40"}`} />
    </Button>
  );
};

export const columns: ColumnDef<ContentItem>[] = [
  {
    accessorKey: "content",
    header: ({ column }) => (
      <SortButton column={column}>Content</SortButton>
    ),
    cell: ({ row }) => (
      <div className="max-w-[400px] truncate">
        {row.getValue("content")}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <SortButton column={column}>Type</SortButton>
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("type")}</Badge>
    ),
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <SortButton column={column}>Priority</SortButton>
    ),
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
    header: ({ column }) => (
      <SortButton column={column}>Status</SortButton>
    ),
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