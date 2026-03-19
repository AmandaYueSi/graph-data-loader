import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Approval,
  CheckCircle,
  CompareArrows,
  Dangerous,
  Edit,
  FactCheck,
  FilterList,
  Search,
} from "@mui/icons-material";
import { DataGrid, GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { entitlementMetadata, loggedInOwner, roleCandidates as seedCandidates } from "./mockData";
import {
  BusinessOwner,
  BusinessOwnerApiProfile,
  EntitlementMeta,
  PagedResponse,
  ReviewStatus,
  RoleCandidate,
  RoleCandidateApi,
} from "./types";

const statusColors: Record<ReviewStatus, "default" | "success" | "error" | "warning" | "info"> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "error",
  Draft: "default",
  "Needs Review": "info",
};

const tabs = ["Candidate Roles", "Entitlements"];
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
    description: "Metadata not yet loaded for this entitlement. Displaying the raw entitlement value from role_candidates_v1.json.",
    sensitive: false,
    risk: "Medium",
  };
}

function groupEntitlements(entitlementIds: string[]) {
  return entitlementIds.reduce<Record<string, EntitlementMeta[]>>((acc, id) => {
    const meta = getEntitlementMeta(id);
    const key = meta?.application ?? "Unknown";
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
    notes: apiCandidate.review_metadata?.comment ?? apiCandidate.review_metadata?.reason ?? undefined,
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
      candidate.role_candidate_id.toLowerCase().includes(filters.search.toLowerCase()) ||
      candidate.entitlement_set.some((entitlement) =>
        getEntitlementMeta(entitlement).displayName.toLowerCase().includes(filters.search.toLowerCase()),
      );
    const matchesStatus = filters.statusFilter === "All" || candidate.status === filters.statusFilter;
    const matchesDepartment =
      filters.departmentFilter === "All" || candidate.dominant_department === filters.departmentFilter;
    const matchesLocation =
      filters.locationFilter === "All" || candidate.dominant_location === filters.locationFilter;
    const matchesType = filters.typeFilter === "All" || candidate.candidate_type === filters.typeFilter;
    return matchesSearch && matchesStatus && matchesDepartment && matchesLocation && matchesType;
  });
}

function toApiStatus(status: ReviewStatus | "All") {
  if (status === "All") {
    return "";
  }
  return status.toUpperCase().replace(/\s+/g, "_");
}

