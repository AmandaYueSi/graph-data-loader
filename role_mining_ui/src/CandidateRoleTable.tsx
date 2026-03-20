import {
	Paper,
	Stack,
	Box,
	Typography,
	Chip,
	Alert,
	Grid,
	TablePagination,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { RoleCandidate, ReviewStatus } from "./types";

interface CandidateRoleTableProps {
	candidates: RoleCandidate[];
	columns: GridColDef<RoleCandidate>[];
	candidatesLoading: boolean;
	totalCandidates: number;
	candidatesError: string;
	paginationModel: GridPaginationModel;
	setPaginationModel: (v: GridPaginationModel) => void;
	setSelectedId: (id: string) => void;
	summary: { pending: number };
}

export default function CandidateRoleTable({
	candidates,
	columns,
	candidatesLoading,
	totalCandidates,
	candidatesError,
	paginationModel,
	setPaginationModel,
	setSelectedId,
	summary,
}: CandidateRoleTableProps) {
	return (
		<Paper sx={{ mt: 2, p: 1.5, border: "1px solid rgba(15,76,92,0.08)" }}>
			<Stack
				direction={{ xs: "column", md: "row" }}
				justifyContent="space-between"
				spacing={2}
				sx={{ p: 1.5 }}
			>
				<Box>
					<Typography variant="h6">Candidate Role Backlog</Typography>
					<Typography color="text.secondary">
						Sorted for analyst triage. Click a row to open review detail and
						workflow actions.
					</Typography>
				</Box>
				<Stack direction="row" spacing={1}>
					{candidatesLoading && (
						<Chip
							label="Loading candidates..."
							color="info"
							variant="outlined"
						/>
					)}
					<Chip
						label={`${totalCandidates} matching candidates`}
						color="primary"
						variant="outlined"
					/>
					<Chip
						label={`${summary.pending} pending review`}
						color="warning"
						variant="outlined"
					/>
				</Stack>
			</Stack>
			{candidatesError && (
				<Alert severity="warning" sx={{ mx: 1.5, mb: 1 }}>
					Could not load candidates from `role_candidates_v1.json` via backend.
					Showing fallback mock data. {candidatesError}
				</Alert>
			)}
			<Box sx={{ height: 620 }}>
				<DataGrid
					rows={candidates}
					columns={columns}
					getRowId={(row: any) => row.role_candidate_id}
					disableRowSelectionOnClick
					loading={candidatesLoading}
					onRowClick={(params: any) =>
						setSelectedId(params.row.role_candidate_id)
					}
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
			<TablePagination
				component="div"
				count={totalCandidates}
				page={paginationModel.page}
				onPageChange={(_, page) =>
					setPaginationModel({ ...paginationModel, page })
				}
				rowsPerPage={paginationModel.pageSize}
				onRowsPerPageChange={(event) =>
					setPaginationModel({ page: 0, pageSize: Number(event.target.value) })
				}
				rowsPerPageOptions={[8, 16, 25]}
				sx={{ mt: -0.5, px: 1 }}
			/>
		</Paper>
	);
}
