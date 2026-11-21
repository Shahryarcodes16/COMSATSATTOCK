/**
 * FYP (Final Year Project) Management System - Phase 1 Types
 * Covers User Roles, Student Group Formation, and Supervisor Selection (6th Semester)
 */

export type FypRole =
  | "student"
  | "supervisor"
  | "panel_member"
  | "committee_member"
  | "coordinator"
  | "exam_dept";

export const FYP_DOMAINS = [
  "Artificial Intelligence & Machine Learning",
  "Computer Vision & Image Processing",
  "Cyber Security & Digital Forensics",
  "Cloud Computing & DevOps",
  "Internet of Things (IoT) & Embedded Systems",
  "Web & Mobile Application Engineering",
  "Data Science & Big Data Analytics",
  "Natural Language Processing (NLP)",
  "Blockchain & Distributed Systems",
  "Networks & Wireless Communications",
  "Robotics & Autonomous Systems",
  "Bioinformatics & Computational Biology",
] as const;

export type FypDomain = (typeof FYP_DOMAINS)[number];

export interface FypStudentMember {
  studentId: string;
  regNo: string; // e.g. "FA22-BCS-014"
  fullName: string;
  email: string;
  programCode: string;
  department?: string;
  isLeader?: boolean;
}

export type FypGroupStatus =
  | "draft"
  | "supervisor_pending"
  | "supervisor_accepted"
  | "locked";

export interface FypGroupRecord {
  id: string; // uuid / string
  title: string;
  domain: string;
  abstract: string;
  leader: FypStudentMember;
  members: FypStudentMember[];
  supervisorId: number | null; // teacherId from faculty directory
  supervisorName: string | null;
  status: FypGroupStatus;
  createdAt: string;
  updatedAt: string;
}

