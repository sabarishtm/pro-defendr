import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ContentItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface QueueProps {
  onOpenModeration?: (item: ContentItem) => void;
}

export default function ContentQueue({ onOpenModeration }: QueueProps) {
  // Sorting state
  const [sortField, setSortField] = useState<keyof ContentItem>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === bValue) return 0;

    const direction = sortDirection === "asc" ? 1 : -1;
    return aValue < bValue ? -direction : direction;
  });

  const toggleSort = (field: keyof ContentItem) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ field, children }: { field: keyof ContentItem, children: React.ReactNode }) => (
    <TableHead>
      <Button 
        variant="ghost" 
        onClick={() => toggleSort(field)}
        className="hover:bg-muted px-2 py-1 -ml-2"
      >
        {children}
        {sortField === field && (
          <span className="ml-2">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </Button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Queue</CardTitle>
          <CardDescription>Loading content items...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Content Queue</CardTitle>
          <CardDescription>
            Review and moderate content items ({items.length} items)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="content">Content</SortableHeader>
              <SortableHeader field="type">Type</SortableHeader>
              <SortableHeader field="priority">Priority</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[400px] truncate">
                  {item.content}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.priority > 1 ? "destructive" : "secondary"}>
                    {item.priority === 1 ? "Low" : "High"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    item.status === "approved" 
                      ? "secondary" 
                      : item.status === "rejected"
                      ? "destructive"
                      : "outline"
                  }>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {onOpenModeration && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenModeration(item)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}