export default function App() {
  const [owner, setOwner] = useState<BusinessOwner>(loggedInOwner);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerError, setOwnerError] = useState<string>("");
  const [candidates, setCandidates] = useState<RoleCandidate[]>(seedCandidates);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidatesError, setCandidatesError] = useState("");
  const [totalCandidates, setTotalCandidates] = useState(seedCandidates.length);
  const [selectedId, setSelectedId] = useState<string>(seedCandidates[0]?.role_candidate_id ?? "");
  const [tabIndex, setTabIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "All">("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [locationFilter, setLocationFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 8 });
  const [compareTarget, setCompareTarget] = useState<RoleCandidate | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

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

        const nextOwner: BusinessOwner = {
          ownerId: data.business_owner_id,
          name: data.name,
          title: data.title,
          department: data.department,
          domain: data.domain || loggedInOwner.domain,
          businessResponsibility: data.business_responsibility,
        };
        setOwner(nextOwner);
        setOwnerError("");
      } catch (error) {
        if (ignore) {
          return;
        }
        setOwner(loggedInOwner);
        setOwnerError(error instanceof Error ? error.message : "Failed to load business owner profile.");
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
    setPaginationModel((current) => ({ ...current, page: 0 }));
  }, [search, statusFilter, departmentFilter, locationFilter, typeFilter]);

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

        const response = await fetch(`${API_BASE_URL}/api/role-candidates?${params.toString()}`, {
          headers: {
            "X-User-Id": loggedInOwner.ownerId,
          },
        });
        if (!response.ok) {
          throw new Error(`Role candidates request failed with status ${response.status}`);
        }

        const data: PagedResponse<RoleCandidateApi> = await response.json();
        if (ignore) {
          return;
        }

        const nextCandidates = data.content.map(mapRoleCandidate);
        setCandidates(nextCandidates);
        setTotalCandidates(data.total_elements);
        setCandidatesError("");
        setSelectedId((current) => {
          if (nextCandidates.some((candidate) => candidate.role_candidate_id === current)) {
            return current;
          }
          return nextCandidates[0]?.role_candidate_id ?? "";
        });
      } catch (error) {
        if (ignore) {
          return;
        }
        const locallyFiltered = filterLocalCandidates(seedCandidates, {
          search,
          statusFilter,
          departmentFilter,
          locationFilter,
          typeFilter,
        });
        const fromIndex = paginationModel.page * paginationModel.pageSize;
        const toIndex = fromIndex + paginationModel.pageSize;
        const paged = locallyFiltered.slice(fromIndex, toIndex);
        setCandidates(paged);
        setTotalCandidates(locallyFiltered.length);
        setCandidatesError(error instanceof Error ? error.message : "Failed to load role candidates.");
        setSelectedId((current) => {
          if (paged.some((candidate) => candidate.role_candidate_id === current)) {
            return current;
          }
          return paged[0]?.role_candidate_id ?? "";
        });
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
  }, [departmentFilter, locationFilter, paginationModel.page, paginationModel.pageSize, search, statusFilter, typeFilter]);

  const selectedCandidate = candidates.find((candidate) => candidate.role_candidate_id === selectedId) ?? null;

  const departments = useMemo(
    () => ["All", ...new Set(candidates.map((candidate) => candidate.dominant_department))],
    [candidates],
  );
  const locations = useMemo(
    () => ["All", ...new Set(candidates.map((candidate) => candidate.dominant_location))],
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
        roles: candidates.filter((candidate) => candidate.entitlement_set.includes(entitlementId)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  const summary = useMemo(() => {
    const totalEntitlements = new Set(candidates.flatMap((candidate) => candidate.entitlement_set)).size;
    const pending = candidates.filter((candidate) => candidate.status === "Pending" || candidate.status === "Needs Review").length;
    const approved = candidates.filter((candidate) => candidate.status === "Approved").length;
    const rejected = candidates.filter((candidate) => candidate.status === "Rejected").length;
    return { totalEntitlements, pending, approved, rejected, totalRoles: totalCandidates };
  }, [candidates, totalCandidates]);

  const updateCandidate = (candidateId: string, updater: (candidate: RoleCandidate) => RoleCandidate) => {
    setCandidates((current) => current.map((candidate) => (candidate.role_candidate_id === candidateId ? updater(candidate) : candidate)));
  };

  const handleStatusChange = (status: ReviewStatus) => {
    if (!selectedCandidate) {
      return;
    }
    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({ ...candidate, status }));
  };

  const handleEntitlementRemove = (entitlementId: string) => {
    if (!selectedCandidate) {
      return;
    }
    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      entitlement_set: candidate.entitlement_set.filter((item) => item !== entitlementId),
      status: candidate.status === "Approved" ? "Needs Review" : candidate.status,
    }));
  };

  const handleEntitlementAdd = (entitlementId: string | null) => {
    if (!selectedCandidate || !entitlementId || selectedCandidate.entitlement_set.includes(entitlementId)) {
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
    const merged = [...new Set([...selectedCandidate.entitlement_set, ...compareTarget.entitlement_set])];
    updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
      ...candidate,
      entitlement_set: merged,
      role_name: `${candidate.role_name} + ${compareTarget.role_name}`,
      status: "Draft",
      notes: "Merged for analyst review. Validate overlap before approval.",
    }));
    setCompareOpen(false);
  };

  const columns: GridColDef<RoleCandidate>[] = [
    { field: "role_name", headerName: "Role Name", flex: 1.4, minWidth: 220 },
    { field: "role_candidate_id", headerName: "Candidate ID", flex: 1, minWidth: 180 },
    {
      field: "support_score",
      headerName: "Support",
      width: 120,
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
    { field: "user_count", headerName: "Users", width: 90 },
    { field: "cohort_scope", headerName: "Cohort Scope", flex: 1, minWidth: 180 },
    { field: "candidate_type", headerName: "Type", width: 100 },
    { field: "dominant_department", headerName: "Department", width: 150 },
    { field: "dominant_job_title", headerName: "Job Title", flex: 1, minWidth: 180 },
    { field: "dominant_location", headerName: "Location", width: 130 },
    {
      field: "status",
      headerName: "Status",
      width: 140,
      renderCell: ({ value }) => <Chip label={value as string} color={statusColors[value as ReviewStatus]} size="small" />,
    },
  ];

  return (
    <Box sx={{ minHeight: "100vh", p: { xs: 2, lg: 3 } }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          borderRadius: 6,
          bgcolor: "rgba(12, 44, 54, 0.92)",
          backgroundImage: "linear-gradient(135deg, rgba(15,76,92,0.94), rgba(7,40,50,0.94))",
          px: 3,
          py: 2,
          mb: 3,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.75)" }}>
              ROLE MINING ANALYST VIEW
            </Typography>
            <Typography variant="h4" color="white" sx={{ mt: 0.5 }}>
              Business Owner Review Workspace
            </Typography>
            <Typography color="rgba(255,255,255,0.78)" sx={{ mt: 0.75 }}>
              Review scoped IAM role candidates, validate entitlement relationships, and promote clean bundles into business roles.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 56, height: 56, bgcolor: "secondary.main", color: "#fff4e4" }}>
              {owner.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
            </Avatar>
            <Box>
              <Typography color="white" fontWeight={700}>
                {ownerLoading ? "Loading profile..." : owner.name}
              </Typography>
              <Typography color="rgba(255,255,255,0.78)">{owner.title}</Typography>
              <Typography color="rgba(255,255,255,0.6)" variant="body2">
                {owner.department} • {owner.domain}
              </Typography>
              {owner.businessResponsibility && (
                <Typography color="rgba(255,255,255,0.55)" variant="body2">
                  {owner.businessResponsibility}
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </AppBar>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper sx={{ p: 2.5, position: "sticky", top: 20, border: "1px solid rgba(15,76,92,0.08)" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <FilterList color="primary" />
              <Typography variant="h6">Review Filters</Typography>
            </Stack>

            <Stack spacing={2}>
              <TextField
                label="Search roles or entitlements"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ReviewStatus | "All")}
              >
                {["All", "Pending", "Approved", "Rejected", "Draft", "Needs Review"].map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Department"
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                {departments.map((department) => (
                  <MenuItem key={department} value={department}>
                    {department}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Location"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                {locations.map((location) => (
                  <MenuItem key={location} value={location}>
                    {location}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Candidate Type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {["All", "global", "cohort"].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>

              <Alert severity="info" variant="outlined">
                Only candidates aligned to {owner.domain} ownership scope are visible in this workspace.
              </Alert>
              {ownerError && (
                <Alert severity="warning" variant="outlined">
                  Could not load `{API_BASE_URL}/api/me`. Showing fallback owner profile. {ownerError}
                </Alert>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 9 }}>
          <Grid container spacing={2}>
            {[
              { label: "Owned Entitlements", value: summary.totalEntitlements, tone: "#0f4c5c" },
              { label: "Proposed Roles", value: summary.totalRoles, tone: "#d17a22" },
              { label: "Pending Review", value: summary.pending, tone: "#b7791f" },
              { label: "Approved / Rejected", value: `${summary.approved} / ${summary.rejected}`, tone: "#2f7d4b" },
            ].map((card) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Card sx={{ border: "1px solid rgba(16,42,51,0.08)", background: "linear-gradient(160deg, #fffdf8, #f3eee4)" }}>
                  <CardContent>
                    <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: "0.12em" }}>
                      {card.label}
                    </Typography>
                    <Typography variant="h4" sx={{ color: card.tone, mt: 1 }}>
                      {card.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ mt: 3, p: 1.5, border: "1px solid rgba(15,76,92,0.08)" }}>
            <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)} variant="scrollable">
              {tabs.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>
          </Paper>

          {tabIndex === 0 && (
            <Paper sx={{ mt: 2, p: 1.5, border: "1px solid rgba(15,76,92,0.08)" }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ p: 1.5 }}>
                <Box>
                  <Typography variant="h6">Candidate Role Backlog</Typography>
                  <Typography color="text.secondary">
                    Sorted for analyst triage. Click a row to open review detail and workflow actions.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {candidatesLoading && <Chip label="Loading candidates..." color="info" variant="outlined" />}
                  <Chip label={`${totalCandidates} matching candidates`} color="primary" variant="outlined" />
                  <Chip label={`${summary.pending} pending review`} color="warning" variant="outlined" />
                </Stack>
              </Stack>
              {candidatesError && (
                <Alert severity="warning" sx={{ mx: 1.5, mb: 1 }}>
                  Could not load candidates from `role_candidates_v1.json` via backend. Showing fallback mock data. {candidatesError}
                </Alert>
              )}
              <Box sx={{ height: 620 }}>
                <DataGrid
                  rows={candidates}
                  columns={columns}
                  getRowId={(row) => row.role_candidate_id}
                  disableRowSelectionOnClick
                  loading={candidatesLoading}
                  onRowClick={(params) => setSelectedId(params.row.role_candidate_id)}
                  paginationMode="server"
                  hideFooterPagination
                  rowCount={totalCandidates}
                  paginationModel={paginationModel}
                  onPaginationModelChange={setPaginationModel}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: "support_score", sort: "desc" }],
                    },
                  }}
                  pageSizeOptions={[8, 16, 25]}
                  sx={{
                    border: 0,
                    "& .MuiDataGrid-row:hover": {
                      cursor: "pointer",
                      backgroundColor: "rgba(15,76,92,0.04)",
                    },
                  }}
                />
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <TablePagination
                component="div"
                count={totalCandidates}
                page={paginationModel.page}
                onPageChange={(_, page) => setPaginationModel((current) => ({ ...current, page }))}
                rowsPerPage={paginationModel.pageSize}
                onRowsPerPageChange={(event) =>
                  setPaginationModel({
                    page: 0,
                    pageSize: Number(event.target.value),
                  })
                }
                rowsPerPageOptions={[8, 16, 25]}
              />
            </Paper>
          )}

          {tabIndex === 1 && (
            <Paper sx={{ mt: 2, p: 2.5, border: "1px solid rgba(15,76,92,0.08)" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Entitlement-Centric Review</Typography>
                  <Typography color="text.secondary">
                    Browse entitlements first to see where they appear across role candidates and how sensitive they are.
                  </Typography>
                </Box>
                <Chip label={`${entitlementStats.length} scoped entitlements`} color="secondary" />
              </Stack>
              <Grid container spacing={2}>
                {entitlementStats.map(({ entitlementId, count, meta, roles }) => (
                  <Grid key={entitlementId} size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: "100%", border: "1px solid rgba(16,42,51,0.08)" }}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Box>
                            <Typography variant="h6">{meta.displayName}</Typography>
                            <Typography color="text.secondary">
                              {meta.application} • {meta.sourceSystem}
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end">
                            <Chip size="small" label={`${count} roles`} color="primary" variant="outlined" />
                            <Chip
                              size="small"
                              sx={{ mt: 1 }}
                              label={meta.sensitive ? `Sensitive • ${meta.risk}` : meta.risk}
                              color={meta.risk === "High" ? "error" : meta.risk === "Medium" ? "warning" : "success"}
                            />
                          </Stack>
                        </Stack>
                        <Typography sx={{ mt: 1.5, mb: 2 }} color="text.secondary">
                          {meta.description}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {roles.map((role) => (
                            <Chip
                              key={role.role_candidate_id}
                              label={role.role_name}
                              onClick={() => {
                                setSelectedId(role.role_candidate_id);
                                setTabIndex(0);
                              }}
                            />
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

        </Grid>
      </Grid>

      {selectedCandidate && (
        <Drawer
          anchor="right"
          open={Boolean(selectedId && selectedCandidate)}
          onClose={() => setSelectedId("")}
          variant="persistent"
          sx={{
            "& .MuiDrawer-paper": {
              width: { xs: "100%", md: 460 },
              p: 2.5,
              background: "#fffdf8",
              borderLeft: "1px solid rgba(15,76,92,0.08)",
            },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">Candidate Detail</Typography>
            <Chip label={selectedCandidate.status} color={statusColors[selectedCandidate.status]} />
          </Stack>

          <TextField
            label="Role Name"
            value={selectedCandidate.role_name}
            onChange={(event) =>
              updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
                ...candidate,
                role_name: event.target.value,
                status: candidate.status === "Approved" ? "Needs Review" : candidate.status,
              }))
            }
            sx={{ mt: 2 }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Chip label={selectedCandidate.role_candidate_id} variant="outlined" />
            <Chip label={selectedCandidate.candidate_type} variant="outlined" />
            <Chip label={selectedCandidate.cohort_scope} variant="outlined" />
          </Stack>

          <Grid container spacing={1.5} sx={{ mt: 2 }}>
            {[
              { label: "Support", value: formatPercent(selectedCandidate.support_score) },
              { label: "Users", value: selectedCandidate.user_count },
              { label: "Confidence", value: selectedCandidate.rule_confidence },
              { label: "Lift", value: selectedCandidate.rule_lift },
            ].map((item) => (
              <Grid key={item.label} size={6}>
                <Paper sx={{ p: 1.5, borderRadius: 4, border: "1px solid rgba(16,42,51,0.08)" }}>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h6">{item.value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="subtitle1" fontWeight={700}>
            Business Context
          </Typography>
          <List dense>
            <ListItem disableGutters>
              <ListItemText primary="Department" secondary={selectedCandidate.dominant_department} />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Job Title" secondary={selectedCandidate.dominant_job_title} />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Location" secondary={selectedCandidate.dominant_location} />
            </ListItem>
          </List>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="subtitle1" fontWeight={700}>
            Entitlements
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {Object.entries(groupEntitlements(selectedCandidate.entitlement_set)).map(([application, items]) => (
              <Paper key={application} sx={{ p: 1.5, borderRadius: 4, border: "1px solid rgba(16,42,51,0.08)" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={700}>{application}</Typography>
                  <Badge badgeContent={items.length} color="primary" />
                </Stack>
                <Stack spacing={1} sx={{ mt: 1.25 }}>
                  {items.map((item) => (
                    <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {item.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.sourceSystem} • {item.risk} risk
                        </Typography>
                      </Box>
                      <Tooltip title="Remove entitlement from candidate">
                        <IconButton size="small" onClick={() => handleEntitlementRemove(item.id)}>
                          <Dangerous fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Autocomplete
            sx={{ mt: 2 }}
            options={Object.values(entitlementMetadata)
              .filter((item) => !selectedCandidate.entitlement_set.includes(item.id))
              .map((item) => item.id)}
            getOptionLabel={(option) => entitlementMetadata[option].displayName}
            onChange={(_, value) => handleEntitlementAdd(value)}
            renderInput={(params) => <TextField {...params} label="Add entitlement" />}
          />

          <TextField
            multiline
            minRows={3}
            sx={{ mt: 2 }}
            label="Analyst Notes"
            value={selectedCandidate.notes ?? ""}
            onChange={(event) =>
              updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
                ...candidate,
                notes: event.target.value,
              }))
            }
          />

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="subtitle1" fontWeight={700}>
            Analyst Actions
          </Typography>
          <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
            <Grid size={6}>
              <Button fullWidth variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => handleStatusChange("Approved")}>
                Approve
              </Button>
            </Grid>
            <Grid size={6}>
              <Button fullWidth variant="contained" color="error" startIcon={<Dangerous />} onClick={() => handleStatusChange("Rejected")}>
                Reject
              </Button>
            </Grid>
            <Grid size={6}>
              <Button fullWidth variant="outlined" startIcon={<Edit />} onClick={() => handleStatusChange("Draft")}>
                Save Draft
              </Button>
            </Grid>
            <Grid size={6}>
              <Button fullWidth variant="outlined" startIcon={<FactCheck />} onClick={() => handleStatusChange("Needs Review")}>
                Needs Review
              </Button>
            </Grid>
            <Grid size={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CompareArrows />}
                onClick={() => setCompareOpen(true)}
              >
                Compare / Merge Candidate
              </Button>
            </Grid>
            <Grid size={12}>
              <Button fullWidth variant="contained" color="secondary" startIcon={<Approval />}>
                Export Reviewed Roles
              </Button>
            </Grid>
          </Grid>
        </Drawer>
      )}

      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Compare Two Candidate Roles</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={candidates.filter(
                (candidate) => candidate.role_candidate_id !== selectedCandidate?.role_candidate_id,
              )}
              getOptionLabel={(option) => `${option.role_name} (${option.role_candidate_id})`}
              onChange={(_, value) => setCompareTarget(value)}
              renderInput={(params) => <TextField {...params} label="Compare with candidate" />}
            />

            {compareTarget && selectedCandidate && (
              <Grid container spacing={2}>
                {[selectedCandidate, compareTarget].map((candidate) => (
                  <Grid key={candidate.role_candidate_id} size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, border: "1px solid rgba(16,42,51,0.08)" }}>
                      <Typography variant="h6">{candidate.role_name}</Typography>
                      <Typography color="text.secondary">{candidate.role_candidate_id}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip label={`${candidate.user_count} users`} size="small" />
                        <Chip label={formatPercent(candidate.support_score)} size="small" />
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                        {candidate.entitlement_set.map((id) => (
                          <Chip key={id} label={getEntitlementMeta(id).displayName} />
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleMerge} disabled={!compareTarget}>
            Merge into Active Candidate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
