import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Content } from "@shared/schema";
import ContentCard from "./content-card";
import ContentTable from "./content-table";
import { Skeleton } from "@/components/ui/skeleton";
import FilterBar, { type FilterState } from "./filter-bar";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

function ContentCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export default function ContentGrid() {
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: content, isLoading } = useQuery<Content[]>({
    queryKey: ["/api/content"],
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contentIds: number[]) => {
      const response = await fetch("/api/content/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: contentIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete content");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Selected content deleted successfully",
      });
      setSelectedItems(new Set());
      setSelectionMode(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete content",
        variant: "destructive",
      });
    },
  });

  const filterContent = (items: Content[] = []): Content[] => {
    return items.filter((item) => {
      if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.dateFrom && new Date(item.queuedAt!) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(item.queuedAt!) > new Date(filters.dateTo)) return false;

      if (filters.warningTypes && filters.warningTypes.length > 0) {
        try {
          const scores = JSON.parse(item.aiConfidence || "{}");
          return filters.warningTypes.some(warningType => {
            const warningScore = scores[warningType] as number;
            const threshold = item.type === 'text' ? 0 : 0.01;
            return warningScore && warningScore > threshold;
          });
        } catch {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (!filters.sortBy) return new Date(b.queuedAt!).getTime() - new Date(a.queuedAt!).getTime();

      switch (filters.sortBy) {
        case "date":
          return new Date(b.queuedAt!).getTime() - new Date(a.queuedAt!).getTime();
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "type":
          return (a.type || "").localeCompare(b.type || "");
        default:
          return 0;
      }
    });
  };

  const getWarningTypes = (content: Content[] = []): string[] => {
    const warningTypesSet = new Set<string>();

    content.forEach(item => {
      try {
        const scores = JSON.parse(item.aiConfidence || "{}");
        Object.entries(scores).forEach(([type, score]) => {
          const threshold = item.type === 'text' ? 0 : 0.01;
          if (typeof score === 'number' && score > threshold) {
            warningTypesSet.add(type);
          }
        });
      } catch {
        // Skip invalid JSON
      }
    });

    return Array.from(warningTypesSet).sort();
  };

  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedItems);
    if (selectedItems.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      setSelectedItems(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedItems));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <FilterBar onFilterChange={setFilters} warningTypes={[]} />
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Recent Content</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <ContentCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">All Content</h2>
          <div className="rounded-md border">
            <div className="p-4">
              <Skeleton className="h-[300px] w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredContent = filterContent(content);
  const recentContent = filteredContent.slice(0, 5);
  const availableWarningTypes = content ? getWarningTypes(content) : [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <FilterBar onFilterChange={setFilters} warningTypes={availableWarningTypes} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleSelectionMode}
          >
            {selectionMode ? "Cancel Selection" : "Select Items"}
          </Button>
          {selectionMode && selectedItems.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedItems.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete {selectedItems.size} selected items and remove their files from storage.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recent Content</h2>
        <Carousel
          className="w-full"
          opts={{
            align: "start",
          }}
        >
          <CarouselContent>
            {recentContent.map((item) => (
              <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <ContentCard
                  content={item}
                  selected={selectedItems.has(item.id)}
                  onSelect={handleSelect}
                  selectionMode={selectionMode}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">All Content</h2>
        <ContentTable
          content={filteredContent}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}