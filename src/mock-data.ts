import type {
  Evidence,
  Farm,
  GapChecklistItem,
  Organization,
  Plot,
  Review
} from "./types";

// Mock dataset stands in for the SmartFarm API until live endpoints are
// wired. Shape mirrors the API contract drafted in smartfarm-docs.

export const organizations: Organization[] = [
  {
    id: "org-001",
    name: "Green Valley Cooperative",
    role: "farmer",
    membershipRole: "worker"
  },
  {
    id: "org-002",
    name: "Northern Highlands Farm",
    role: "farmer",
    membershipRole: "worker"
  }
];

export const farms: Farm[] = [
  { id: "farm-001", organizationId: "org-001", name: "Riverside Block A", region: "Chiang Mai" },
  { id: "farm-002", organizationId: "org-001", name: "Hillside Block B", region: "Chiang Mai" },
  { id: "farm-003", organizationId: "org-002", name: "Highlands North", region: "Chiang Rai" }
];

export const plots: Plot[] = [
  {
    id: "plot-001",
    farmId: "farm-001",
    name: "Plot A1",
    crop: "Tomato",
    hectares: 1.2,
    cycleLabel: "2026 Spring"
  },
  {
    id: "plot-002",
    farmId: "farm-001",
    name: "Plot A2",
    crop: "Lettuce",
    hectares: 0.8,
    cycleLabel: "2026 Spring"
  },
  {
    id: "plot-003",
    farmId: "farm-002",
    name: "Plot B1",
    crop: "Strawberry",
    hectares: 0.5,
    cycleLabel: "2026 Spring"
  },
  {
    id: "plot-004",
    farmId: "farm-003",
    name: "Plot N1",
    crop: "Coffee",
    hectares: 3.4,
    cycleLabel: "2026 Annual"
  }
];

export const gapItems: GapChecklistItem[] = [
  {
    id: "gap-001",
    plotId: "plot-001",
    category: "soil",
    code: "GAP-1.1",
    title: "Soil test on file",
    description: "Annual soil analysis report from accredited lab covering pH, NPK, and organic matter.",
    status: "complete",
    evidenceIds: ["ev-001"],
    updatedAt: "2026-04-22T08:00:00Z"
  },
  {
    id: "gap-002",
    plotId: "plot-001",
    category: "water",
    code: "GAP-2.3",
    title: "Irrigation source water quality test",
    description: "Microbial and chemical test of irrigation water performed in the last 12 months.",
    status: "needs_evidence",
    evidenceIds: [],
    updatedAt: "2026-04-25T08:00:00Z"
  },
  {
    id: "gap-003",
    plotId: "plot-001",
    category: "inputs",
    code: "GAP-3.2",
    title: "Pesticide application log",
    description: "Record of pesticide name, dose, applicator, target pest, and pre-harvest interval.",
    status: "in_progress",
    evidenceIds: ["ev-002"],
    updatedAt: "2026-05-01T08:00:00Z"
  },
  {
    id: "gap-004",
    plotId: "plot-001",
    category: "worker_safety",
    code: "GAP-5.1",
    title: "PPE provisioning checklist",
    description: "Evidence that workers were provided and trained on PPE for chemical handling.",
    status: "pending",
    evidenceIds: [],
    updatedAt: "2026-05-03T08:00:00Z"
  },
  {
    id: "gap-005",
    plotId: "plot-001",
    category: "harvest",
    code: "GAP-6.4",
    title: "Harvest hygiene SOP signed",
    description: "Field harvest hygiene SOP signed by the farm manager for the current cycle.",
    status: "pending",
    evidenceIds: [],
    updatedAt: "2026-05-04T08:00:00Z"
  },
  {
    id: "gap-006",
    plotId: "plot-001",
    category: "records",
    code: "GAP-7.1",
    title: "Traceability records up to date",
    description: "Lot-to-plot mapping captured for the most recent harvest event.",
    status: "complete",
    evidenceIds: ["ev-003"],
    updatedAt: "2026-04-28T08:00:00Z"
  },
  {
    id: "gap-101",
    plotId: "plot-002",
    category: "soil",
    code: "GAP-1.1",
    title: "Soil test on file",
    description: "Annual soil analysis report from accredited lab.",
    status: "pending",
    evidenceIds: [],
    updatedAt: "2026-04-20T08:00:00Z"
  }
];

export const evidence: Evidence[] = [
  {
    id: "ev-001",
    plotId: "plot-001",
    gapItemId: "gap-001",
    kind: "document",
    filename: "soil-test-2026-q1.pdf",
    sizeBytes: 412_000,
    capturedAt: "2026-03-12T03:10:00Z",
    state: "uploaded",
    note: "Lab report from Chiang Mai Agri Lab"
  },
  {
    id: "ev-002",
    plotId: "plot-001",
    gapItemId: "gap-003",
    kind: "image",
    filename: "spray-log-photo.jpg",
    sizeBytes: 1_980_000,
    capturedAt: "2026-04-30T01:24:00Z",
    state: "uploaded",
    note: "Sprayer mix tank label"
  },
  {
    id: "ev-003",
    plotId: "plot-001",
    gapItemId: "gap-006",
    kind: "document",
    filename: "harvest-lot-map.csv",
    sizeBytes: 22_500,
    capturedAt: "2026-04-27T05:00:00Z",
    state: "uploaded"
  },
  {
    id: "ev-004",
    plotId: "plot-001",
    kind: "video",
    filename: "field-walkthrough.mp4",
    sizeBytes: 38_400_000,
    capturedAt: "2026-05-02T07:45:00Z",
    state: "uploading"
  }
];

export const reviews: Review[] = [
  {
    id: "rev-001",
    plotId: "plot-001",
    gapItemId: "gap-003",
    status: "changes_requested",
    assignedAdvisorName: "Dr. Anya Wattana",
    submittedAt: "2026-05-01T09:00:00Z",
    updatedAt: "2026-05-04T02:11:00Z",
    comments: [
      {
        id: "cm-001",
        reviewId: "rev-001",
        authorName: "Dr. Anya Wattana",
        authorRole: "advisor",
        body: "Photo is clear, but I need the dose rate per hectare and a copy of the product label.",
        createdAt: "2026-05-04T02:11:00Z",
        source: "thread_comment"
      }
    ]
  },
  {
    id: "rev-002",
    plotId: "plot-001",
    gapItemId: "gap-002",
    status: "awaiting_review",
    assignedAdvisorName: "Dr. Anya Wattana",
    submittedAt: "2026-05-04T08:00:00Z",
    updatedAt: "2026-05-04T08:00:00Z",
    comments: []
  },
  {
    id: "rev-003",
    plotId: "plot-001",
    gapItemId: "gap-001",
    status: "approved",
    assignedAdvisorName: "Dr. Anya Wattana",
    submittedAt: "2026-04-22T08:30:00Z",
    updatedAt: "2026-04-23T01:00:00Z",
    comments: [
      {
        id: "cm-010",
        reviewId: "rev-003",
        authorName: "Dr. Anya Wattana",
        authorRole: "advisor",
        body: "Lab report meets GAP 1.1 evidence requirements. Approved.",
        createdAt: "2026-04-23T01:00:00Z",
        source: "thread_comment"
      }
    ]
  }
];
