import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import "./styles.css";

const theme = createTheme({
	palette: {
		mode: "light",
		primary: {
			main: "#0f4c5c",
		},
		secondary: {
			main: "#d17a22",
		},
		background: {
			default: "#f4f1ea",
			paper: "#fffdf8",
		},
		success: {
			main: "#2f7d4b",
		},
		warning: {
			main: "#b7791f",
		},
		error: {
			main: "#c2413b",
		},
	},
	shape: {},
	typography: {
		fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
		h3: {
			fontWeight: 700,
			letterSpacing: "-0.03em",
		},
		h5: {
			fontWeight: 700,
		},
		h6: {
			fontWeight: 700,
		},
	},
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<App />
		</ThemeProvider>
	</React.StrictMode>
);
