import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  CheckCircle,
  LocationOn,
  Person,
  WorkOutline,
} from '@mui/icons-material';

const newJoiner = {
  name: 'Ava Thompson',
  location: 'Dublin, Ireland',
  role: 'Security Analyst',
  department: 'Identity & Access Management',
  manager: 'Priya Menon',
};

const similarColleagues = [
  {
    id: 'COL-102',
    role: 'Security Analyst',
    location: 'Dublin, Ireland',
    team: 'Identity & Access Management',
    reason: 'Same role and department, same manager chain',
  },
  {
    id: 'COL-318',
    role: 'IAM Analyst',
    location: 'Cork, Ireland',
    team: 'Identity & Access Management',
    reason: 'Similar access pattern and shared team function',
  },
  {
    id: 'COL-411',
    role: 'Security Operations Analyst',
    location: 'Dublin, Ireland',
    team: 'Cyber Operations',
    reason: 'Same location and overlapping access responsibilities',
  },
];

const recommendedPackages = [
  {
    id: 'cluster_7',
    name: 'Core IAM Analyst Package',
    score: 0.92,
    description: 'Daily access for identity review, request handling, and audit preparation.',
    why: 'Most common package among analysts reporting into the same IAM team.',
    entitlements: [
      'Access Review Console',
      'Identity Governance Dashboard',
      'Role Mining Viewer',
      'Request Approval Queue',
      'Audit Evidence Export',
      'Directory Read Access',
    ],
  },
  {
    id: 'cluster_15',
    name: 'Security Investigation Package',
    score: 0.84,
    description: 'Tools used for access investigation and incident triage.',
    why: 'Frequently assigned to colleagues with similar security operations work.',
    entitlements: [
      'Incident Triage Portal',
      'Security Case Workspace',
      'Privileged Access Viewer',
      'Directory Read Access',
      'Log Search Console',
      'Access Review Console',
    ],
  },
  {
    id: 'cluster_2',
    name: 'Joiner-Mover-Leaver Package',
    score: 0.79,
    description: 'Operational access for onboarding, transfer, and offboarding workflows.',
    why: 'Common among team members who support access lifecycle tasks.',
    entitlements: [
      'JML Operations Queue',
      'HR Feed Viewer',
      'Identity Governance Dashboard',
      'Request Approval Queue',
      'Entitlement Catalog Viewer',
      'Workflow Exception Manager',
    ],
  },
];

const not = (a, b) => a.filter((value) => !b.includes(value));
const intersection = (a, b) => a.filter((value) => b.includes(value));
const union = (a, b) => [...a, ...not(b, a)];

