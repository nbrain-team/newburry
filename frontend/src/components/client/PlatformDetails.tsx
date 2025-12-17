import { useState, useEffect, useRef } from "react";

type PlatformUpload = {
  id: number;
  original_name: string;
  upload_type: string;
  content_type: string;
  file_size: number;
  content_summary: string;
  processing_status: string;
  vectorized: boolean;
  created_at: string;
};

interface PlatformDetailsProps {
  clientId: number;
  api: string;
  authHeaders: HeadersInit | undefined;
}

export default function PlatformDetails({ clientId, api, authHeaders }: PlatformDetailsProps) {
  const [uploads, setUploads] = useState<PlatformUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUploads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${api}/api/data-uploads/client/${clientId}?type=platform_detail`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setUploads(data.uploads);
      } else {
        setError(data.error || "Failed to load platform details");
      }
    } catch (err) {
      setError("Failed to load platform details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [clientId, api, authHeaders]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("upload_type", "platform_detail");
    formData.append("description", "Platform details upload");

    // Append all selected files
    Array.from(e.target.files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch(`${api}/api/data-uploads/client/${clientId}`, {
        method: "POST",
        headers: {
          Authorization: (authHeaders as any)?.Authorization,
          // Do not set Content-Type, let browser set it with boundary
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // Refresh list
        fetchUploads();
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      setError("Upload failed");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const res = await fetch(`${api}/api/data-uploads/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (err) {
      alert("Delete failed");
      console.error(err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-[var(--color-text)]">Platform Details</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Upload technical documentation, architecture diagrams, and platform specs. 
            The AI agent will use these to answer technical inquiries.
          </p>
        </div>
        <div>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".md,.txt,.pdf,.doc,.docx,.html,.json,.csv"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary flex items-center gap-2"
          >
            {uploading ? (
              <>
                <span className="animate-spin">⌛</span> Uploading...
              </>
            ) : (
              <>
                <span>📤</span> Upload Files
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-[var(--color-text-muted)]">Loading...</div>
      ) : uploads.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-[var(--color-text-muted)]">No platform details uploaded yet.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-[var(--color-primary)] hover:underline text-sm"
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-white border border-[var(--color-border)] rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-center hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {upload.original_name.endsWith(".md")
                      ? "📝"
                      : upload.original_name.endsWith(".pdf")
                      ? "📕"
                      : "📄"}
                  </span>
                  <div>
                    <h4 className="font-medium text-[var(--color-text)] truncate" title={upload.original_name}>
                      {upload.original_name}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{formatSize(upload.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] ${
                          upload.vectorized
                            ? "bg-green-100 text-green-700"
                            : upload.processing_status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {upload.vectorized ? "AI Ready" : upload.processing_status}
                      </span>
                    </div>
                  </div>
                </div>
                {upload.content_summary && (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)] line-clamp-2">
                    {upload.content_summary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(upload.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




