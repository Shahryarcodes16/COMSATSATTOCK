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

