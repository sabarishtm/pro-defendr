import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
import { Eye, Search, FileText, Image as ImageIcon, Video, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Update ContentItem type to include assignedUserName
type ContentItemWithUser = ContentItem & { assignedUserName?: string };

interface QueueProps {
  onOpenModeration?: (item: ContentItemWithUser) => void;
}

export default function ContentQueue({ onOpenModeration }: QueueProps) {
  // Sorting state
  const [sortField, setSortField] = useState<keyof ContentItem>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter state
  const [filter, setFilter] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<ContentItemWithUser[]>({
    queryKey: ["/api/content"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Content deleted",
        description: "The content has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete content",
      });
    },
  });

  // Filter items based on content or type
  const filteredItems = items.filter(item =>
    item.content.toLowerCase().includes(filter.toLowerCase()) ||
    item.type.toLowerCase().includes(filter.toLowerCase()) ||
    item.status.toLowerCase().includes(filter.toLowerCase())
  );

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (!aValue || !bValue) return 0;

    const direction = sortDirection === "asc" ? 1 : -1;

    // Special handling for dates
    if (sortField === "createdAt") {
      return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * direction;
    }

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

  // Helper function to get display name
  const getDisplayName = (item: ContentItem) => {
    if (item.type === "text") return item.content.slice(0, 15);
    // For media content, extract filename from path
    const fileName = item.content.split('/').pop() || '';
    return fileName.split('.')[0].slice(0, 15);
  };

  // Helper function to render content thumbnail
  const renderThumbnail = (item: ContentItem) => {
    switch (item.type.toLowerCase()) {
      case 'image':
        return (
          <div className="relative w-[120px] h-[80px] rounded-lg overflow-hidden bg-muted group-hover:scale-110 transition-all duration-200">
            <img
              src={item.content}
              alt="Thumbnail"
              className="w-full h-full object-contain blur-sm group-hover:blur-0 transition-all duration-500"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="w-[120px] h-[80px] rounded-lg flex items-center justify-center bg-muted group-hover:scale-110 transition-all duration-200">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
        );
      default:
        return (
          <div className="w-[120px] h-[80px] rounded-lg flex items-center justify-center bg-muted group-hover:scale-110 transition-all duration-200">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
        );
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
                <TableHead className="w-[140px]">Preview</TableHead>
                <TableHead>Content</TableHead>
                <SortableHeader field="type">Type</SortableHeader>
                <SortableHeader field="priority">Priority</SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="createdAt">Created At</SortableHeader>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenModeration?.(item)}
                >
                  <TableCell className="p-2">
                    {renderThumbnail(item)}
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate">
                    {getDisplayName(item)}
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
                    {item.createdAt ? (
                      format(new Date(item.createdAt), "MMM d, yyyy HH:mm")
                    ) : (
                      "Unknown"
                    )}
                  </TableCell>
                  <TableCell>
                    {item.assignedUserName ? (
                      <Badge variant="outline" className="bg-muted">
                        {item.assignedUserName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenModeration?.(item);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Content</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this content? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(item.id);
                              }}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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