import { useEffect, useMemo, useState } from "react";
import { Box, Chip, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { entitlementMetadata, loggedInOwner, roleCandidates as seedCandidates } from "./mockData";
import {
  BusinessOwner,
  BusinessOwnerApiProfile,
  EntitlementApi,
  EntitlementMeta,
  PagedResponse,
  ReviewStatus,
  RoleCandidate,
  RoleCandidateApi,
} from "./types";
import OwnerProfileHeader from "./OwnerProfileHeader";
import ReviewFiltersPanel from "./ReviewFiltersPanel";
import SummaryCards from "./SummaryCards";
import TabPanelHeader from "./TabPanelHeader";
import CandidateRoleTable from "./CandidateRoleTable";
import EntitlementStatsPanel from "./EntitlementStatsPanel";
import CandidateDetailDrawer from "./CandidateDetailDrawer";
import CompareDialog from "./CompareDialog";
import ImpactAnalysisPanel from "./ImpactAnalysisPanel";

const statusColors: Record<
  ReviewStatus,
  "default" | "success" | "error" | "warning" | "info"
> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "error",
  Draft: "default",
  "Needs Review": "info",
};

const tabs = ["Candidate Roles", "Entitlements", "Impact Analysis"] as const;
const API_BASE_URL = "http://localhost:8080";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getEntitlementMeta(entitlementId: string): EntitlementMeta {
  const existing = entitlementMetadata[entitlementId];
  if (existing) {
    return existing;
  }

  return {
    id: entitlementId,
    displayName: entitlementId,
    application: "Unmapped Application",
    sourceSystem: "Role Mining JSON",
    description:
      "Metadata not yet loaded for this entitlement. Displaying the raw entitlement value from role_candidates_v1.json.",
    sensitive: false,
    risk: "Medium",
  };
}

function groupEntitlements(entitlementIds: string[]) {
  return entitlementIds.reduce<Record<string, EntitlementMeta[]>>((acc, id) => {
    const meta = getEntitlementMeta(id);
    const key = meta.application;
    acc[key] = [...(acc[key] ?? []), meta];
    return acc;
  }, {});
}

function toUiStatus(status: RoleCandidateApi["status"]): ReviewStatus {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "DRAFT":
      return "Draft";
    case "NEEDS_REVIEW":
      return "Needs Review";
    case "PENDING":
    default:
      return "Pending";
  }
}

function mapRoleCandidate(apiCandidate: RoleCandidateApi): RoleCandidate {
  const applications = [
    ...new Set(
      apiCandidate.entitlement_set
        .map((entitlementId) => getEntitlementMeta(entitlementId).application)
        .filter(Boolean),
    ),
  ] as string[];

  return {
    ...apiCandidate,
    status: toUiStatus(apiCandidate.status),
    domain: loggedInOwner.domain,
    ownedApplications: applications,
    notes:
      apiCandidate.review_metadata?.comment ??
      apiCandidate.review_metadata?.reason ??
      undefined,
  };
}

function filterLocalCandidates(
  source: RoleCandidate[],
  filters: {
    search: string;
    statusFilter: ReviewStatus | "All";
    departmentFilter: string;
    locationFilter: string;
    typeFilter: string;
  },
) {
  return source.filter((candidate) => {
    const matchesSearch =
      !filters.search ||
      candidate.role_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      candidate.role_candidate_id
        .toLowerCase()
        .includes(filters.search.toLowerCase()) ||
      candidate.entitlement_set.some((entitlement) =>
        getEntitlementMeta(entitlement)
          .displayName.toLowerCase()
          .includes(filters.search.toLowerCase()),
      );
    const matchesStatus =
      filters.statusFilter === "All" || candidate.status === filters.statusFilter;
    const matchesDepartment =
      filters.departmentFilter === "All" ||
      candidate.dominant_department === filters.departmentFilter;
    const matchesLocation =
      filters.locationFilter === "All" ||
      candidate.dominant_location === filters.locationFilter;
    const matchesType =
      filters.typeFilter === "All" ||
      candidate.candidate_type === filters.typeFilter;
    return (
      matchesSearch &&
      matchesStatus &&
      matchesDepartment &&
      matchesLocation &&
      matchesType
    );
  });
}

