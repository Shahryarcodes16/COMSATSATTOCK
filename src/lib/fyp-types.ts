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
