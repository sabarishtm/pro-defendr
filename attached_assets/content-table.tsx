import { useState } from "react";
import { type Content } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface ContentTableProps {
  content: Content[];
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
}

type SortField = "title" | "warnings" | "queuedAt" | "moderatedAt" | "status";
type SortDirection = "asc" | "desc";

export default function ContentTable({
  content,
  currentPage,
  onPageChange,
  itemsPerPage = 10
}: ContentTableProps) {
  const [sortField, setSortField] = useState<SortField>("queuedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const totalPages = Math.ceil(content.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortedContent = () => {
    return [...content].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      switch (sortField) {
        case "title":
          return multiplier * (a.title || "").localeCompare(b.title || "");
        case "warnings":
          const aScore = Math.max(...Object.values(JSON.parse(a.aiConfidence || "{}")));
          const bScore = Math.max(...Object.values(JSON.parse(b.aiConfidence || "{}")));
          return multiplier * (bScore - aScore);
        case "queuedAt":
          return multiplier * (new Date(b.queuedAt || 0).getTime() - new Date(a.queuedAt || 0).getTime());
        case "moderatedAt":
          return multiplier * (new Date(b.moderatedAt || 0).getTime() - new Date(a.moderatedAt || 0).getTime());
        case "status":
          return multiplier * (a.status || "").localeCompare(b.status || "");
        default:
          return 0;
      }
    });
  };

  const getTopWarnings = (item: Content): { type: string; score: number }[] => {
    try {
      const scores = JSON.parse(item.aiConfidence || "{}");
      return Object.entries(scores)
        .filter(([_, score]) => item.type === 'text' ? Number(score) > 0 : Number(score) > 0.01)
        .sort(([_, a], [__, b]) => Number(b) - Number(a))
        .slice(0, 3)
        .map(([type, score]) => ({
          type: type.replace(/_/g, ' '),
          score: item.type === 'text' ? Number(score) : Number(score) * 100
        }));
    } catch {
      return [];
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVideoThumbnail = (item: Content): string | null => {
    if (item.type !== 'video') return null;
    try {
      const thumbnails = JSON.parse(item.videoThumbnails || "[]");
      return thumbnails[0] || null;
    } catch {
      return null;
    }
  };

  const sortedContent = getSortedContent();
  const currentItems = sortedContent.slice(startIndex, endIndex);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (field !== sortField) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const getBlurAmount = (item: Content): number => {
    const maxConfidence = Math.max(...Object.values(JSON.parse(item.aiConfidence || "{}")));

    if (item.status === "rejected") return 10;
    if (item.status === "flagged") return 7;
    if (item.status === "pending") return 5;
    return maxConfidence > 0.6 ? Math.max(3, Math.round(maxConfidence * 10)) : 0;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Thumbnail</TableHead>
              <TableHead onClick={() => handleSort("title")} className="cursor-pointer">
                <div className="flex items-center">
                  Title
                  <SortIcon field="title" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("warnings")} className="cursor-pointer">
                <div className="flex items-center">
                  Top Warnings
                  <SortIcon field="warnings" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("queuedAt")} className="cursor-pointer">
                <div className="flex items-center">
                  Queued Date
                  <SortIcon field="queuedAt" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("moderatedAt")} className="cursor-pointer">
                <div className="flex items-center">
                  Last Action
                  <SortIcon field="moderatedAt" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer">
                <div className="flex items-center">
                  Status
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((item) => (
              <TableRow key={item.id} className="transition-colors hover:bg-accent/50 hover:cursor-pointer">
                <TableCell>
                  <Link href={`/content/${item.id}`}>
                    <div className="relative w-[80px] h-[45px] bg-muted rounded overflow-hidden cursor-pointer group">
                      {(item.type === 'image' || getVideoThumbnail(item)) && (
                        <img
                          src={item.type === 'image' ? item.url : getVideoThumbnail(item)!}
                          alt={item.title}
                          className="w-full h-full object-cover transition-all duration-300 ease-in-out transform group-hover:scale-110"
                          style={{
                            filter: `blur(${getBlurAmount(item)}px)`,
                            transition: 'filter 0.3s ease-in-out, transform 0.3s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            const originalBlur = getBlurAmount(item);
                            e.currentTarget.style.filter = `blur(${originalBlur * 0.1}px)`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = `blur(${getBlurAmount(item)}px)`;
                          }}
                        />
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="truncate max-w-[200px]">{item.title}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getTopWarnings(item).map(({ type, score }, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={score > 50 ? "destructive" : "secondary"}>
                              {type}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Score: {score.toFixed(1)}%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatDate(item.queuedAt)}</TableCell>
                <TableCell>{formatDate(item.moderatedAt)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === "approved"
                        ? "outline"
                        : item.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <Link href={`/content/${item.id}`}>
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <PaginationPrevious className="h-4 w-4" />
            </Button>
          </PaginationItem>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PaginationItem key={page}>
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            </PaginationItem>
          ))}

          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <PaginationNext className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}