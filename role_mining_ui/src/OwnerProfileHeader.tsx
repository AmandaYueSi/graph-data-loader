import { AppBar, Stack, Box, Typography, Avatar, Alert } from "@mui/material";
import { BusinessOwner } from "./types";

interface OwnerProfileHeaderProps {
	owner: BusinessOwner;
	ownerLoading: boolean;
	ownerError: string;
	API_BASE_URL: string;
}

export default function OwnerProfileHeader({
	owner,
	ownerLoading,
	ownerError,
	API_BASE_URL,
}: OwnerProfileHeaderProps) {
	return (
		<AppBar
			position="static"
			elevation={0}
			sx={{
				bgcolor: "rgba(12, 44, 54, 0.92)",
				backgroundImage:
					"linear-gradient(135deg, rgba(15,76,92,0.94), rgba(7,40,50,0.94))",
				px: 3,
				py: 2,
				mb: 3,
			}}
		>
			<Stack
				direction={{ xs: "column", md: "row" }}
				spacing={2}
				justifyContent="space-between"
				alignItems={{ md: "center" }}
			>
				<Box>
					<Typography
						variant="overline"
						sx={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.75)" }}
					>
						ROLE MINING ANALYST VIEW
					</Typography>
					<Typography variant="h4" color="white" sx={{ mt: 0.5 }}>
						Business Owner Review Workspace
					</Typography>
					<Typography color="rgba(255,255,255,0.78)" sx={{ mt: 0.75 }}>
						Review scoped IAM role candidates, validate entitlement
						relationships, and promote clean bundles into business roles.
					</Typography>
				</Box>
				<Stack direction="row" spacing={2} alignItems="center">
					<Avatar
						sx={{
							width: 56,
							height: 56,
							bgcolor: "secondary.main",
							color: "#fff4e4",
						}}
					>
						{owner.name
							.split(" ")
							.map((part) => part[0])
							.join("")
							.slice(0, 2)}
					</Avatar>
					<Box>
						<Typography color="white" fontWeight={700}>
							{ownerLoading ? "Loading profile..." : owner.name}
						</Typography>
						<Typography color="rgba(255,255,255,0.78)">
							{owner.title}
						</Typography>
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
			{ownerError && (
				<Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
					Could not load `{API_BASE_URL}/api/me`. Showing fallback owner
					profile. {ownerError}
				</Alert>
			)}
		</AppBar>
	);
}
