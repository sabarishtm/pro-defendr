import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ContentItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/content", { page, pageSize, sortField, sortOrder }],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortField,
        sortOrder
      });
      const response = await apiRequest("GET", `/api/content?${queryParams}`);
      return Array.isArray(response) ? response : [];
    }
  });

  const items = data || [];
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const displayItems = items.slice((page - 1) * pageSize, page * pageSize);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Content deleted",
        description: "The content item has been removed from the queue.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete content. Please try again.",
      });
    },
  });

  const caseMutation = useMutation({
    mutationFn: async (data: { contentId: number; decision: string }) => {
      const res = await apiRequest("POST", "/api/cases", data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
  });

  function handleSort(field: string) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  if (isLoading) {
    return <div>Loading queue...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Content Queue</CardTitle>
            <CardDescription>
              Review and moderate content items in the queue
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
              <TableHead className="cursor-pointer" onClick={() => handleSort("content")}>
                Content <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>
                Type <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("priority")}>
                Priority <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                Status <ArrowUpDown className="inline w-4 h-4 ml-1" />
              </TableHead>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        caseMutation.mutate({
                          contentId: item.id,
                          decision: "approved",
                        })
                      }
                      disabled={item.status !== "pending"}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        caseMutation.mutate({
                          contentId: item.id,
                          decision: "rejected",
                        })
                      }
                      disabled={item.status !== "pending"}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this content?")) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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