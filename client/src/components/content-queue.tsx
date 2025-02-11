import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentItem } from "@shared/schema";
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
import { AlertTriangle, CheckCircle, XCircle, ArrowUpDown, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<string>("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { toast } = useToast();

  const { data: contentItems = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/content");
        // Assuming the API now returns an array of ContentItem
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching content:", error);
        return [];
      }
    }
  });

  // Client-side sorting and pagination
  const sortedItems = [...contentItems].sort((a, b) => {
    if (sortField === "priority") {
      return sortOrder === "asc" ? a.priority - b.priority : b.priority - a.priority;
    }
    if (sortField === "content") {
      return sortOrder === "asc"
        ? a.content.localeCompare(b.content)
        : b.content.localeCompare(a.content);
    }
    return 0;
  });

  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const displayItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

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
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Content Queue</CardTitle>
            <CardDescription>
              Review and moderate content items in the queue ({totalItems} items)
            </CardDescription>
          </div>
          <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
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
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => {
                if (sortField === "content") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField("content");
                  setSortOrder("asc");
                }
              }}>
                Content <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="cursor-pointer" onClick={() => {
                if (sortField === "priority") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField("priority");
                  setSortOrder("asc");
                }
              }}>
                Priority <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium max-w-xs truncate">
                  {item.content}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.type}</Badge>
                </TableCell>
                <TableCell>
                  {item.priority === 1 ? (
                    <Badge variant="secondary">Low</Badge>
                  ) : (
                    <Badge variant="destructive">High</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {item.status === "pending" ? (
                    <Badge variant="outline">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Pending
                    </Badge>
                  ) : item.status === "approved" ? (
                    <Badge variant="secondary">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejected
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {onOpenModeration && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenModeration(item)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {displayItems.length} of {totalItems} items
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}