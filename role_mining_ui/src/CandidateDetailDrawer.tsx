import {
	Drawer,
	Stack,
	Typography,
	Chip,
	TextField,
	Box,
	Grid,
	Paper,
	Divider,
	List,
	ListItem,
	ListItemText,
	Tooltip,
	IconButton,
	Autocomplete,
	Badge,
	Button,
} from "@mui/material";
import {
	Dangerous,
	Edit,
	FactCheck,
	CompareArrows,
	Approval,
	CheckCircle,
} from "@mui/icons-material";
import { RoleCandidate, EntitlementMeta, ReviewStatus } from "./types";

interface CandidateDetailDrawerProps {
	selectedCandidate: RoleCandidate;
	statusColors: Record<ReviewStatus, string>;
	updateCandidate: (
		id: string,
		updater: (c: RoleCandidate) => RoleCandidate
	) => void;
	handleStatusChange: (status: ReviewStatus) => void;
	handleEntitlementRemove: (entitlementId: string) => void;
	handleEntitlementAdd: (entitlementId: string | null) => void;
	groupEntitlements: (
		entitlementIds: string[]
	) => Record<string, EntitlementMeta[]>;
	entitlementMetadata: Record<string, EntitlementMeta>;
	setCompareOpen: (v: boolean) => void;
}

export default function CandidateDetailDrawer({
	selectedCandidate,
	statusColors,
	updateCandidate,
	handleStatusChange,
	handleEntitlementRemove,
	handleEntitlementAdd,
	groupEntitlements,
	entitlementMetadata,
	setCompareOpen,
}: CandidateDetailDrawerProps) {
	function formatPercent(value: number) {
		return `${Math.round(value * 100)}%`;
	}
	return (
		<Drawer
			anchor="right"
			open={Boolean(selectedCandidate)}
			onClose={() =>
				updateCandidate(selectedCandidate.role_candidate_id, (c) => c)
			}
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
				<Chip
					label={selectedCandidate.status}
					// color={statusColors[selectedCandidate.status]}
				/>
			</Stack>
			<TextField
				label="Role Name"
				value={selectedCandidate.role_name}
				onChange={(event) =>
					updateCandidate(selectedCandidate.role_candidate_id, (candidate) => ({
						...candidate,
						role_name: event.target.value,
						status:
							candidate.status === "Approved"
								? "Needs Review"
								: candidate.status,
					}))
				}
				sx={{ mt: 2 }}
			/>
			<Stack
				direction="row"
				spacing={1}
				flexWrap="wrap"
				useFlexGap
				sx={{ mt: 2 }}
			>
				<Chip label={selectedCandidate.role_candidate_id} variant="outlined" />
				<Chip label={selectedCandidate.candidate_type} variant="outlined" />
				<Chip label={selectedCandidate.cohort_scope} variant="outlined" />
			</Stack>
			<Grid container spacing={1.5} sx={{ mt: 2 }}>
				{[
					{
						label: "Support",
						value: formatPercent(selectedCandidate.support_score),
					},
					{ label: "Users", value: selectedCandidate.user_count },
					{ label: "Confidence", value: selectedCandidate.rule_confidence },
					{ label: "Lift", value: selectedCandidate.rule_lift },
				].map((item) => (
					<Grid key={item.label} size={6}>
						<Paper
							sx={{
								p: 1.5,
								border: "1px solid rgba(16,42,51,0.08)",
							}}
						>
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
					<ListItemText
						primary="Department"
						secondary={selectedCandidate.dominant_department}
					/>
				</ListItem>
				<ListItem disableGutters>
					<ListItemText
						primary="Job Title"
						secondary={selectedCandidate.dominant_job_title}
					/>
				</ListItem>
				<ListItem disableGutters>
					<ListItemText
						primary="Location"
						secondary={selectedCandidate.dominant_location}
					/>
				</ListItem>
			</List>
			<Divider sx={{ my: 2.5 }} />
			<Typography variant="subtitle1" fontWeight={700}>
				Entitlements
			</Typography>
			<Stack spacing={1.5} sx={{ mt: 1.5 }}>
				{Object.entries(
					groupEntitlements(selectedCandidate.entitlement_set)
				).map(([application, items]) => (
					<Paper
						key={application}
						sx={{
							p: 1.5,
							border: "1px solid rgba(16,42,51,0.08)",
						}}
					>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
						>
							<Typography fontWeight={700}>{application}</Typography>
							<Badge badgeContent={items.length} color="primary" />
						</Stack>
						<Stack spacing={1} sx={{ mt: 1.25 }}>
							{items.map((item) => (
								<Stack
									key={item.id}
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									spacing={1}
								>
									<Box>
										<Typography variant="body2" fontWeight={600}>
											{item.displayName}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{item.sourceSystem} • {item.risk} risk
										</Typography>
									</Box>
									<Tooltip title="Remove entitlement from candidate">
										<IconButton
											size="small"
											onClick={() => handleEntitlementRemove(item.id)}
										>
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
					.filter(
						(item) => !selectedCandidate.entitlement_set.includes(item.id)
					)
					.map((item) => item.id)}
				getOptionLabel={(option) => entitlementMetadata[option].displayName}
				onChange={(_, value) => handleEntitlementAdd(value)}
				renderInput={(params) => (
					<TextField {...params} label="Add entitlement" />
				)}
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
					<Button
						fullWidth
						variant="contained"
						color="success"
						startIcon={<CheckCircle />}
						onClick={() => handleStatusChange("Approved")}
					>
						Approve
					</Button>
				</Grid>
				<Grid size={6}>
					<Button
						fullWidth
						variant="contained"
						color="error"
						startIcon={<Dangerous />}
						onClick={() => handleStatusChange("Rejected")}
					>
						Reject
					</Button>
				</Grid>
				<Grid size={6}>
					<Button
						fullWidth
						variant="outlined"
						startIcon={<Edit />}
						onClick={() => handleStatusChange("Draft")}
					>
						Save Draft
					</Button>
				</Grid>
				<Grid size={6}>
					<Button
						fullWidth
						variant="outlined"
						startIcon={<FactCheck />}
						onClick={() => handleStatusChange("Needs Review")}
					>
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
					<Button
						fullWidth
						variant="contained"
						color="secondary"
						startIcon={<Approval />}
					>
						Export Reviewed Roles
					</Button>
				</Grid>
			</Grid>
		</Drawer>
	);
}
