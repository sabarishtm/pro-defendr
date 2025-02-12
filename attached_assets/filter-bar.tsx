import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { contentTypes, moderationStatuses } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export type FilterState = {
  type?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "date" | "status" | "type";
  sortOrder?: "asc" | "desc";
  warningTypes?: string[];
};

type FilterBarProps = {
  onFilterChange: (filters: FilterState) => void;
  warningTypes?: string[];
};

export default function FilterBar({ onFilterChange, warningTypes = [] }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({});
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedWarnings, setSelectedWarnings] = useState<string[]>([]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newValue = value === "all" ? undefined : value;
    const newFilters = { ...filters, [key]: newValue };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (key: "dateFrom" | "dateTo", date?: Date) => {
    if (key === "dateFrom") setDateFrom(date);
    else setDateTo(date);

    const newFilters = { ...filters, [key]: date };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleWarningTypesChange = (value: string) => {
    let newWarnings: string[];
    if (value === "all") {
      newWarnings = [];
    } else if (selectedWarnings.includes(value)) {
      newWarnings = selectedWarnings.filter((w) => w !== value);
    } else {
      newWarnings = [...selectedWarnings, value];
    }
    setSelectedWarnings(newWarnings);

    const newFilters = {
      ...filters,
      warningTypes: newWarnings.length ? newWarnings : undefined,
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedWarnings([]);
    onFilterChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-4 rounded-lg border bg-card">
      <Select
        value={filters.type}
        onValueChange={(value) => handleFilterChange("type", value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Content Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {contentTypes.map((type) => (
            <SelectItem key={type} value={type} className="capitalize">
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => handleFilterChange("status", value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {moderationStatuses.map((status) => (
            <SelectItem key={status} value={status} className="capitalize">
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {Array.isArray(warningTypes) && warningTypes.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                selectedWarnings.length > 0 && "text-primary"
              )}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {selectedWarnings.length === 0 && "Warning Types"}
              {selectedWarnings.length === 1 &&
                selectedWarnings[0].replace(/_/g, " ")}
              {selectedWarnings.length > 1 &&
                `${selectedWarnings.length} warnings selected`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                className="justify-start font-normal"
                onClick={() => handleWarningTypesChange("all")}
              >
                All Warning Types
              </Button>
              {warningTypes.map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  className={cn(
                    "justify-start font-normal",
                    selectedWarnings.includes(type) && "bg-primary/10"
                  )}
                  onClick={() => handleWarningTypesChange(type)}
                >
                  {type.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "PPP") : <span>From Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(date) => handleDateChange("dateFrom", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "PPP") : <span>To Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(date) => handleDateChange("dateTo", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Select
        value={filters.sortBy}
        onValueChange={(value) => handleFilterChange("sortBy", value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Date</SelectItem>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="type">Type</SelectItem>
        </SelectContent>
      </Select>

      {Object.keys(filters).length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="ml-auto"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}