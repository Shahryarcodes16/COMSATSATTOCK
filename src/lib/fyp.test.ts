import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureFypTables,
  serverSaveFypGroup,
  serverGetFypGroupByStudent,
  serverGetFypGroupById,
  serverGetFacultyFypSettings,
  serverSaveFacultyFypSettings,
  serverGetAvailableSupervisors,
  serverSubmitSupervisorRequest,
  serverGetSupervisorRequestsForGroup,
  serverGetFacultyFypRequests,
  serverRespondSupervisorRequest,
} from "./fyp.server.ts";
import type { FypStudentMember } from "./fyp-types.ts";

test("FYP Phase 1: Group formation, supervisor quota, requests, and acceptance", async (t) => {
  await ensureFypTables();

  const testStudentId = `test-student-${Date.now()}`;
  const testStudentEmail = `${testStudentId.toLowerCase()}@cuiatk.edu.pk`;
  const testRegNo = "FA22-BCS-999";

  const leader: FypStudentMember = {
    studentId: testStudentId,
    regNo: testRegNo,
    fullName: "Ali Ahmed",
    email: testStudentEmail,
    programCode: "bcs",
    department: "Department of Computer Science",
    isLeader: true,
  };

  const member1: FypStudentMember = {
    studentId: `mem1-${Date.now()}`,
    regNo: "FA22-BCS-998",
    fullName: "Usman Tariq",
    email: "fa22-bcs-998@cuiatk.edu.pk",
    programCode: "bcs",
    department: "Department of Computer Science",
    isLeader: false,
  };

  let createdGroupId = "";

  await t.test("1. Successfully creates an FYP group with leader and member", async () => {
    const group = await serverSaveFypGroup({
      title: "Autonomous Campus SLAM Navigation Robot",
      domain: "Robotics & Autonomous Systems",
      abstract: "Building a LiDAR-based real-time SLAM robot for indoor navigation across academic blocks.",
      leader,
      members: [member1],
    });

    assert.ok(group.id, "Group must have a unique ID");
    assert.equal(group.title, "Autonomous Campus SLAM Navigation Robot");
    assert.equal(group.status, "draft");
    assert.equal(group.leader.email, testStudentEmail);
    assert.equal(group.members.length, 1);
    createdGroupId = group.id;

    // Lookup by student email
    const byEmail = await serverGetFypGroupByStudent(testStudentEmail);
    assert.ok(byEmail, "Group should be retrievable by leader email");
    assert.equal(byEmail?.id, createdGroupId);

    // Lookup by member regNo
    const byMember = await serverGetFypGroupByStudent("fa22-bcs-998");
    assert.ok(byMember, "Group should be retrievable by member registration number");
    assert.equal(byMember?.id, createdGroupId);
  });

  const testTeacherId = 1001; // Mock teacher ID

  await t.test("2. Faculty Settings & Quotas", async () => {
    // Initial fetch
    const initialSettings = await serverGetFacultyFypSettings(testTeacherId);
    assert.ok(initialSettings.maxSlots >= 1, "Default maxSlots should be >= 1");
    assert.ok(initialSettings.researchAreas.length > 0, "Default research tags should exist");

    // Update settings: set quota to 2 slots for testing invariant
    const updated = await serverSaveFacultyFypSettings({
      teacherId: testTeacherId,
      maxSlots: 2,
      researchAreas: ["Robotics & Autonomous Systems", "Computer Vision"],
      isAccepting: true,
    });

    assert.equal(updated.maxSlots, 2);
    assert.ok(updated.researchAreas.includes("Robotics & Autonomous Systems"));
  });

  await t.test("3. Browse Available Supervisors", async () => {
    const available = await serverGetAvailableSupervisors();
    assert.ok(Array.isArray(available), "Should return array of supervisors");
  });

  let requestId = "";

  await t.test("4. Student submits supervisor request", async () => {
    const req = await serverSubmitSupervisorRequest({
      groupId: createdGroupId,
      teacherId: testTeacherId,
      preferenceOrder: 1,
      studentEmail: testStudentEmail,
    });

    assert.ok(req.id, "Request ID generated");
    assert.equal(req.status, "pending");
    assert.equal(req.teacherId, testTeacherId);
    assert.equal(req.preferenceOrder, 1);
    requestId = req.id;

    // Verify group status changed to supervisor_pending
    const updatedGroup = await serverGetFypGroupById(createdGroupId);
    assert.equal(updatedGroup?.status, "supervisor_pending");

    // Verify faculty deck receives this pending request
    const deck = await serverGetFacultyFypRequests(testTeacherId);
    const found = deck.pendingRequests.find((r) => r.id === req.id);
    assert.ok(found, "Pending request must appear in faculty deck");
  });

  await t.test("5. Prevents duplicate pending request to same supervisor", async () => {
    await assert.rejects(
      async () => {
        await serverSubmitSupervisorRequest({
          groupId: createdGroupId,
          teacherId: testTeacherId,
          preferenceOrder: 1,
          studentEmail: testStudentEmail,
        });
      },
      /already submitted/i,
    );
  });

  await t.test("6. Faculty accepts supervisor request and binds group", async () => {
    const response = await serverRespondSupervisorRequest({
      requestId,
      teacherId: testTeacherId,
      decision: "accepted",
      remark: "Outstanding proposal. Accepted to Robotics Lab.",
    });

    assert.equal(response.success, true);
    assert.equal(response.request?.status, "accepted");
    assert.equal(response.group?.supervisorId, testTeacherId);
    assert.equal(response.group?.status, "supervisor_accepted");

    // Check faculty deck active groups
    const deck = await serverGetFacultyFypRequests(testTeacherId);
    const active = deck.acceptedGroups.find((g) => g.id === createdGroupId);
    assert.ok(active, "Group must now appear in faculty's accepted groups");
  });
});
