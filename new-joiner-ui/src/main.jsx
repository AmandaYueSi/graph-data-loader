import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import App from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#17313e',
    },
    secondary: {
      main: '#d4a64f',
    },
    background: {
      default: '#f5efe6',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Manrope", sans-serif',
    h5: {
      fontWeight: 800,
    },
    h6: {
      fontWeight: 800,
    },
    subtitle1: {
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 16,
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            minWidth: 320,
          },
        }}
      />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
