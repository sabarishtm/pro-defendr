import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { ContentItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// Update ContentItem type to include assignedUserName
type ContentItemWithUser = ContentItem & { assignedUserName?: string };

interface QueueProps {
  onOpenModeration?: (item: ContentItemWithUser) => void;
}

interface Filters {
  type: string;
  status: string;
  priority: string;
  assignedTo: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export default function ContentQueue({ onOpenModeration }: QueueProps) {
  const { data: currentUser } = useQuery({
    queryKey: ["/api/users/me"],
  });

  // Update the loadPersistedState function
  const loadPersistedState = () => {
    try {
      // Default to 'my-queue' when no tab is saved
      const savedTab = localStorage.getItem('content-queue-tab');
      // If savedTab is null (first time), use 'my-queue'
      const activeTab = savedTab !== null ? savedTab : 'my-queue';
      localStorage.setItem('content-queue-tab', activeTab); // Save default if not exists

      const savedFilters = JSON.parse(localStorage.getItem('content-queue-filters') || '{}');
      return { savedTab: activeTab, savedFilters };
    } catch (error) {
      console.error('Error loading persisted state:', error);
      return { savedTab: 'my-queue', savedFilters: {} };
    }
  };

  const { savedTab, savedFilters } = loadPersistedState();

  // Initialize state with persisted values
  const [activeTab, setActiveTab] = useState(savedTab);
  const [sortField, setSortField] = useState<keyof ContentItem>(savedFilters.sortField || "createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(savedFilters.sortDirection || "desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedFilters.pageSize || 10);
  const [search, setSearch] = useState(savedFilters.search || "");
  const [filters, setFilters] = useState<Filters>({
    type: savedFilters.type || "all",
    status: savedFilters.status || "all",
    priority: savedFilters.priority || "all",
    assignedTo: savedFilters.assignedTo || "all",
    dateFrom: savedFilters.dateFrom ? new Date(savedFilters.dateFrom) : null,
    dateTo: savedFilters.dateTo ? new Date(savedFilters.dateTo) : null,
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('content-queue-tab', activeTab);
    localStorage.setItem('content-queue-filters', JSON.stringify({
      sortField,
      sortDirection,
      pageSize,
      search,
      ...filters,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    }));
  }, [activeTab, sortField, sortDirection, pageSize, search, filters]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<ContentItemWithUser[]>({
    queryKey: ["/api/content"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
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

  // Filter items based on all criteria and current tab
  const filteredItems = items.filter(item => {
    // First filter by tab
    const isMyQueue = activeTab === "my-queue";
    const matchesQueue = isMyQueue
      ? item.assignedTo === currentUser?.id
      : !isMyQueue;

    if (!matchesQueue) return false;

    // Then apply other filters
    const matchesSearch =
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      item.type.toLowerCase().includes(search.toLowerCase()) ||
      item.status.toLowerCase().includes(search.toLowerCase());

    const matchesType = filters.type === "all" || item.type === filters.type;
    const matchesStatus = filters.status === "all" || item.status === filters.status;
    const matchesPriority = filters.priority === "all" ||
      (filters.priority === "high" ? item.priority > 1 : filters.priority === "low" && item.priority === 1);
    const matchesAssignee = filters.assignedTo === "all" ||
      (filters.assignedTo === "unassigned" ? !item.assignedTo :
        item.assignedUserName?.toLowerCase() === filters.assignedTo.toLowerCase());

    const itemDate = new Date(item.createdAt);
    const matchesDateRange =
      (!filters.dateFrom || itemDate >= filters.dateFrom) &&
      (!filters.dateTo || itemDate <= filters.dateTo);

    return matchesSearch && matchesType && matchesStatus &&
           matchesPriority && matchesAssignee && matchesDateRange;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (!aValue || !bValue) return 0;

    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortField === "createdAt") {
      return (new Date(aValue as string).getTime() - new Date(bValue as string).getTime()) * direction;
    }

    return aValue < bValue ? -direction : direction;
  });

  // Get unique values for filters
  const uniqueTypes = Array.from(new Set(items.map(item => item.type)));
  const uniqueStatuses = Array.from(new Set(items.map(item => item.status)));
  const uniqueAssignees = Array.from(new Set(items.filter(item => item.assignedUserName).map(item => item.assignedUserName!)));

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

  const getDisplayName = (item: ContentItem) => {
    if (item.type === "text") {
      return item.content.length > 30
        ? item.content.slice(0, 30) + "..."
        : item.content;
    }
    const fileName = item.content.split('/').pop() || '';
    return fileName.split('.')[0].replace(/-/g, ' ').slice(0, 30);
  };

  const renderThumbnail = (item: ContentItem) => {
    switch (item.type.toLowerCase()) {
      case 'image':
        return (
          <div className="relative w-[80px] h-[45px] rounded overflow-hidden bg-muted">
            <img
              src={item.content}
              alt="Thumbnail"
              className="w-full h-full object-contain blur-sm group-hover:blur-0 transition-all duration-500"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="relative w-[80px] h-[45px] rounded overflow-hidden bg-muted">
            {item.metadata.aiAnalysis?.timeline?.[0]?.thumbnail ? (
              <>
                <img
                  src={item.metadata.aiAnalysis.timeline[0].thumbnail}
                  alt="Video thumbnail"
                  className="w-full h-full object-contain blur-sm group-hover:blur-0 transition-all duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Video className="w-4 h-4 text-white" />
                </div>
              </>
            ) : (
              <div className="fallback-icon hidden absolute inset-0 flex items-center justify-center">
                <Video className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="w-[80px] h-[45px] rounded flex items-center justify-center bg-muted">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Loading content items...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const QueueContent = () => (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>
            {activeTab === "my-queue"
              ? `Items assigned to me (${filteredItems.length} items)`
              : `All content items (${filteredItems.length} items)`}
          </CardDescription>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Page Size" />
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
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px] py-2">Preview</TableHead>
                <TableHead className="py-2">Title</TableHead>
                <TableHead onClick={() => toggleSort("type")} className="cursor-pointer py-2">
                  Type {sortField === "type" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => toggleSort("priority")} className="cursor-pointer py-2">
                  Priority {sortField === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => toggleSort("status")} className="cursor-pointer py-2">
                  Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer py-2">
                  Created At {sortField === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="py-2">Assigned To</TableHead>
                <TableHead className="w-[100px] py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenModeration?.(item)}
                >
                  <TableCell className="py-1 px-2">
                    {renderThumbnail(item)}
                  </TableCell>
                  <TableCell className="py-1 font-medium">
                    <div className="truncate max-w-[200px] text-sm">{getDisplayName(item)}</div>
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge variant="outline" className="text-xs">{item.type}</Badge>
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge variant={item.priority > 1 ? "destructive" : "secondary"} className="text-xs">
                      {item.priority === 1 ? "Low" : "High"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge
                      variant={
                        item.status === "approved"
                          ? "secondary"
                          : item.status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1 text-sm">
                    {item.createdAt ? (
                      format(new Date(item.createdAt), "MMM d, yyyy HH:mm")
                    ) : (
                      "Unknown"
                    )}
                  </TableCell>
                  <TableCell className="py-1">
                    {item.assignedUserName ? (
                      <Badge variant="outline" className="bg-muted text-xs">
                        {item.assignedUserName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenModeration?.(item);
                        }}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
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

  const clearFilters = () => {
    setFilters({
      type: "all",
      status: "all",
      priority: "all",
      assignedTo: "all",
      dateFrom: null,
      dateTo: null,
    });
    setSearch("");
    setSortField("createdAt");
    setSortDirection("desc");
    setPage(1);
    // Clear persisted filters
    localStorage.removeItem('content-queue-filters');
  };

  return (
    <div className="space-y-4">
      {/* Common Filter Card */}
      <Card className="mb-2">
        <CardHeader>
          <CardDescription>
            Filter and search content items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-[200px]"
              />
            </div>
            <Select
              value={filters.type}
              onValueChange={(value) => {
                setFilters((prev) => ({ ...prev, type: value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Content Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => {
                setFilters((prev) => ({ ...prev, status: value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.priority}
              onValueChange={(value) => {
                setFilters((prev) => ({ ...prev, priority: value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.assignedTo}
              onValueChange={(value) => {
                setFilters((prev) => ({ ...prev, assignedTo: value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {uniqueAssignees.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[130px]">
                  {filters.dateFrom ? format(filters.dateFrom, "PP") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => {
                    setFilters((prev) => ({ ...prev, dateFrom: date }));
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[130px]">
                  {filters.dateTo ? format(filters.dateTo, "PP") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => {
                    setFilters((prev) => ({ ...prev, dateTo: date }));
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-10 w-fit p-1">
          <TabsTrigger
            value="my-queue"
            className="text-base font-semibold px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            My Queue
          </TabsTrigger>
          <TabsTrigger
            value="team-queue"
            className="text-base font-semibold px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            Team Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-queue">
          <QueueContent />
        </TabsContent>

        <TabsContent value="team-queue">
          <QueueContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}