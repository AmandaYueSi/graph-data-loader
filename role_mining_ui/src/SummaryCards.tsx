import { Grid, Card, CardContent, Typography } from "@mui/material";

interface SummaryCardsProps {
	summary: {
		totalEntitlements: number;
		totalRoles: number;
		pending: number;
		approved: number;
		rejected: number;
	};
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
	return (
		<Grid container spacing={2}>
			{[
				{
					label: "Owned Entitlements",
					value: summary.totalEntitlements,
					tone: "#0f4c5c",
				},
				{
					label: "Proposed Roles",
					value: summary.totalRoles,
					tone: "#d17a22",
				},
				{
					label: "Pending Review",
					value: summary.pending,
					tone: "#b7791f",
				},
				{
					label: "Approved / Rejected",
					value: `${summary.approved} / ${summary.rejected}`,
					tone: "#2f7d4b",
				},
			].map((card) => (
				<Grid key={card.label} size={{ xs: 12, sm: 6, xl: 3 }}>
					<Card
						sx={{
							border: "1px solid rgba(16,42,51,0.08)",
							background: "linear-gradient(160deg, #fffdf8, #f3eee4)",
						}}
					>
						<CardContent>
							<Typography
								variant="overline"
								sx={{ color: "text.secondary", letterSpacing: "0.12em" }}
							>
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
	);
}
