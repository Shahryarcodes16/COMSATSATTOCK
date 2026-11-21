import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureFypTables,
  serverSaveFypGroup,
  serverRespondSupervisorRequest,
  serverSubmitSupervisorRequest,
  serverCreateInternalCommittee,
  serverGetAllInternalCommittees,
  serverAssignGroupsToCommittee,
  serverSubmitCommitteeEvaluation,
  serverGetCommitteeEvaluationsForGroup,
  serverGetCommitteeModerationView,
  serverGetGradeWeightageConfig,
  serverSaveGradeWeightageConfig,
  serverComputeFinalGrades,
  serverPublishFinalResults,
  serverGetGroupFinalResults,
  serverGetStudentFinalGrade,
  serverExportMarksheet,
} from "./fyp.server.ts";
import type { FypStudentMember, FypCommitteeMember } from "./fyp-types.ts";

test("FYP Phase 4: 7th Semester Committee, Moderation, Weightages, and Final Grade Aggregation", async (t) => {
  await ensureFypTables();

  const timestamp = Date.now();
  const testGroupId = `grp-p4-${timestamp}`;
  const supervisorId = 4001;
  const supervisorName = "Dr. Asim Shahzad";

  const student1: FypStudentMember = {
    studentId: `std-p4-1-${timestamp}`,
    regNo: "FA22-BCS-201",
    fullName: "Zainab Bibi",
    email: "fa22-bcs-201@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
    isLeader: true,
  };

  const student2: FypStudentMember = {
    studentId: `std-p4-2-${timestamp}`,
    regNo: "FA22-BCS-202",
    fullName: "Umer Farooq",
    email: "fa22-bcs-202@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
  };

  // 1. Create and bind group with supervisor
  const group = await serverSaveFypGroup({
    id: testGroupId,
    title: "AI-Powered Smart Irrigation System for Pothohar Region",
    domain: "Artificial Intelligence & Machine Learning",
    abstract: "IoT soil telemetry with deep learning evapotranspiration forecasting.",
    leader: student1,
    members: [student2],
  });

  const req = await serverSubmitSupervisorRequest({
    groupId: group.id,
    teacherId: supervisorId,
    preferenceOrder: 1,
    studentNotes: "Looking forward to supervision.",
  });

  await serverRespondSupervisorRequest({
    requestId: req.id,
    teacherId: supervisorId,
    decision: "accepted",
  });

  let validCommitteeId = "";
  let conflictCommitteeId = "";

  await t.test("1. Create 7th Semester Internal Committees with Lead", async () => {
    const validMembers: FypCommitteeMember[] = [
      {
        teacherId: 4002,
        teacherName: "Dr. Sheraz Anjum",
        email: "sheraz@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isLead: true,
      },
      {
        teacherId: 4003,
        teacherName: "Dr. Noman Sarwar",
        email: "noman@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isLead: false,
      },
    ];

    const committee = await serverCreateInternalCommittee({
      name: `7th Sem Committee AI-${timestamp}`,
      department: "Department of Computer Science",
      members: validMembers,
    });

    assert.ok(committee.id, "Committee must have ID");
    assert.equal(committee.members.length, 2);
    assert.equal(committee.members.find((m) => m.isLead)?.teacherName, "Dr. Sheraz Anjum");
    validCommitteeId = committee.id;

    // Committee with the group's supervisor
    const conflictMembers: FypCommitteeMember[] = [
      {
        teacherId: supervisorId, // Group's supervisor!
        teacherName: supervisorName,
        email: "asim@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isLead: true,
      },
      {
        teacherId: 4004,
        teacherName: "Dr. Zahid Mehmood",
        email: "zahid@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isLead: false,
      },
    ];

    const cCommittee = await serverCreateInternalCommittee({
      name: `Conflict Committee-${timestamp}`,
      department: "Department of Computer Science",
      members: conflictMembers,
    });
    conflictCommitteeId = cCommittee.id;
  });

  await t.test("2. Conflict of Interest: Rejection if Supervisor is on group's internal committee", async () => {
    await assert.rejects(
      async () => {
        await serverAssignGroupsToCommittee({
          committeeId: conflictCommitteeId,
          groupIds: [group.id],
        });
      },
      (err: any) => {
        assert.match(
          err.message,
          /Conflict of Interest/i,
          "Must prevent assigning group to an internal committee containing its supervisor",
        );
        return true;
      },
    );

    // Assign to non-conflicting committee
    const updated = await serverAssignGroupsToCommittee({
      committeeId: validCommitteeId,
      groupIds: [group.id],
    });

    assert.ok(updated.assignedGroupIds.includes(group.id), "Group successfully assigned to clean committee");
  });

  await t.test("3. Independent Committee Scoring across 5-Criteria Rubric", async () => {
    // Evaluator 1 (Lead: 4002) scores
    const eval1 = await serverSubmitCommitteeEvaluation({
      committeeId: validCommitteeId,
      groupId: group.id,
      evaluatorId: 4002,
      evaluatorName: "Dr. Sheraz Anjum",
      groupCriterionScores: {
        impl: 23, // out of 25
        prog: 18, // out of 20
        rep: 18, // out of 20
        demo: 19, // out of 20
      },
      studentScores: [
        {
          studentId: student1.studentId,
          regNo: student1.regNo,
          studentName: student1.fullName,
          individualMarks: 14,
        },
        {
          studentId: student2.studentId,
          regNo: student2.regNo,
          studentName: student2.fullName,
          individualMarks: 13,
        },
      ],
      evidenceNotes: "Inspected GitHub repo commit history and tested live sensor telemetry.",
      recommendation: "accepted",
      remarks: "Excellent implementation and cloud connectivity.",
    });

    // Group criteria: 23 + 18 + 18 + 19 = 78. Avg student individual: (14+13)/2 = 13.5. Total: 91.5
    assert.equal(eval1.totalScore, 91.5);

    // Evaluator 2 (Member: 4003) scores
    const eval2 = await serverSubmitCommitteeEvaluation({
      committeeId: validCommitteeId,
      groupId: group.id,
      evaluatorId: 4003,
      evaluatorName: "Dr. Noman Sarwar",
      groupCriterionScores: {
        impl: 21,
        prog: 19,
        rep: 17,
        demo: 18,
      },
      studentScores: [
        {
          studentId: student1.studentId,
          regNo: student1.regNo,
          studentName: student1.fullName,
          individualMarks: 13,
        },
        {
          studentId: student2.studentId,
          regNo: student2.regNo,
          studentName: student2.fullName,
          individualMarks: 14,
        },
      ],
      evidenceNotes: "Live demonstration verified with edge hardware.",
      recommendation: "accepted",
      remarks: "Great progress and thorough report.",
    });

    // Group criteria: 21 + 19 + 17 + 18 = 75. Avg student individual: (13+14)/2 = 13.5. Total: 88.5
    assert.equal(eval2.totalScore, 88.5);

    // Check evaluations list
    const summary = await serverGetCommitteeEvaluationsForGroup(group.id, "coordinator");
    assert.equal(summary.evaluationsCount, 2);
    assert.equal(summary.averageScore, 90.0); // (91.5 + 88.5) / 2 = 90.0
    assert.equal(summary.isComplete, true);
  });

  await t.test("4. Moderation View & Score Divergence Analysis", async () => {
    const moderation = await serverGetCommitteeModerationView(group.id);
    assert.equal(moderation.evaluationsCount, 2);
    assert.equal(moderation.averageScore, 90.0);
    assert.equal(moderation.maxDivergence, 3.0); // 91.5 - 88.5 = 3.0
    assert.equal(moderation.hasDivergenceAlert, false, "3 points divergence should NOT trigger divergence alert");
  });

  await t.test("5. Grade Weightage Configuration (Validation & Persistence)", async () => {
    const current = await serverGetGradeWeightageConfig();
    assert.ok(current.id);

    // Rejects invalid weights that do not sum to 100%
    await assert.rejects(
      async () => {
        await serverSaveGradeWeightageConfig({
          supervisorWeight: 40,
          defenseWeight: 40,
          committeeWeight: 40, // Sum = 120
          updatedBy: "Admin",
        });
      },
      (err: any) => {
        assert.match(err.message, /must total exactly 100%/i);
        return true;
      },
    );

    // Save valid configuration: 30% Supervisor + 30% Defense + 40% Committee
    const updated = await serverSaveGradeWeightageConfig({
      supervisorWeight: 30,
      defenseWeight: 30,
      committeeWeight: 40,
      updatedBy: "FYP Coordinator",
    });

    assert.equal(updated.supervisorWeight, 30);
    assert.equal(updated.defenseWeight, 30);
    assert.equal(updated.committeeWeight, 40);
  });

  await t.test("6. Aggregate Final Grades with Official COMSATS Letter Scale", async () => {
    const grades = await serverComputeFinalGrades(group.id, "Exam Committee Board");
    assert.equal(grades.length, 2, "Both students in the group must have grades computed");

    const g1 = grades.find((g) => g.studentId === student1.studentId);
    assert.ok(g1, "Student 1 grade must exist");
    assert.ok(g1.weightedTotal > 80, "Weighted score should be > 80");
    assert.ok(["A", "A-", "B+"].includes(g1.letterGrade), "Must be awarded standard COMSATS letter grade");
    assert.ok(g1.gradePoint >= 3.33, "Grade point must correspond to letter grade");
    assert.equal(g1.isPublished, false, "Must start as draft before official publishing");
    assert.ok(g1.auditTrail.length > 0, "Must contain audit entry");
  });

  await t.test("7. Publish Final Results & Lock with Examination Audit Trail", async () => {
    const pub = await serverPublishFinalResults(group.id, "Dr. Examination Convener");
    assert.equal(pub.success, true);
    assert.equal(pub.grades.length, 2);
    assert.equal(pub.grades[0].isPublished, true);
    assert.equal(pub.grades[0].publishedBy, "Dr. Examination Convener");

    // Student final lookup
    const studentCheck = await serverGetStudentFinalGrade(student1.regNo);
    assert.ok(studentCheck);
    assert.equal(studentCheck?.isPublished, true);
    assert.equal(studentCheck?.regNo, student1.regNo);

    // Group final results lookup
    const groupGrades = await serverGetGroupFinalResults(group.id);
    assert.equal(groupGrades.length, 2);
    assert.equal(groupGrades[0].isPublished, true);
  });

  await t.test("8. Export Official Marksheet for Examination Department (CSV & JSON)", async () => {
    const csvExport = await serverExportMarksheet("csv");
    assert.ok(csvExport.data.includes("Registration No"), "CSV must include Registration No header");
    assert.ok(csvExport.data.includes(student1.regNo), "CSV must include student 1 regNo");
    assert.ok(csvExport.filename.endsWith(".csv"), "Filename must have .csv extension");

    const jsonExport = await serverExportMarksheet("json");
    assert.ok(jsonExport.filename.endsWith(".json"));
    const parsed = JSON.parse(jsonExport.data);
    assert.ok(Array.isArray(parsed));
  });
});
