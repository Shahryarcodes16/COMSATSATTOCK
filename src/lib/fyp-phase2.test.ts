import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureFypTables,
  serverSaveFypGroup,
  serverSeedDefaultMilestones,
  serverGetGroupMilestones,
  serverSubmitMilestone,
  serverReviewMilestone,
  serverGetGroupProgressSummary,
  serverCreateMeetingLog,
  serverConfirmMeetingLog,
  serverGetMeetingLogs,
  serverUploadDocument,
  serverAddDocumentComment,
  serverGetDocuments,
} from "./fyp.server.ts";
import type { FypStudentMember } from "./fyp-types.ts";

test("FYP Phase 2: Milestones, meeting logs, and document repository", async (t) => {
  await ensureFypTables();

  const testGroupId = `grp-p2-${Date.now()}`;
  const leader: FypStudentMember = {
    studentId: `std-p2-leader-${Date.now()}`,
    regNo: "FA22-BCS-777",
    fullName: "Bilal Khan",
    email: "fa22-bcs-777@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
    isLeader: true,
  };

  const group = await serverSaveFypGroup({
    id: testGroupId,
    title: "Deep Vision Edge Computing for Agricultural Pest Detection",
    domain: "Artificial Intelligence & Machine Learning",
    abstract: "YOLOv10 deployment on edge drones for real-time citrus pest identification.",
    leader,
    members: [],
  });

  const supervisorId = 2002;
  const supervisorName = "Dr. Asim Shahzad";

  await t.test("1. Seed default 6th/7th semester milestones", async () => {
    const seeded = await serverSeedDefaultMilestones(group.id);
    assert.equal(seeded.length, 6, "Must create 6 standard COMSATS FYP milestones");

    const totalWeight = seeded.reduce((acc, m) => acc + m.weightage, 0);
    assert.equal(totalWeight, 100, "Milestone weightages must sum to 100%");

    const srs = seeded.find((m) => m.key === "srs");
    assert.ok(srs, "SRS milestone must exist");
    assert.equal(srs?.status, "not_started");
  });

  let submittedSubId = "";

  await t.test("2. Student submits deliverable with Turnitin scan", async () => {
    const milestones = await serverGetGroupMilestones(group.id);
    const proposal = milestones.find((m) => m.key === "proposal");
    assert.ok(proposal, "Proposal milestone must exist");

    const res = await serverSubmitMilestone({
      groupId: group.id,
      milestoneId: proposal.id,
      documentUrl: "https://drive.google.com/file/d/test-proposal-v1/view",
      fileName: "CitrusPest_Proposal_v1.pdf",
      changeSummary: "First draft submission of project proposal.",
      submittedBy: "Bilal Khan",
    });

    assert.equal(res.status, "submitted");
    assert.equal(res.submissions.length, 1);
    const sub = res.submissions[0];
    assert.equal(sub.version, 1);
    assert.ok(typeof sub.plagiarismScore === "number", "Plagiarism score must be calculated");
    assert.ok(typeof sub.aiScore === "number", "AI score must be calculated");
    assert.ok(sub.similarityStatus === "passed" || sub.similarityStatus === "flagged");
    submittedSubId = sub.id;
  });

  await t.test("3. Supervisor reviews deliverable (Revision Requested -> Approved)", async () => {
    const milestones = await serverGetGroupMilestones(group.id);
    const proposal = milestones.find((m) => m.key === "proposal")!;

    // Step A: Request Revision
    const revised = await serverReviewMilestone({
      milestoneId: proposal.id,
      supervisorId,
      decision: "revision_requested",
      feedback: "Please expand section 2.4 on drone hardware flight endurance constraints.",
    });
    assert.equal(revised.status, "revision_requested");
    assert.ok(revised.supervisorFeedback?.includes("flight endurance"));

    // Step B: Student uploads v2 revision
    const subV2 = await serverSubmitMilestone({
      groupId: group.id,
      milestoneId: proposal.id,
      documentUrl: "https://drive.google.com/file/d/test-proposal-v2/view",
      fileName: "CitrusPest_Proposal_v2.pdf",
      changeSummary: "Added drone endurance calculations and battery payload graphs.",
      submittedBy: "Bilal Khan",
    });
    assert.equal(subV2.submissions.length, 2);
    assert.equal(subV2.submissions[1].version, 2);

    // Step C: Supervisor Approves
    const approved = await serverReviewMilestone({
      milestoneId: proposal.id,
      supervisorId,
      decision: "approved",
      feedback: "Excellent additions. Proposal approved.",
    });
    assert.equal(approved.status, "approved");
    assert.ok(approved.approvedAt, "approvedAt timestamp must be set");
  });

  await t.test("4. Progress Summary reflects approved sprint completion", async () => {
    const summary = await serverGetGroupProgressSummary(group.id);
    assert.equal(summary.completedMilestones, 1);
    assert.equal(summary.totalMilestones, 6);
    assert.equal(summary.percentComplete, Math.round((1 / 6) * 100));
  });

  let meetingLogId = "";

  await t.test("5. Meeting minutes logging and supervisor confirmation", async () => {
    const today = new Date().toISOString().split("T")[0];
    const createdLog = await serverCreateMeetingLog({
      groupId: group.id,
      meetingDate: today,
      scheduledBy: "student",
      schedulerName: "Bilal Khan",
      attendees: ["Bilal Khan", "Dr. Asim Shahzad"],
      discussionPoints: "Finalized YOLOv10 anchor box aspect ratios and dataset augmentation pipeline.",
      actionItems: "Collect 500 field samples of leafminer pests from Attock orchards.",
      nextMeetingDate: "2026-11-28",
    });

    assert.ok(createdLog.id);
    assert.equal(createdLog.status, "pending_confirmation");
    meetingLogId = createdLog.id;

    // Confirm minutes as supervisor
    const confirmed = await serverConfirmMeetingLog({
      logId: meetingLogId,
      supervisorId,
      notes: "Agreed. Dataset protocol confirmed.",
    });
    assert.equal(confirmed.status, "confirmed");
    assert.ok(confirmed.confirmedAt);

    // Check meeting logs query
    const list = await serverGetMeetingLogs(group.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, meetingLogId);
  });

  await t.test("6. Document Vault upload and inline commenting", async () => {
    const doc = await serverUploadDocument({
      groupId: group.id,
      category: "code_repository",
      title: "CitrusVision Firmware Repository",
      documentUrl: "https://github.com/cui-fyp/citrus-vision-edge",
      uploadedBy: "Bilal Khan",
      fileSizeLabel: "Git Repository",
    });

    assert.ok(doc.id);
    assert.equal(doc.category, "code_repository");
    assert.equal(doc.version, 1);

    // Add supervisor comment
    const commented = await serverAddDocumentComment({
      documentId: doc.id,
      authorName: supervisorName,
      authorRole: "supervisor",
      text: "Please add unit tests for the camera RTSP streaming module.",
    });

    assert.equal(commented.comments.length, 1);
    assert.equal(commented.comments[0].authorRole, "supervisor");

    // Fetch documents
    const allDocs = await serverGetDocuments(group.id);
    assert.equal(allDocs.length, 1);
    assert.equal(allDocs[0].comments.length, 1);
  });
});
