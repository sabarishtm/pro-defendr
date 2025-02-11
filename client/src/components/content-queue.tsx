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
import { Input } from "@/components/ui/input";
import { Eye, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QueueProps {
  onOpenModeration?: (item: ContentItem) => void;
}

export default function ContentQueue({ onOpenModeration }: QueueProps) {
  // Sorting state
  const [sortField, setSortField] = useState<keyof ContentItem>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter state
  const [filter, setFilter] = useState("");

  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  // Filter items
  const filteredItems = items.filter(item =>
    item.content.toLowerCase().includes(filter.toLowerCase()) ||
    item.type.toLowerCase().includes(filter.toLowerCase()) ||
    item.status.toLowerCase().includes(filter.toLowerCase())
  );

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === bValue) return 0;

    const direction = sortDirection === "asc" ? 1 : -1;
    return aValue < bValue ? -direction : direction;
  });

  // Paginate items
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedItems = sortedItems.slice(start, start + pageSize);

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
        <div className="space-y-4">
          <div>
            <CardTitle>Content Queue</CardTitle>
            <CardDescription>
              Review and moderate content items ({totalItems} items)
            </CardDescription>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1); // Reset to first page on filter
                }}
                className="w-[300px]"
              />
            </div>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1); // Reset to first page on size change
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select page size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
              {paginatedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenModeration?.(item)}
                >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent row click
                        onOpenModeration?.(item);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {start + 1}-{Math.min(start + pageSize, totalItems)} of {totalItems} items
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}