function toApiStatus(status: ReviewStatus | "All") {
  if (status === "All") {
    return "";
  }
  return status.toUpperCase().replace(/\s+/g, "_");
}

function getSupportBand(supportScore: number) {
  if (supportScore >= 0.15) {
    return { label: "Strong", color: "success" as const };
  }
  if (supportScore >= 0.08) {
    return { label: "Moderate", color: "warning" as const };
  }
  return { label: "Emerging", color: "default" as const };
}

export default function App() {
  const [owner, setOwner] = useState<BusinessOwner>(loggedInOwner);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerError, setOwnerError] = useState("");
  const [ownedEntitlementCount, setOwnedEntitlementCount] = useState(
    new Set(seedCandidates.flatMap((candidate) => candidate.entitlement_set)).size,
  );

  const [candidates, setCandidates] = useState<RoleCandidate[]>(seedCandidates);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidatesError, setCandidatesError] = useState("");
  const [totalCandidates, setTotalCandidates] = useState(seedCandidates.length);
  const [selectedId, setSelectedId] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "All">("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 8,
  });
  const [compareTarget, setCompareTarget] = useState<RoleCandidate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadOwnerProfile() {
      try {
        setOwnerLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/me`, {
          headers: {
            "X-User-Id": loggedInOwner.ownerId,
          },
        });
        if (!response.ok) {
          throw new Error(`Profile request failed with status ${response.status}`);
        }

        const data: BusinessOwnerApiProfile = await response.json();
        if (ignore) {
          return;
        }

        setOwner({
          ownerId: data.business_owner_id,
          name: data.name,
          title: data.title,
          department: data.department,
          domain: data.domain || loggedInOwner.domain,
          businessResponsibility: data.business_responsibility,
        });
        setOwnerError("");
      } catch (error) {
        if (!ignore) {
          setOwner(loggedInOwner);
          setOwnerError(
            error instanceof Error
              ? error.message
              : "Failed to load business owner profile.",
          );
        }
      } finally {
        if (!ignore) {
          setOwnerLoading(false);
        }
      }
    }

    loadOwnerProfile();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadOwnedEntitlements() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/entitlements`, {
          headers: {
            "X-User-Id": loggedInOwner.ownerId,
          },
        });
        if (!response.ok) {
          throw new Error(`Entitlements request failed with status ${response.status}`);
        }

        const data: EntitlementApi[] = await response.json();
        if (!ignore) {
          setOwnedEntitlementCount(data.length);
        }
      } catch {
        if (!ignore) {
          setOwnedEntitlementCount(
            new Set(seedCandidates.flatMap((candidate) => candidate.entitlement_set))
              .size,
          );
        }
      }
    }

    loadOwnedEntitlements();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setPaginationModel((current) => ({ ...current, page: 0 }));
    setSelectedId("");
  }, [search, statusFilter, departmentFilter, locationFilter, typeFilter]);

  useEffect(() => {
    setSelectedId("");
  }, [paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    let ignore = false;

    async function loadRoleCandidates() {
      try {
        setCandidatesLoading(true);

        const params = new URLSearchParams({
          page: String(paginationModel.page),
          size: String(paginationModel.pageSize),
        });
        if (statusFilter !== "All") {
          params.set("status", toApiStatus(statusFilter));
        }
        if (typeFilter !== "All") {
          params.set("candidateType", typeFilter);
        }
        if (departmentFilter !== "All") {
          params.set("department", departmentFilter);
        }
        if (locationFilter !== "All") {
          params.set("location", locationFilter);
        }
        if (search.trim()) {
          params.set("keyword", search.trim());
        }

        const response = await fetch(
          `${API_BASE_URL}/api/role-candidates?${params.toString()}`,
          {
            headers: {
              "X-User-Id": loggedInOwner.ownerId,
            },
          },
        );
        if (!response.ok) {
          throw new Error(
            `Role candidates request failed with status ${response.status}`,
          );
        }

        const data: PagedResponse<RoleCandidateApi> = await response.json();
        if (!ignore) {
          setCandidates(data.content.map(mapRoleCandidate));
          setTotalCandidates(data.total_elements);
          setCandidatesError("");
        }
      } catch (error) {
        if (!ignore) {
          const locallyFiltered = filterLocalCandidates(seedCandidates, {
            search,
            statusFilter,
            departmentFilter,
            locationFilter,
            typeFilter,
          });
          const fromIndex = paginationModel.page * paginationModel.pageSize;
          const toIndex = fromIndex + paginationModel.pageSize;
          setCandidates(locallyFiltered.slice(fromIndex, toIndex));
          setTotalCandidates(locallyFiltered.length);
          setCandidatesError(
            error instanceof Error
              ? error.message
              : "Failed to load role candidates.",
          );
        }
      } finally {
        if (!ignore) {
          setCandidatesLoading(false);
        }
      }
    }

    loadRoleCandidates();
    return () => {
      ignore = true;
    };
  }, [
    search,
    statusFilter,
    departmentFilter,
    locationFilter,
    typeFilter,
    paginationModel.page,
    paginationModel.pageSize,
  ]);

  const selectedCandidate =
    candidates.find((candidate) => candidate.role_candidate_id === selectedId) ??
    null;

  const departments = useMemo(
    () => [
      "All",
      ...new Set(candidates.map((candidate) => candidate.dominant_department)),
    ],
    [candidates],
  );

  const locations = useMemo(
    () => [
      "All",
      ...new Set(candidates.map((candidate) => candidate.dominant_location)),
    ],
    [candidates],
  );

  const entitlementStats = useMemo(() => {
    const counts = new Map<string, number>();
    candidates.forEach((candidate) => {
      candidate.entitlement_set.forEach((entitlement) => {
        counts.set(entitlement, (counts.get(entitlement) ?? 0) + 1);
      });
    });

    return [...counts.entries()]
      .map(([entitlementId, count]) => ({
        entitlementId,
        count,
        meta: getEntitlementMeta(entitlementId),
        roles: candidates.filter((candidate) =>
          candidate.entitlement_set.includes(entitlementId),
        ),
      }))
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  const summary = useMemo(() => {
    const pending = candidates.filter(
      (candidate) =>
        candidate.status === "Pending" || candidate.status === "Needs Review",
    ).length;
    const approved = candidates.filter(
      (candidate) => candidate.status === "Approved",
    ).length;
    const rejected = candidates.filter(
      (candidate) => candidate.status === "Rejected",
    ).length;

    return {
      totalEntitlements: ownedEntitlementCount,
      totalRoles: totalCandidates,
      pending,
      approved,
      rejected,
    };
  }, [candidates, ownedEntitlementCount, totalCandidates]);

  const updateCandidate = (
    candidateId: string,
    updater: (candidate: RoleCandidate) => RoleCandidate,
  ) => {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.role_candidate_id === candidateId
          ? updater(candidate)
          : candidate,
      ),
    );
  };

  const handleStatusChange = (status: ReviewStatus) => {
    if (!selectedCandidate) {
      return;
    }
    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      status,
    }));
  };

  const handleEntitlementRemove = (entitlementId: string) => {
    if (!selectedCandidate) {
      return;
    }
    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      entitlement_set: candidate.entitlement_set.filter(
        (item) => item !== entitlementId,
      ),
      status:
        candidate.status === "Approved" ? "Needs Review" : candidate.status,
    }));
  };

  const handleEntitlementAdd = (entitlementId: string | null) => {
    if (
      !selectedCandidate ||
      !entitlementId ||
      selectedCandidate.entitlement_set.includes(entitlementId)
    ) {
      return;
    }

    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      entitlement_set: [...candidate.entitlement_set, entitlementId],
      status: "Draft",
    }));
  };

  const handleMerge = () => {
    if (!selectedCandidate || !compareTarget) {
      return;
    }

    const mergedEntitlements = [
      ...new Set([
        ...selectedCandidate.entitlement_set,
        ...compareTarget.entitlement_set,
      ]),
    ];

    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      entitlement_set: mergedEntitlements,
      role_name: `${candidate.role_name} + ${compareTarget.role_name}`,
      status: "Draft",
      notes: "Merged for analyst review. Validate overlap before approval.",
    }));
    setDialogOpen(false);
  };

  const columns: GridColDef<RoleCandidate>[] = [
    { field: "role_name", headerName: "Role Name", flex: 1.4, minWidth: 220 },
    {
      field: "support_score",
      headerName: "Support",
      width: 112,
      renderCell: ({ value }) => (
        <Stack sx={{ width: "100%", pt: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {formatPercent(value as number)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(value as number) * 100}
            sx={{ height: 7, borderRadius: 999 }}
          />
        </Stack>
      ),
    },
    {
      field: "support_band",
      headerName: "Band",
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => {
        const band = getSupportBand(row.support_score);
        return (
          <Chip
            label={band.label}
            color={band.color}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    { field: "user_count", headerName: "Users", width: 88 },
    {
      field: "cohort_scope",
      headerName: "Cohort Scope",
      flex: 1,
      minWidth: 168,
    },
    { field: "candidate_type", headerName: "Type", width: 96 },
    { field: "dominant_department", headerName: "Department", width: 132 },
    {
      field: "status",
      headerName: "Status",
      width: 126,
      renderCell: ({ value }) => (
        <Chip
          label={value as string}
          color={statusColors[value as ReviewStatus]}
          size="small"
        />
      ),
    },
  ];

  return (
    <Box
      sx={{
        maxWidth: 1680,
        mx: "auto",
        px: { xs: 2, md: 3.5, xl: 5 },
        pb: 4,
      }}
    >
      <OwnerProfileHeader
        owner={owner}
        ownerLoading={ownerLoading}
        ownerError={ownerError}
        API_BASE_URL={API_BASE_URL}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 3 }}>
          <ReviewFiltersPanel
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            locationFilter={locationFilter}
            setLocationFilter={setLocationFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            departments={departments}
            locations={locations}
            owner={owner}
            ownerError={ownerError}
            API_BASE_URL={API_BASE_URL}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 9 }}>
          <SummaryCards summary={summary} />
          <TabPanelHeader
            tabIndex={tabIndex}
            setTabIndex={setTabIndex}
            tabs={tabs}
          />

          {tabIndex === 0 && (
            <CandidateRoleTable
              candidates={candidates}
              columns={columns}
              candidatesLoading={candidatesLoading}
              totalCandidates={totalCandidates}
              candidatesError={candidatesError}
              paginationModel={paginationModel}
              setPaginationModel={setPaginationModel}
              setSelectedId={setSelectedId}
              summary={summary}
            />
          )}

          {tabIndex === 1 && (
            <EntitlementStatsPanel
              entitlementStats={entitlementStats}
              setSelectedId={setSelectedId}
              setTabIndex={setTabIndex}
            />
          )}
          {tabIndex === 2 && (
            <ImpactAnalysisPanel API_BASE_URL={API_BASE_URL} />
          )}

        </Grid>
      </Grid>

      {selectedCandidate && (
        <CandidateDetailDrawer
          selectedCandidate={selectedCandidate}
          statusColors={statusColors}
          updateCandidate={updateCandidate}
          handleStatusChange={handleStatusChange}
          handleEntitlementRemove={handleEntitlementRemove}
          handleEntitlementAdd={handleEntitlementAdd}
          groupEntitlements={groupEntitlements}
          entitlementMetadata={entitlementMetadata}
          setCompareOpen={setDialogOpen}
          closeDrawer={() => setSelectedId("")}
        />
      )}

      <CompareDialog
        isOpen={dialogOpen}
        closeDialog={() => setDialogOpen(false)}
        candidates={candidates}
        selectedCandidate={selectedCandidate}
        compareTarget={compareTarget}
        setCompareTarget={setCompareTarget}
        handleMerge={handleMerge}
        formatPercent={formatPercent}
        getEntitlementMeta={getEntitlementMeta}
      />
    </Box>
  );
}
