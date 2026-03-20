import { Paper, Tabs, Tab } from "@mui/material";

interface TabPanelProps {
	tabIndex: number;
	setTabIndex: (v: number) => void;
	tabs: string[];
}

export default function TabPanelHeader({
	tabIndex,
	setTabIndex,
	tabs,
}: TabPanelProps) {
	return (
		<Paper sx={{ mt: 3, p: 1.5, border: "1px solid rgba(15,76,92,0.08)" }}>
			<Tabs
				value={tabIndex}
				onChange={(_, value) => setTabIndex(value)}
				variant="scrollable"
			>
				{tabs.map((label) => (
					<Tab key={label} label={label} />
				))}
			</Tabs>
		</Paper>
	);
}
