/**
 * TanStack Start Server Functions for FYP Management System (Phase 1)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StudentMemberSchema = z.object({
  studentId: z.string(),
  regNo: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  programCode: z.string(),
  department: z.string().optional(),
  isLeader: z.boolean().optional(),
});

const SaveGroupSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, "Project title must be at least 5 characters"),
  domain: z.string().min(3, "Please select a valid domain"),
  abstract: z.string().min(15, "Please write an abstract/summary of at least 15 characters"),
  leader: StudentMemberSchema,
  members: z.array(StudentMemberSchema).max(3),
});

export const getMyFypGroupServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ identifier: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetFypGroupByStudent } = await import("./fyp.server.ts");
    const group = await serverGetFypGroupByStudent(data.identifier);
    return { group };
  });

export const saveFypGroupServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => SaveGroupSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverSaveFypGroup } = await import("./fyp.server.ts");
    const group = await serverSaveFypGroup(data);
    return { success: true, group };
  });

export const getAvailableSupervisorsServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ department: z.string().optional() }).optional().parse(d))
  .handler(async ({ data }) => {
    const { serverGetAvailableSupervisors } = await import("./fyp.server.ts");
    const supervisors = await serverGetAvailableSupervisors(data?.department);
    return { supervisors };
  });

const SubmitSupervisorRequestSchema = z.object({
  groupId: z.string().min(1),
  teacherId: z.number().int().positive(),
  preferenceOrder: z.number().int().min(1).max(3).default(1),
  studentEmail: z.string().email(),
});

export const submitSupervisorRequestServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => SubmitSupervisorRequestSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverSubmitSupervisorRequest } = await import("./fyp.server.ts");
    const request = await serverSubmitSupervisorRequest(data);
    return { success: true, request };
  });

export const getGroupRequestsServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ groupId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetSupervisorRequestsForGroup } = await import("./fyp.server.ts");
    const requests = await serverGetSupervisorRequestsForGroup(data.groupId);
    return { requests };
  });

export const getFacultyFypDeckServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ teacherId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetFacultyFypRequests } = await import("./fyp.server.ts");
    const result = await serverGetFacultyFypRequests(data.teacherId);
    return result;
  });

const RespondRequestSchema = z.object({
  requestId: z.string().min(1),
  teacherId: z.number().int().positive(),
  decision: z.enum(["accepted", "declined"]),
  remark: z.string().optional(),
});

export const respondSupervisorRequestServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => RespondRequestSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverRespondSupervisorRequest } = await import("./fyp.server.ts");
    const res = await serverRespondSupervisorRequest(data);
    return res;
  });

const SaveFacultySettingsSchema = z.object({
  teacherId: z.number().int().positive(),
  maxSlots: z.number().int().min(1).max(15).optional(),
  researchAreas: z.array(z.string()).optional(),
  availableIdeas: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  isAccepting: z.boolean().optional(),
});

export const saveFacultyFypSettingsServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => SaveFacultySettingsSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverSaveFacultyFypSettings } = await import("./fyp.server.ts");
    const settings = await serverSaveFacultyFypSettings(data);
    return { success: true, settings };
  });

export const getAllFypGroupsCoordinatorServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const { serverGetAllFypGroups, serverGetAllRequests } = await import("./fyp.server.ts");
  const [groups, requests] = await Promise.all([serverGetAllFypGroups(), serverGetAllRequests()]);
  return { groups, requests };
});

/**
 * =========================================================================
 * PHASE 2 SERVER FUNCTIONS: MILESTONES, MEETINGS, AND DOCUMENTS
 * =========================================================================
 */

export const getGroupMilestonesServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ groupId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetGroupMilestones } = await import("./fyp.server.ts");
    const milestones = await serverGetGroupMilestones(data.groupId);
    return { milestones };
  });

const SubmitMilestoneSchema = z.object({
  groupId: z.string().min(1),
  milestoneId: z.string().min(1),
  documentUrl: z.string().min(1),
  fileName: z.string().min(1),
  changeSummary: z.string().optional(),
  submittedBy: z.string().min(1),
});

export const submitMilestoneServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => SubmitMilestoneSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverSubmitMilestone } = await import("./fyp.server.ts");
    const milestone = await serverSubmitMilestone(data);
    return { success: true, milestone };
  });

const ReviewMilestoneSchema = z.object({
  milestoneId: z.string().min(1),
  supervisorId: z.number().int().positive(),
  decision: z.enum(["approved", "revision_requested"]),
  feedback: z.string().optional(),
});

export const reviewMilestoneServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => ReviewMilestoneSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverReviewMilestone } = await import("./fyp.server.ts");
    const milestone = await serverReviewMilestone(data);
    return { success: true, milestone };
  });

export const getGroupProgressSummaryServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ groupId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetGroupProgressSummary } = await import("./fyp.server.ts");
    const summary = await serverGetGroupProgressSummary(data.groupId);
    return { summary };
  });

export const getGroupMeetingLogsServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ groupId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetMeetingLogs } = await import("./fyp.server.ts");
    const meetingLogs = await serverGetMeetingLogs(data.groupId);
    return { meetingLogs };
  });

const CreateMeetingLogSchema = z.object({
  groupId: z.string().min(1),
  meetingDate: z.string().min(1),
  scheduledBy: z.enum(["student", "supervisor"]),
  schedulerName: z.string().min(1),
  attendees: z.array(z.string()),
  discussionPoints: z.string().min(5, "Please write discussion points"),
  actionItems: z.string().min(3, "Please write action items"),
  nextMeetingDate: z.string().optional(),
});

export const createMeetingLogServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => CreateMeetingLogSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverCreateMeetingLog } = await import("./fyp.server.ts");
    const meetingLog = await serverCreateMeetingLog(data);
    return { success: true, meetingLog };
  });

const ConfirmMeetingLogSchema = z.object({
  logId: z.string().min(1),
  supervisorId: z.number().int().positive(),
  notes: z.string().optional(),
});

export const confirmMeetingLogServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => ConfirmMeetingLogSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverConfirmMeetingLog } = await import("./fyp.server.ts");
    const meetingLog = await serverConfirmMeetingLog(data);
    return { success: true, meetingLog };
  });

export const getGroupDocumentsServerFn = createServerFn({
  method: "GET",
})
  .validator((d: unknown) => z.object({ groupId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverGetDocuments } = await import("./fyp.server.ts");
    const documents = await serverGetDocuments(data.groupId);
    return { documents };
  });

const UploadDocumentSchema = z.object({
  groupId: z.string().min(1),
  category: z.enum([
    "proposal",
    "srs",
    "design",
    "slides",
    "code_repository",
    "final_report",
    "other",
  ]),
  title: z.string().min(3, "Title must be at least 3 characters"),
  documentUrl: z.string().min(1, "URL or link is required"),
  uploadedBy: z.string().min(1),
  fileSizeLabel: z.string().optional(),
});

export const uploadGroupDocumentServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => UploadDocumentSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverUploadDocument } = await import("./fyp.server.ts");
    const document = await serverUploadDocument(data);
    return { success: true, document };
  });

const AddDocumentCommentSchema = z.object({
  documentId: z.string().min(1),
  authorName: z.string().min(1),
  authorRole: z.enum(["supervisor", "student"]),
  text: z.string().min(1, "Comment text is required"),
});

export const addDocumentCommentServerFn = createServerFn({
  method: "POST",
})
  .validator((d: unknown) => AddDocumentCommentSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverAddDocumentComment } = await import("./fyp.server.ts");
    const document = await serverAddDocumentComment(data);
    return { success: true, document };
  });

