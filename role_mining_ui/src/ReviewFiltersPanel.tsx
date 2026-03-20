import {
	Stack,
	Typography,
	TextField,
	MenuItem,
	Alert,
	InputAdornment,
	Paper,
} from "@mui/material";
import { FilterList, Search } from "@mui/icons-material";
import { BusinessOwner, ReviewStatus } from "./types";

interface ReviewFiltersPanelProps {
	search: string;
	setSearch: (v: string) => void;
	statusFilter: ReviewStatus | "All";
	setStatusFilter: (v: ReviewStatus | "All") => void;
	departmentFilter: string;
	setDepartmentFilter: (v: string) => void;
	locationFilter: string;
	setLocationFilter: (v: string) => void;
	typeFilter: string;
	setTypeFilter: (v: string) => void;
	departments: string[];
	locations: string[];
	owner: BusinessOwner;
	ownerError: string;
	API_BASE_URL: string;
}

export default function ReviewFiltersPanel({
	search,
	setSearch,
	statusFilter,
	setStatusFilter,
	departmentFilter,
	setDepartmentFilter,
	locationFilter,
	setLocationFilter,
	typeFilter,
	setTypeFilter,
	departments,
	locations,
	owner,
	ownerError,
	API_BASE_URL,
}: ReviewFiltersPanelProps) {
	return (
		<Paper
			sx={{
				p: 2.5,
				position: "sticky",
				top: 20,
				border: "1px solid rgba(15,76,92,0.08)",
			}}
		>
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
					onChange={(event) =>
						setStatusFilter(event.target.value as ReviewStatus | "All")
					}
				>
					{[
						"All",
						"Pending",
						"Approved",
						"Rejected",
						"Draft",
						"Needs Review",
					].map((status) => (
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
				<TextField
					select
					label="Candidate Type"
					value={typeFilter}
					onChange={(event) => setTypeFilter(event.target.value)}
				>
					{["All", "global", "cohort"].map((option) => (
						<MenuItem key={option} value={option}>
							{option}
						</MenuItem>
					))}
				</TextField>
				<Alert severity="info" variant="outlined">
					Only candidates aligned to {owner.domain} ownership scope are visible
					in this workspace.
				</Alert>
				{ownerError && (
					<Alert severity="warning" variant="outlined">
						Could not load `{API_BASE_URL}/api/me`. Showing fallback owner
						profile. {ownerError}
					</Alert>
				)}
			</Stack>
		</Paper>
	);
}
