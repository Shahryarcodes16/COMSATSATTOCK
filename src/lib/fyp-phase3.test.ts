import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureFypTables,
  serverSaveFypGroup,
  serverRespondSupervisorRequest,
  serverSubmitSupervisorRequest,
  serverCreateDefensePanel,
  serverAssignGroupsToPanel,
  serverScheduleDefense,
  serverGetFacultyAssignedDefenses,
  serverSubmitDefenseEvaluation,
  serverGetGroupDefenseResult,
  serverPublishDefenseResult,
  serverGetStudentDefenseSchedule,
} from "./fyp.server.ts";
import type { FypStudentMember, FypPanelMember } from "./fyp-types.ts";

test("FYP Phase 3: Panel Allocation, Defense Scheduling, and 6th Semester Evaluation", async (t) => {
  await ensureFypTables();

  const timestamp = Date.now();
  const testGroupId = `grp-p3-${timestamp}`;
  const supervisorId = 3001;
  const supervisorName = "Dr. Tariq Mahmood";

  const student1: FypStudentMember = {
    studentId: `std-p3-1-${timestamp}`,
    regNo: "FA22-BCS-101",
    fullName: "Ayesha Tariq",
    email: "fa22-bcs-101@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
    isLeader: true,
  };

  const student2: FypStudentMember = {
    studentId: `std-p3-2-${timestamp}`,
    regNo: "FA22-BCS-102",
    fullName: "Hamza Abbasi",
    email: "fa22-bcs-102@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
  };

  // 1. Create and setup accepted group
  const group = await serverSaveFypGroup({
    id: testGroupId,
    title: "Autonomous Drone Swarm for Campus Surveillance",
    domain: "Robotics & Embedded Systems",
    abstract: "Decentralized flocking and visual object tracking system with edge computing.",
    leader: student1,
    members: [student2],
  });

  const req = await serverSubmitSupervisorRequest({
    groupId: group.id,
    teacherId: supervisorId,
    preferenceOrder: 1,
    studentNotes: "Looking forward to working under your supervision.",
  });

  await serverRespondSupervisorRequest({
    requestId: req.id,
    teacherId: supervisorId,
    decision: "accepted",
  });

  let createdPanelId = "";
  let conflictPanelId = "";

  await t.test("1. Create Defense Panels with 2-3 members and Chairperson", async () => {
    const members: FypPanelMember[] = [
      {
        teacherId: 3002,
        teacherName: "Dr. Farhan Dawood",
        email: "farhan@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isChair: true,
      },
      {
        teacherId: 3003,
        teacherName: "Engr. Sadia Noreen",
        email: "sadia@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isChair: false,
      },
    ];

    const panel = await serverCreateDefensePanel({
      name: `PANEL-AI-${timestamp}`,
      department: "Department of Computer Science",
      members,
    });

    assert.ok(panel.id, "Panel must be created with unique ID");
    assert.equal(panel.members.length, 2, "Must contain 2 panel members");
    assert.equal(panel.members.find((m) => m.isChair)?.teacherName, "Dr. Farhan Dawood", "Chairperson must be assigned correctly");
    createdPanelId = panel.id;

    // Create a panel that contains the supervisor to test conflict checking
    const conflictMembers: FypPanelMember[] = [
      {
        teacherId: supervisorId, // Group's supervisor!
        teacherName: supervisorName,
        email: "tariq@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isChair: true,
      },
      {
        teacherId: 3004,
        teacherName: "Dr. Kamran Malik",
        email: "kamran@cuiatk.edu.pk",
        department: "Department of Computer Science",
        isChair: false,
      },
    ];

    const cPanel = await serverCreateDefensePanel({
      name: `PANEL-CONFLICT-${timestamp}`,
      department: "Department of Computer Science",
      members: conflictMembers,
    });
    conflictPanelId = cPanel.id;
  });

  await t.test("2. Conflict of Interest: Rejection if Supervisor is on group's defense panel", async () => {
    await assert.rejects(
      async () => {
        await serverAssignGroupsToPanel({
          panelId: conflictPanelId,
          groupIds: [group.id],
        });
      },
      (err: any) => {
        assert.match(
          err.message,
          /Conflict of Interest/i,
          "Must reject assigning group to a panel containing its own supervisor",
        );
        return true;
      },
    );

    // Now assign to non-conflicting panel
    const updatedPanel = await serverAssignGroupsToPanel({
      panelId: createdPanelId,
      groupIds: [group.id],
    });

    assert.ok(updatedPanel.assignedGroupIds.includes(group.id), "Group should be assigned to non-conflicting panel");
  });

  let scheduleId = "";

  await t.test("3. Schedule Defense Logistics with Clash Prevention", async () => {
    const defenseDate = "2026-12-15";
    const startTime = "10:00";
    const endTime = "10:45";
    const venue = `CS Auditorium Lab ${timestamp}`;

    // Successful schedule
    const schedule = await serverScheduleDefense({
      groupId: group.id,
      panelId: createdPanelId,
      defenseDate,
      startTime,
      endTime,
      venue,
    });

    assert.ok(schedule.id, "Schedule must be created");
    assert.equal(schedule.venue, venue);
    assert.equal(schedule.status, "scheduled");
    scheduleId = schedule.id;

    // Test Venue Clash: Another group cannot use the same venue at the same time
    const dummyGroup2 = await serverSaveFypGroup({
      id: `grp-dummy-${timestamp}`,
      title: "Another Group Project",
      domain: "Cybersecurity",
      abstract: "Abstract testing venue clash detection.",
      leader: {
        studentId: `std-d-${timestamp}`,
        regNo: "FA22-BCS-999",
        fullName: "Test Student",
        email: "test999@cuiatk.edu.pk",
        programCode: "bcs",
        department: "CS",
      },
      members: [],
    });

    await assert.rejects(
      async () => {
        await serverScheduleDefense({
          groupId: dummyGroup2.id,
          panelId: conflictPanelId,
          defenseDate,
          startTime: "10:15", // Overlaps with 10:00 - 10:45
          endTime: "11:00",
          venue, // Same venue!
        });
      },
      (err: any) => {
        assert.match(err.message, /Venue Clash/i, "Must detect venue collision");
        return true;
      },
    );

    // Test Panel Clash: Same panel cannot be scheduled in two venues at the same time
    await assert.rejects(
      async () => {
        await serverScheduleDefense({
          groupId: dummyGroup2.id,
          panelId: createdPanelId, // Same panel!
          defenseDate,
          startTime: "10:30", // Overlaps with 10:00 - 10:45
          endTime: "11:15",
          venue: "Seminar Hall B", // Different venue
        });
      },
      (err: any) => {
        assert.match(err.message, /Panel Clash|Panel Member Double-Booking/i, "Must detect panel clash");
        return true;
      },
    );
  });

  await t.test("4. Faculty Assigned Defenses View", async () => {
    // Member 3002 is on createdPanel
    const defenses = await serverGetFacultyAssignedDefenses(3002);
    const assigned = defenses.find((d) => d.schedule.groupId === group.id);
    assert.ok(assigned, "Faculty member 3002 should have assigned defense for group");
    assert.equal(assigned?.isChair, true, "Should indicate faculty is chairperson");
  });

  await t.test("5. Blind Evaluation Submission & Independent Scoring", async () => {
    // Evaluator 1 (Chairperson: 3002) scores
    const eval1 = await serverSubmitDefenseEvaluation({
      panelId: createdPanelId,
      groupId: group.id,
      panelistId: 3002,
      panelistName: "Dr. Farhan Dawood",
      groupCriterionScores: {
        pres: 14,
        prob: 14,
        tech: 18,
        arch: 18,
        qna: 14,
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
      recommendation: "accepted_with_minor_changes",
      remarks: "Impressive real-time drone telemetry. Add Kalman filtering to stabilize altitude.",
    });

    assert.equal(eval1.totalScore, 91.5, "Total score should be 78 (group criteria) + 13.5 (avg indiv) = 91.5");

    // Evaluator 2 (Member: 3003) scores
    const eval2 = await serverSubmitDefenseEvaluation({
      panelId: createdPanelId,
      groupId: group.id,
      panelistId: 3003,
      panelistName: "Engr. Sadia Noreen",
      groupCriterionScores: {
        pres: 13,
        prob: 15,
        tech: 17,
        arch: 19,
        qna: 13,
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
      recommendation: "accepted",
      remarks: "Great teamwork and hardware-software integration.",
    });

    assert.equal(eval2.totalScore, 90.5, "Total score should be 77 (group criteria) + 13.5 (avg indiv) = 90.5");

    // Before publishing, student query should report results unpublished
    const studentCheck = await serverGetGroupDefenseResult(group.id, "student");
    assert.equal(studentCheck.isPublished, false, "Marks must remain blind/hidden to students before publishing");
  });

  await t.test("6. Result Publication and Score Aggregation", async () => {
    const pub = await serverPublishDefenseResult({
      groupId: group.id,
      publishedBy: "FYP Coordinator (Dr. Asif)",
    });

    assert.equal(pub.success, true, "Publish status must succeed");

    // Now student queries published results
    const summary = await serverGetGroupDefenseResult(group.id, "student");
    assert.equal(summary.isPublished, true, "Results must be visible now");
    assert.ok(summary.averageTotalScore > 85, "Panel average score should be calculated out of 100");
    assert.equal(summary.studentAverages.length, 2, "Both students must have aggregated individual scores");
    assert.equal(summary.panelistSummaries.length, 2, "Consolidated feedback from both panelists must be present");

    // Student defense schedule overview
    const studentView = await serverGetStudentDefenseSchedule(group.id);
    assert.ok(studentView.schedule, "Schedule must be present");
    assert.ok(studentView.panel, "Panel must be present");
    assert.ok(studentView.resultSummary?.isPublished, "Result summary must show isPublished=true");
  });
});
