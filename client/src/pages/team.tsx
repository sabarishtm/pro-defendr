import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Team() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Team Management</h1>
      <Card>
        <CardHeader>
          <CardTitle>Content Moderation Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Team member list will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
