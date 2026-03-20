import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Stack,
	Autocomplete,
	TextField,
	Grid,
	Paper,
	Typography,
	Chip,
	Button,
	IconButton,
} from "@mui/material";
import { RoleCandidate } from "./types";

interface CompareDialogProps {
	isOpen: boolean;
	closeDialog: () => void;
	candidates: RoleCandidate[];
	selectedCandidate: RoleCandidate | null;
	compareTarget: RoleCandidate | null;
	setCompareTarget: (c: RoleCandidate | null) => void;
	handleMerge: () => void;
	formatPercent: (v: number) => string;
	getEntitlementMeta: (id: string) => { displayName: string };
}

export default function CompareDialog({
	isOpen,
	closeDialog,
	candidates,
	selectedCandidate,
	compareTarget,
	setCompareTarget,
	handleMerge,
	formatPercent,
	getEntitlementMeta,
}: CompareDialogProps) {
	return (
		<Dialog open={isOpen} onClose={() => closeDialog()}>
			<IconButton onClick={() => closeDialog()}>X</IconButton>
			<DialogTitle>Compare Two Candidate Roles</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ mt: 1 }}>
					<Autocomplete
						options={candidates.filter(
							(candidate) =>
								candidate.role_candidate_id !==
								selectedCandidate?.role_candidate_id
						)}
						getOptionLabel={(option) =>
							`${option.role_name} (${option.role_candidate_id})`
						}
						onChange={(_, value) => setCompareTarget(value)}
						renderInput={(params) => (
							<TextField {...params} label="Compare with candidate" />
						)}
					/>
					{compareTarget && selectedCandidate && (
						<Grid container spacing={2}>
							{[selectedCandidate, compareTarget].map((candidate) => (
								<Grid
									key={candidate.role_candidate_id}
									size={{ xs: 12, md: 6 }}
								>
									<Paper sx={{ p: 2, border: "1px solid rgba(16,42,51,0.08)" }}>
										<Typography variant="h6">{candidate.role_name}</Typography>
										<Typography color="text.secondary">
											{candidate.role_candidate_id}
										</Typography>
										<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
											<Chip
												label={`${candidate.user_count} users`}
												size="small"
											/>
											<Chip
												label={formatPercent(candidate.support_score)}
												size="small"
											/>
										</Stack>
										<Stack
											direction="row"
											spacing={1}
											flexWrap="wrap"
											useFlexGap
											sx={{ mt: 2 }}
										>
											{candidate.entitlement_set.map((id) => (
												<Chip
													key={id}
													label={getEntitlementMeta(id).displayName}
												/>
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
				<Button onClick={() => closeDialog()}>Cancel</Button>
				<Button
					variant="contained"
					onClick={handleMerge}
					disabled={!compareTarget}
				>
					Merge into Active Candidate
				</Button>
			</DialogActions>
		</Dialog>
	);
}
