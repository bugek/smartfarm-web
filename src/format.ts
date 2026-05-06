export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  complete: "Complete",
  needs_evidence: "Needs evidence",
  awaiting_review: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  queued: "Queued",
  uploading: "Uploading",
  uploaded: "Uploaded",
  failed: "Failed"
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const CATEGORY_LABEL: Record<string, string> = {
  soil: "Soil",
  water: "Water",
  inputs: "Inputs",
  harvest: "Harvest",
  worker_safety: "Worker safety",
  records: "Records"
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

const ROLE_LABEL: Record<string, string> = {
  farmer: "Farmer",
  advisor: "Advisor",
  compliance: "Compliance lead"
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}
