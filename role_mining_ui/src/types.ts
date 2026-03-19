export type ReviewStatus = "Pending" | "Approved" | "Rejected" | "Draft" | "Needs Review";

export type CandidateType = "global" | "cohort";

export type RiskLevel = "Low" | "Medium" | "High";

export type RoleCandidate = {
  role_candidate_id: string;
  role_name: string;
  entitlement_set: string[];
  support_score: number;
  user_count: number;
  cohort_scope: string;
  candidate_type: CandidateType;
  dominant_department: string;
  dominant_job_title: string;
  dominant_location: string;
  rule_confidence: number;
  rule_lift: number;
  status: ReviewStatus;
  domain: string;
  ownedApplications: string[];
  notes?: string;
};

export type EntitlementMeta = {
  id: string;
  displayName: string;
  application: string;
  sourceSystem: string;
  description: string;
  sensitive: boolean;
  risk: RiskLevel;
};

export type BusinessOwner = {
  ownerId: string;
  name: string;
  title: string;
  department: string;
  domain: string;
  ownedApplications: string[];
};
