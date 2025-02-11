import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileVideo, FileImage, Loader2, Upload } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/content/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return await response.json();
    },
    onSuccess: () => {
      setFile(null);
      setName("");
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Upload successful",
        description: "Your content has been uploaded and will be analyzed.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your content. Please try again.",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const fileType = selectedFile.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image or video file.",
      });
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setFile(selectedFile);

    // Set default name from filename if no custom name is provided
    if (!name) {
      const filename = selectedFile.name.split('.')[0];
      setName(filename.slice(0, 15));
    }

    // Cleanup previous preview URL
    return () => URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', file.type.split('/')[0]);
    formData.append('name', name || file.name.slice(0, 15));

    uploadMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Content</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Content Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for this content"
              maxLength={50}
            />
          </div>

          <div>
            <Label htmlFor="file">Select File (Images or Videos)</Label>
            <Input
              id="file"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="mt-2"
            />
          </div>

          {previewUrl && (
            <div className="mt-4 border rounded-lg p-4 bg-muted/50">
              {file?.type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[300px] w-full object-contain rounded-md"
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-[300px] w-full rounded-md"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={!file || uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Content
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}