function TransferListCard({ title, items, checked, onToggle, accent }) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: '#fffdf8',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: accent,
        }}
      >
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {items.length} items
        </Typography>
      </Box>
      <List
        dense
        sx={{
          width: '100%',
          minHeight: 280,
          maxHeight: 320,
          overflow: 'auto',
          p: 1,
        }}
      >
        {items.map((value) => {
          const labelId = `transfer-list-item-${value}-label`;
          return (
            <ListItemButton
              key={value}
              role="listitem"
              onClick={onToggle(value)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
              }}
            >
              <ListItemIcon>
                <Checkbox
                  checked={checked.includes(value)}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': labelId }}
                />
              </ListItemIcon>
              <ListItemText id={labelId} primary={value} />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}

export default function App() {
  const [selectedPackageId, setSelectedPackageId] = React.useState(recommendedPackages[0].id);
  const [checked, setChecked] = React.useState([]);
  const [selectedEntitlements, setSelectedEntitlements] = React.useState([
    'Access Review Console',
    'Identity Governance Dashboard',
  ]);
  const [submitted, setSubmitted] = React.useState(null);

  const selectedPackage =
    recommendedPackages.find((pkg) => pkg.id === selectedPackageId) || recommendedPackages[0];

  const availableEntitlements = React.useMemo(
    () => not(selectedPackage.entitlements, selectedEntitlements),
    [selectedPackage, selectedEntitlements]
  );

  const leftChecked = intersection(checked, availableEntitlements);
  const rightChecked = intersection(checked, selectedEntitlements);

  const handleToggle = (value) => () => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleAllRight = () => {
    setSelectedEntitlements((prev) => union(prev, availableEntitlements));
    setChecked((prev) => not(prev, availableEntitlements));
  };

  const handleCheckedRight = () => {
    setSelectedEntitlements((prev) => union(prev, leftChecked));
    setChecked((prev) => not(prev, leftChecked));
  };

  const handleCheckedLeft = () => {
    setSelectedEntitlements((prev) => not(prev, rightChecked));
    setChecked((prev) => not(prev, rightChecked));
  };

  const handleAllLeft = () => {
    setSelectedEntitlements([]);
    setChecked((prev) => not(prev, selectedEntitlements));
  };

  const handlePackageSelect = (pkg) => {
    setSelectedPackageId(pkg.id);
    setChecked([]);
    setSubmitted(null);
  };

  const handleConfirm = () => {
    const payload = {
      joiner: newJoiner.name,
      package: selectedPackage.name,
      entitlements: selectedEntitlements,
    };
    console.log('Confirmed entitlements:', payload);
    setSubmitted(payload);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f5efe6',
        backgroundImage:
          'radial-gradient(circle at top left, rgba(223,174,96,0.18), transparent 28%), linear-gradient(180deg, #fbf7f1 0%, #f4ede3 100%)',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box
            sx={{
              px: { xs: 3, md: 5 },
              py: { xs: 3, md: 4 },
              background:
                'linear-gradient(135deg, #17313e 0%, #285b63 55%, #d4a64f 120%)',
              color: 'white',
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: 28, md: 40 },
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              New Joiner Entitlement Recommendation
            </Typography>
            <Typography sx={{ mt: 1.5, maxWidth: 780, color: 'rgba(255,255,255,0.82)' }}>
              Review colleague-based recommendations, preview the top entitlement packages,
              and confirm the access set for this new joiner.
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 } }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 3,
                    background:
                      'linear-gradient(180deg, rgba(255,248,235,0.9) 0%, rgba(255,255,255,1) 100%)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={3}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        sx={{
                          width: 64,
                          height: 64,
                          bgcolor: '#17313e',
                          fontSize: 28,
                          fontWeight: 700,
                        }}
                      >
                        {newJoiner.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </Avatar>
                      <Box>
                        <Typography variant="h5">{newJoiner.name}</Typography>
                        <Typography variant="body1" color="text.secondary">
                          Recommendations are based on role, team, manager, and location.
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip icon={<WorkOutline />} label={newJoiner.role} />
                      <Chip icon={<LocationOn />} label={newJoiner.location} />
                      <Chip label={newJoiner.department} />
                      {newJoiner.manager && <Chip icon={<Person />} label={`Manager: ${newJoiner.manager}`} />}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Similar Colleagues
                </Typography>
                <Grid container spacing={2}>
                  {similarColleagues.map((colleague) => (
                    <Grid item xs={12} key={colleague.id}>
                      <Card
                        sx={{
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          boxShadow: 'none',
                        }}
                      >
                        <CardContent>
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle1">
                              {colleague.id}
                            </Typography>
                            <Chip size="small" label={colleague.team} />
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {colleague.role}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {colleague.location}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {colleague.reason}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              <Grid item xs={12} lg={8}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Recommended Packages
                </Typography>
                <Grid container spacing={2}>
                  {recommendedPackages.map((pkg) => {
                    const active = pkg.id === selectedPackageId;
                    return (
                      <Grid item xs={12} md={4} key={pkg.id}>
                        <Card
                          onClick={() => handlePackageSelect(pkg)}
                          sx={{
                            height: '100%',
                            cursor: 'pointer',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: active ? '#d4a64f' : 'divider',
                            boxShadow: active
                              ? '0 10px 28px rgba(212,166,79,0.22)'
                              : 'none',
                            bgcolor: active ? '#fffaf0' : 'white',
                            transition: 'all 180ms ease',
                            '&:hover': {
                              transform: 'translateY(-3px)',
                              boxShadow: '0 12px 26px rgba(23,49,62,0.12)',
                            },
                          }}
                        >
                          <CardContent>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1.5 }}
                            >
                              <Chip
                                label={`${Math.round(pkg.score * 100)}% match`}
                                color={active ? 'warning' : 'default'}
                                size="small"
                              />
                              {active && <CheckCircle sx={{ color: '#b88419' }} />}
                            </Stack>
                            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                              {pkg.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {pkg.description}
                            </Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                              Why recommended
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {pkg.why}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                <Paper
                  elevation={0}
                  sx={{
                    mt: 2,
                    p: 2.5,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#fffdf8',
                  }}
                >
                  <Typography variant="subtitle1">Package Preview</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Selected package: {selectedPackage.name}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {selectedPackage.entitlements.map((item) => (
                      <Chip key={item} label={item} variant="outlined" />
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Entitlement Selection
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 3 },
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'white',
                  }}
                >
                  <Grid container spacing={2} alignItems="center" justifyContent="center">
                    <Grid item xs={12} md={5}>
                      <TransferListCard
                        title="Available Entitlements"
                        items={availableEntitlements}
                        checked={checked}
                        onToggle={handleToggle}
                        accent="rgba(212,166,79,0.12)"
                      />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                        <Button
                          sx={{ minWidth: 44, borderRadius: 3 }}
                          variant="outlined"
                          onClick={handleAllRight}
                          disabled={availableEntitlements.length === 0}
                          aria-label="move all right"
                        >
                          ≫
                        </Button>
                        <Button
                          sx={{ minWidth: 44, borderRadius: 3 }}
                          variant="contained"
                          color="warning"
                          onClick={handleCheckedRight}
                          disabled={leftChecked.length === 0}
                          aria-label="move selected right"
                        >
                          <ArrowForward />
                        </Button>
                        <Button
                          sx={{ minWidth: 44, borderRadius: 3 }}
                          variant="contained"
                          color="inherit"
                          onClick={handleCheckedLeft}
                          disabled={rightChecked.length === 0}
                          aria-label="move selected left"
                        >
                          <ArrowBack />
                        </Button>
                        <Button
                          sx={{ minWidth: 44, borderRadius: 3 }}
                          variant="outlined"
                          onClick={handleAllLeft}
                          disabled={selectedEntitlements.length === 0}
                          aria-label="move all left"
                        >
                          ≪
                        </Button>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={5}>
                      <TransferListCard
                        title="Selected Entitlements"
                        items={selectedEntitlements}
                        checked={checked}
                        onToggle={handleToggle}
                        accent="rgba(23,49,62,0.08)"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#17313e',
                    color: 'white',
                  }}
                >
                  <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid item xs={12} md={8}>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Final Review
                      </Typography>
                      <Typography color="rgba(255,255,255,0.76)" sx={{ mb: 2 }}>
                        {selectedEntitlements.length} entitlements selected for {newJoiner.name}.
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {selectedEntitlements.length > 0 ? (
                          selectedEntitlements.map((item) => (
                            <Chip
                              key={item}
                              label={item}
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.12)',
                                color: 'white',
                              }}
                            />
                          ))
                        ) : (
                          <Typography color="rgba(255,255,255,0.76)">
                            No entitlements selected yet.
                          </Typography>
                        )}
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md="auto">
                      <Button
                        variant="contained"
                        size="large"
                        onClick={handleConfirm}
                        disabled={selectedEntitlements.length === 0}
                        sx={{
                          px: 4,
                          py: 1.5,
                          borderRadius: 999,
                          fontWeight: 800,
                          bgcolor: '#d4a64f',
                          color: '#1f1a10',
                          '&:hover': { bgcolor: '#e1b45d' },
                        }}
                      >
                        Confirm Selection
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {submitted && (
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: '#cfe8d7',
                      bgcolor: '#f4fbf6',
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Submission Confirmed
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      The selected entitlements have been prepared for submission.
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                      Selected package: {submitted.package}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {submitted.entitlements.map((item) => (
                        <Chip key={item} label={item} color="success" variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
