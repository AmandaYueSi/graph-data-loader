import {
	Paper,
	Stack,
	Box,
	Typography,
	Chip,
	Grid,
	Card,
	CardContent,
	Badge,
} from "@mui/material";
import { EntitlementMeta, RoleCandidate } from "./types";

interface EntitlementStatsPanelProps {
	entitlementStats: {
		entitlementId: string;
		count: number;
		meta: EntitlementMeta;
		roles: RoleCandidate[];
	}[];
	setSelectedId: (id: string) => void;
	setTabIndex: (v: number) => void;
}

export default function EntitlementStatsPanel({
	entitlementStats,
	setSelectedId,
	setTabIndex,
}: EntitlementStatsPanelProps) {
	return (
		<Paper sx={{ mt: 2, p: 2.5, border: "1px solid rgba(15,76,92,0.08)" }}>
			<Stack
				direction="row"
				justifyContent="space-between"
				alignItems="center"
				sx={{ mb: 2 }}
			>
				<Box>
					<Typography variant="h6">Entitlement-Centric Review</Typography>
					<Typography color="text.secondary">
						Browse entitlements first to see where they appear across role
						candidates and how sensitive they are.
					</Typography>
				</Box>
				<Chip
					label={`${entitlementStats.length} scoped entitlements`}
					color="secondary"
				/>
			</Stack>
			<Grid container spacing={2}>
				{entitlementStats.map(({ entitlementId, count, meta, roles }) => (
					<Grid key={entitlementId} size={{ xs: 12, md: 6 }}>
						<Card
							sx={{ height: "100%", border: "1px solid rgba(16,42,51,0.08)" }}
						>
							<CardContent>
								<Stack
									direction="row"
									justifyContent="space-between"
									spacing={2}
								>
									<Box>
										<Typography variant="h6">{meta.displayName}</Typography>
										<Typography color="text.secondary">
											{meta.application} • {meta.sourceSystem}
										</Typography>
									</Box>
									<Stack alignItems="flex-end">
										<Chip
											size="small"
											label={`${count} roles`}
											color="primary"
											variant="outlined"
										/>
										<Chip
											size="small"
											sx={{ mt: 1 }}
											label={
												meta.sensitive ? `Sensitive • ${meta.risk}` : meta.risk
											}
											color={
												meta.risk === "High"
													? "error"
													: meta.risk === "Medium"
													? "warning"
													: "success"
											}
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
	);
}
