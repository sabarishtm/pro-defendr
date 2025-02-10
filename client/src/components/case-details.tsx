import { useQuery } from "@tanstack/react-query";
import { Case } from "@shared/schema";
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
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CaseDetails() {
  const { data: cases = [], isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  if (isLoading) {
    return <div>Loading cases...</div>;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Cases</CardTitle>
        <CardDescription>Your moderation history</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableBody>
              {cases.map((case_) => (
                <TableRow key={case_.id}>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="font-medium">Case #{case_.id}</div>
                      <Badge variant="outline">{case_.status}</Badge>
                      {case_.decision && (
                        <Badge
                          variant={
                            case_.decision === "approved"
                              ? "success"
                              : "destructive"
                          }
                        >
                          {case_.decision}
                        </Badge>
                      )}
                      {case_.notes && (
                        <div className="text-sm text-muted-foreground">
                          {case_.notes}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
