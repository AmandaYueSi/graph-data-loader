import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Avatar,
  Stack,
  LinearProgress,
  Grid,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupIcon from "@mui/icons-material/Group";

interface ImpactDimension {
  department: string;
  count: number;
}

interface ImpactResult {
  id: string;
  name: string;
  type: string;
  totalUsers: number;
  topDepartments: ImpactDimension[];
  aiNarrative: string;
}

interface Props {
  API_BASE_URL: string;
}

export default function ImpactAnalysisPanel({ API_BASE_URL }: Props) {
  const [term, setTerm] = useState("");
  const [type, setType] = useState<"app" | "ent">("app");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImpactResult[]>([]);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!term.trim()) {
      setError("Please enter a search term.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/impact/analyze?term=${encodeURIComponent(term)}&type=${type}`
      );
      if (!response.ok) {
        throw new Error(`Impact analysis failed: ${response.statusText}`);
      }
      const data: ImpactResult[] = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Dynamic Impact Analysis (Graph-Powered)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Calculate the "blast radius" of removing access to a specific application or entitlement.
          This tool performs real-time traversal of the identity graph in Neo4j and uses Generative AI
          to explain the potential business impact.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, val) => val && setType(val)}
            size="small"
            color="primary"
          >
            <ToggleButton value="app">Application</ToggleButton>
            <ToggleButton value="ent">Entitlement</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            fullWidth
            size="small"
            placeholder={type === "app" ? "Search Application ID (e.g., AD Group, App Name)" : "Search Entitlement ID"}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <Button
            variant="contained"
            disableElevation
            startIcon={<SearchIcon />}
            onClick={handleAnalyze}
            disabled={loading}
            sx={{ px: 3 }}
          >
            Analyze
          </Button>
        </Stack>

        {loading && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress size={30} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Traversing Graph & Generating AI Narrative...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && results.length === 0 && term && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No matching {type === "app" ? "applications" : "entitlements"} found.
          </Alert>
        )}

        {results.map((result) => (
          <Card key={result.id} variant="outlined" sx={{ mb: 3, borderRadius: 2, bgcolor: "background.default" }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                      <GroupIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" lineHeight={1.2}>
                        {result.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {result.id}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="h4" fontWeight={700} color="primary">
                    {result.totalUsers.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Total Users Impacted
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Top Impacted Departments
                  </Typography>
                  {result.topDepartments.map((dept) => (
                    <Box key={dept.department} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2">{dept.department}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {dept.count}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(dept.count / result.totalUsers) * 100}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  ))}
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                  <Box
                    sx={{
                      p: 3,
                      height: "100%",
                      borderRadius: 2,
                      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                      border: "1px solid",
                      borderColor: "divider",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <Box sx={{ position: "relative", zIndex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                        <AutoAwesomeIcon sx={{ color: "primary.main", mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight={700}>
                          AI Summary & Impact Narrative
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontStyle: "italic", lineHeight: 1.6, color: "text.primary" }}>
                        "{result.aiNarrative}"
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        position: "absolute",
                        top: -20,
                        right: -20,
                        opacity: 0.05,
                        fontSize: 120,
                        color: "primary.main",
                        pointerEvents: "none",
                      }}
                    >
                      AI
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Paper>
    </Box>
  );
}
