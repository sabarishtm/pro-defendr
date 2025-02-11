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
import { AlertTriangle, CheckCircle, XCircle, ArrowUpDown, Eye } from "lucide-react";
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

  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/content");
      console.log("API Response:", response);
      if (!Array.isArray(response)) {
        console.error("Invalid response format:", response);
        return [];
      }
      return response;
    }
  });

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    if (sortField === "priority") {
      return sortOrder === "asc" ? a.priority - b.priority : b.priority - a.priority;
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
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium max-w-md truncate">
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