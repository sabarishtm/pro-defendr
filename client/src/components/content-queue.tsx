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
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function ContentQueue() {
  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const caseMutation = useMutation({
    mutationFn: async (data: { contentId: number; decision: string }) => {
      const res = await apiRequest("POST", "/api/cases", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
  });

  if (isLoading) {
    return <div>Loading queue...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Queue</CardTitle>
        <CardDescription>
          Review and moderate content items in the queue
        </CardDescription>
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
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.content}</TableCell>
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}