export type FypRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface FypSupervisorRequest {
  id: string;
  groupId: string;
  groupTitle: string;
  groupDomain: string;
  leaderName: string;
  leaderRegNo: string;
  leaderEmail: string;
  memberCount: number;
  teacherId: number;
  teacherName: string;
  preferenceOrder: number; // 1 = 1st choice, 2 = 2nd choice, 3 = 3rd choice
  status: FypRequestStatus;
  facultyRemark?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

export interface FypProposedIdea {
  id: string;
  title: string;
  description: string;
  tags?: string[];
}

export interface FypFacultySettings {
  teacherId: number;
  teacherName: string;
  email: string;
  department: string;
  maxSlots: number; // default 5
  acceptedCount: number;
  pendingCount: number;
  researchAreas: string[];
  availableIdeas: FypProposedIdea[];
  isAccepting: boolean;
  updatedAt?: string;
}

export interface FypSupervisorSummary {
  teacherId: number;
  teacherName: string;
  email: string;
  department: string;
  designation?: string;
  maxSlots: number;
  acceptedCount: number;
  remainingSlots: number;
  isAvailable: boolean;
  researchAreas: string[];
  availableIdeas: FypProposedIdea[];
}

/**
 * =========================================================================
 * PHASE 2: MILESTONES, MEETING LOGS & DOCUMENT MANAGEMENT
 * =========================================================================
 */

export const FYP_MILESTONE_KEYS = [
  "proposal",
  "srs",
  "design",
  "prototype",
  "progress_report",
  "final_report",
] as const;

export type FypMilestoneKey = (typeof FYP_MILESTONE_KEYS)[number];

export type FypMilestoneStatus =
  | "not_started"
  | "submitted"
  | "revision_requested"
  | "approved";

export interface FypMilestoneSubmission {
  id: string;
  version: number;
  documentUrl: string;
  fileName: string;
  changeSummary?: string;
  submittedBy: string; // student name / email
  submittedAt: string;
  plagiarismScore?: number; // e.g. 12%
  aiScore?: number; // e.g. 6%
  similarityStatus?: "passed" | "flagged" | "pending";
}

export interface FypMilestone {
  id: string;
  groupId: string;
  key: FypMilestoneKey;
  title: string;
  description: string;
  deadline: string; // ISO string
  weightage: number; // e.g. 15%
  status: FypMilestoneStatus;
  submissions: FypMilestoneSubmission[];
  supervisorFeedback?: string | null;
  approvedAt?: string | null;
  updatedAt: string;
}

export type FypMeetingStatus = "pending_confirmation" | "confirmed";

export interface FypMeetingLog {
  id: string;
  groupId: string;
  meetingDate: string; // e.g. "2026-11-20"
  scheduledBy: "student" | "supervisor";
  schedulerName: string;
  attendees: string[]; // List of student/faculty names or regNos
  discussionPoints: string;
  actionItems: string;
  nextMeetingDate?: string | null;
  status: FypMeetingStatus;
  supervisorNotes?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
}

export interface FypDocumentComment {
  id: string;
  authorName: string;
  authorRole: "supervisor" | "student";
  text: string;
  createdAt: string;
}

export const FYP_DOCUMENT_CATEGORIES = [
  "proposal",
  "srs",
  "design",
  "slides",
  "code_repository",
  "final_report",
  "other",
] as const;

export type FypDocumentCategory = (typeof FYP_DOCUMENT_CATEGORIES)[number];

export interface FypProjectDocument {
  id: string;
  groupId: string;
  category: FypDocumentCategory;
  title: string;
  documentUrl: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  fileSizeLabel?: string;
  plagiarismScore?: number;
  aiScore?: number;
  similarityStatus?: "passed" | "flagged" | "pending";
  comments: FypDocumentComment[];
}

export interface FypGroupProgressSummary {
  groupId: string;
  completedMilestones: number;
  totalMilestones: number;
  percentComplete: number;
  isOnTrack: boolean;
  activeMilestoneTitle: string | null;
  nextDeadline: string | null;
  monthlyMeetingCount: number;
  isMeetingRequirementMet: boolean; // >= 2 meetings this month
}

/**
 * =========================================================================
 * PHASE 3: PANEL ALLOCATION, DEFENSE SCHEDULING & 6TH SEMESTER EVALUATION
 * =========================================================================
 */

export interface FypPanelMember {
  teacherId: number;
  teacherName: string;
  email: string;
  department: string;
  isChair: boolean;
}

export interface FypDefensePanel {
  id: string;
  name: string; // e.g. "Panel A - AI & Cyber Security"
  department: string;
  members: FypPanelMember[]; // 2 to 3 faculty members
  assignedGroupIds: string[];
  createdAt: string;
}

export type FypDefenseStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "rescheduled";

export interface FypDefenseSchedule {
  id: string;
  groupId: string;
  groupTitle: string;
  groupDomain: string;
  defenseDate: string; // YYYY-MM-DD
  startTime: string; // "09:00"
  endTime: string; // "09:45"
  venue: string; // "Seminar Hall", "CS Lab 1", "Conference Room"
  panelId: string;
  panelName: string;
  status: FypDefenseStatus;
  rescheduleReason?: string | null;
  createdAt: string;
}

export interface FypDefenseRubricCriterion {
  id: string;
  name: string;
  description: string;
  maxMarks: number;
}

export const DEFAULT_DEFENSE_RUBRIC: FypDefenseRubricCriterion[] = [
  {
    id: "pres",
    name: "Presentation & Communication Skills",
    description: "Slide quality, clarity of verbal delivery, pacing, professional demeanor, and visual aids.",
    maxMarks: 15,
  },
  {
    id: "prob",
    name: "Problem Understanding & Motivation",
    description: "Justification of problem significance, stakeholder impact, and real-world relevance to COMSATS context.",
    maxMarks: 15,
  },
  {
    id: "tech",
    name: "Technical Depth & Literature Survey",
    description: "Rigorous comparative study of existing benchmarks, frameworks, and scientific papers.",
    maxMarks: 20,
  },
  {
    id: "arch",
    name: "Proposed Methodology & System Architecture",
    description: "Feasibility of proposed pipeline, algorithmic approach, database schema, and interface design.",
    maxMarks: 20,
  },
  {
    id: "qna",
    name: "Q&A Defense & Analytical Reasoning",
    description: "Ability to defend technical decisions, handle edge cases, and articulate limitations.",
    maxMarks: 15,
  },
  {
    id: "indiv",
    name: "Individual Contribution & Technical Grasp",
    description: "Assessed individually per student based on their specific module ownership and Q&A mastery.",
    maxMarks: 15,
  },
];

export interface FypStudentScore {
  studentId: string;
  regNo: string;
  studentName: string;
  individualMarks: number; // out of 15
}

export type FypDefenseRecommendation =
  | "accepted"
  | "accepted_with_minor_changes"
  | "major_revision"
  | "deferred";

export interface FypPanelistEvaluation {
  id: string;
  panelId: string;
  groupId: string;
  panelistId: number;
  panelistName: string;
  groupCriterionScores: Record<string, number>; // criterionId -> marks
  studentScores: FypStudentScore[];
  totalScore: number; // sum of group criteria + average of individual scores
  recommendation: FypDefenseRecommendation;
  remarks: string;
  submittedAt: string;
  isLocked: boolean;
}

export interface FypDefenseResultSummary {
  groupId: string;
  groupTitle: string;
  groupDomain: string;
  averageTotalScore: number;
  evaluationsCount: number;
  totalPanelists: number;
  isPublished: boolean;
  consensusRecommendation: FypDefenseRecommendation | "pending";
  publishedAt?: string | null;
  panelistSummaries: Array<{
    panelistName: string;
    totalScore?: number; // hidden if blinded/unpublished
    recommendation: FypDefenseRecommendation;
    remarks: string;
  }>;
  studentAverages: Array<{
    studentId: string;
    regNo: string;
    studentName: string;
    averageMarks: number;
  }>;
}

/**
 * =========================================================================
 * PHASE 4: 7TH SEMESTER INTERNAL EVALUATION COMMITTEE & MARKS AGGREGATION
 * =========================================================================
 */

export interface FypCommitteeMember {
  teacherId: number;
  teacherName: string;
  email: string;
  department: string;
  isLead: boolean;
}

export interface FypInternalCommittee {
  id: string;
  name: string; // e.g. "7th Sem Committee 01 - AI & Data Science"
  department: string;
  members: FypCommitteeMember[]; // 2 to 3 faculty members
  assignedGroupIds: string[];
  createdAt: string;
}

export interface FypInternalRubricCriterion {
  id: string;
  name: string;
  description: string;
  maxMarks: number;
}

export const DEFAULT_INTERNAL_RUBRIC: FypInternalRubricCriterion[] = [
  {
    id: "impl",
    name: "System Implementation & Code Quality",
    description: "Architecture robustness, coding standards, error handling, database normalization, and repository activity.",
    maxMarks: 25,
  },
  {
    id: "prog",
    name: "Milestone Progress & Sprint Adherence",
    description: "Completion of SRS, design blueprints, progress sprints, and responsiveness to supervisor reviews.",
    maxMarks: 20,
  },
  {
    id: "rep",
    name: "Report Quality & Documentation Rigor",
    description: "Clarity of 7th semester report, IEEE citation standard, Turnitin similarity compliance, and diagrams.",
    maxMarks: 20,
  },
  {
    id: "demo",
    name: "Working Prototype Demonstration",
    description: "Live functional walkthrough of all core user journeys, data pipelines, and resilience under edge cases.",
    maxMarks: 20,
  },
  {
    id: "indiv",
    name: "Individual Technical Contribution",
    description: "Measured per student based on verifiable commit history, task ownership, and technical defense during committee Q&A.",
    maxMarks: 15,
  },
];

export interface FypCommitteeEvaluation {
  id: string;
  committeeId: string;
  groupId: string;
  evaluatorId: number;
  evaluatorName: string;
  groupCriterionScores: Record<string, number>; // criterionId -> marks (out of 85)
  studentScores: FypStudentScore[]; // studentId -> individualMarks (out of 15)
  evidenceNotes: string; // references to git commits, task logs, demo performance
  totalScore: number; // group sum + average of student individual marks (out of 100)
  recommendation: "accepted" | "minor_revisions" | "major_revisions" | "repeat";
  remarks: string;
  submittedAt: string;
  isLocked: boolean;
}

export interface FypCommitteeModerationResult {
  groupId: string;
  groupTitle: string;
  evaluationsCount: number;
  totalCommitteeMembers: number;
  scores: Array<{
    evaluatorId: number;
    evaluatorName: string;
    totalScore: number;
  }>;
  averageScore: number;
  maxDivergence: number;
  hasDivergenceAlert: boolean; // divergence > 15 marks
}

export interface FypGradeWeightageConfig {
  id: string;
  supervisorWeight: number; // e.g. 30 (%)
  defenseWeight: number; // e.g. 30 (%) - 6th semester defense
  committeeWeight: number; // e.g. 40 (%) - 7th semester internal committee
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_GRADE_WEIGHTAGE: FypGradeWeightageConfig = {
  id: "default_weightage",
  supervisorWeight: 30,
  defenseWeight: 30,
  committeeWeight: 40,
  updatedAt: new Date().toISOString(),
  updatedBy: "Academic FYP Committee",
};

export interface FypFinalAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  reason?: string;
}

export interface FypFinalStudentGrade {
  studentId: string;
  regNo: string;
  studentName: string;
  groupId: string;
  groupTitle: string;
  groupDomain: string;
  supervisorScore: number; // out of 100
  defenseScore: number; // out of 100
  committeeScore: number; // out of 100
  weightedTotal: number; // out of 100
  letterGrade: "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";
  gradePoint: number;
  isPublished: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
  auditTrail: FypFinalAuditEntry[];
}

/**
 * COMSATS Official Grading Scheme
 */
export function calculateComsatsGrade(total: number): {
  letterGrade: "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";
  gradePoint: number;
} {
  const rounded = Math.round(total * 10) / 10;
  if (rounded >= 85) return { letterGrade: "A", gradePoint: 4.0 };
  if (rounded >= 80) return { letterGrade: "A-", gradePoint: 3.66 };
  if (rounded >= 75) return { letterGrade: "B+", gradePoint: 3.33 };
  if (rounded >= 70) return { letterGrade: "B", gradePoint: 3.0 };
  if (rounded >= 65) return { letterGrade: "B-", gradePoint: 2.66 };
  if (rounded >= 61) return { letterGrade: "C+", gradePoint: 2.33 };
  if (rounded >= 58) return { letterGrade: "C", gradePoint: 2.0 };
  if (rounded >= 55) return { letterGrade: "C-", gradePoint: 1.66 };
  if (rounded >= 50) return { letterGrade: "D", gradePoint: 1.0 };
  return { letterGrade: "F", gradePoint: 0.0 };
}



