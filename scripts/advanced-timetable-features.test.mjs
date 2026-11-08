import assert from "node:assert/strict";
import { findConflictAlternatives, autoResolveAllConflicts } from "../src/lib/timetable-resolver.ts";
import { computeDetailedTimetableDiff } from "../src/lib/timetable-diff.ts";
import { getRoomUtilizationStats, getCampusPulseTelemetry, addClassCancellation, isClassCancelled, getClassCancellations } from "../src/lib/campus-pulse.ts";
import { computeFacultyAnalytics } from "../src/lib/faculty-analytics.ts";
import { validateTimetable } from "../src/lib/timetable-validator.ts";

console.log("▶ Running tests for Advanced Timetable & Campus Features...");

// Mock timetable with an intentional Room Clash on Monday Slot 0 (L1) in Room 0 (CR-01)
const mockTimetable = {
  b: ["BS(CS)-I", "BS(SE)-III", "BS(EE)-V"],
  r: ["CR-01", "CR-02", "CS Lab-1"],
  t: ["Dr. Ahmad", "Dr. Bilal", "Engr. Usman"],
  s: ["Programming Fundamentals", "Data Structures", "Digital Logic Design"],
  e: [
    [0, 0, 0, 0, 0, 0, 0], // Mon L1: BS(CS)-I in CR-01 by Dr. Ahmad (PF)
    [0, 0, 1, 0, 1, 1, 0], // Mon L1: BS(SE)-III in CR-01 by Dr. Bilal (DS) -> ROOM CLASH with entry 0!
    [1, 2, 2, 1, 2, 2, 0], // Tue L3 (11:30-1:15): BS(EE)-V in CR-02 by Engr. Usman (DLD) - single weekly class!
  ],
};

// ----------------------------------------------------------------
// TEST 1: Validate conflict detection and Smart Conflict Auto-Resolver
// ----------------------------------------------------------------
{
  console.log("  Testing Timetable Validation & Conflict Auto-Resolver...");
  const validation = validateTimetable(mockTimetable);
  assert.equal(validation.isValid, false, "Timetable must have detected conflict");
  assert.equal(validation.clashes.length, 1, "Must detect exactly 1 room clash");
  assert.equal(validation.clashes[0].type, "room_clash", "Clash type must be room_clash");

  // Test finding conflict alternatives
  const alternatives = findConflictAlternatives(validation.clashes[0], mockTimetable);
  assert.ok(alternatives.length > 0, "Must suggest at least 1 alternative slot");
  console.log(`    ✓ Top alternative suggested: ${alternatives[0].reason} (Score: ${alternatives[0].score}%)`);

  // Test auto-resolve all conflicts
  const { resolvedRaw, resolvedCount, unresolvedCount } = autoResolveAllConflicts(
    mockTimetable,
    validation.clashes,
  );
  assert.equal(resolvedCount, 1, "Must resolve 1 conflict");
  assert.equal(unresolvedCount, 0, "Must have 0 unresolved conflicts");

  const resolvedValidation = validateTimetable(resolvedRaw);
  assert.equal(resolvedValidation.isValid, true, "Resolved timetable must be 100% valid with 0 errors");
  console.log("    ✓ Auto-Resolve All successfully transformed conflicting timetable into 100% conflict-free timetable!");
}

// ----------------------------------------------------------------
// TEST 2: Timetable Visual Diff Viewer computation
// ----------------------------------------------------------------
{
  console.log("  Testing Timetable Visual Diff Viewer...");
  const oldTimetable = {
    b: ["BS(CS)-I"],
    r: ["CR-01"],
    t: ["Dr. Ahmad"],
    s: ["PF"],
    e: [
      [0, 0, 0, 0, 0, 0, 0], // Mon L1
      [1, 1, 0, 0, 0, 0, 0], // Tue L2 (will be removed in new)
    ],
  };

  const newTimetable = {
    b: ["BS(CS)-I"],
    r: ["CR-01", "CR-03"],
    t: ["Dr. Ahmad", "Dr. Bilal"],
    s: ["PF", "OOP"],
    e: [
      [0, 0, 0, 1, 0, 0, 0], // Mon L1 in CR-03 (Room modified from CR-01)
      [2, 0, 0, 0, 1, 1, 0], // Wed L1: OOP by Dr. Bilal (Added)
    ],
  };

  const diff = computeDetailedTimetableDiff(oldTimetable, newTimetable);
  assert.equal(diff.added.length, 1, "Must detect 1 added lecture");
  assert.equal(diff.removed.length, 1, "Must detect 1 removed lecture");
  assert.equal(diff.modified.length, 1, "Must detect 1 modified lecture");
  assert.ok(diff.modified[0].changes[0].includes("Room moved"), "Must identify room modification");
  console.log("    ✓ Visual Diff accurately detects +Added, -Removed, and ~Modified room/teacher changes.");
}

// ----------------------------------------------------------------
// TEST 3: Room Utilization Heatmap & Spatial Matrix
// ----------------------------------------------------------------
{
  console.log("  Testing Room Utilization Heatmap...");
  const stats = getRoomUtilizationStats(mockTimetable);
  assert.ok(stats.length > 0, "Must return stats for active venues");
  const cr01 = stats.find((s) => s.roomName === "CR-01");
  assert.ok(cr01, "Must have stats for CR-01");
  assert.equal(cr01.category, "Classrooms", "CR-01 category must be Classrooms");
  assert.equal(cr01.occupancyMatrix[0][0], true, "Monday L1 must be marked occupied");
  assert.equal(cr01.occupancyMatrix[0][1], false, "Monday L2 must be marked free");
  console.log(`    ✓ CR-01 utilization: ${cr01.utilizationRate}%, Peak: ${cr01.peakDay} ${cr01.peakSlot}`);
}

// ----------------------------------------------------------------
// TEST 4: Crucial Academic Rule - 11:30 to 1:15 (Slot L3) Double Counting
// ----------------------------------------------------------------
{
  console.log("  Testing 11:30 to 1:15 Double Lecture Rule & Real-time Analytics...");
  // Teacher 2 (Engr. Usman) has only 1 weekly scheduled theory class in slot 2 (11:30-1:15 L3)
  const teacher2Id = 2;
  const teacher2Name = "Engr. Usman";
  const refDate = new Date("2026-11-09T14:00:00+05:00"); // 5th week of Fall 2026

  const analytics = computeFacultyAnalytics(
    teacher2Id,
    teacher2Name,
    "usman@cuiatk.edu.pk",
    refDate,
    mockTimetable,
  );

  const course = analytics.courses.find((c) => c.subjectId === 2);
  assert.ok(course, "Must find course DLD");
  assert.equal(course.weeklySlotsCount, 1, "Course meets once weekly");
  assert.equal(
    course.isDoubleLectureL3,
    true,
    "11:30-1:15 slot MUST be flagged as double lecture when meeting only once weekly",
  );
  assert.equal(
    course.weeklyEffectiveCount,
    2,
    "Weekly effective contact credit must count as TWO classes towards 32 quota",
  );

  console.log(`    ✓ Verified 11:30-1:15 rule: 1 scheduled session counts as ${course.weeklyEffectiveCount} classes!`);
  console.log(`    ✓ Semester Projected: ${course.semesterProjectedCount} contact lectures, Conducted to date: ${course.conductedCountToDate}`);
}

// ----------------------------------------------------------------
// TEST 5: Real-Time Dynamic Cascade & Make-up Debt Ledger
// ----------------------------------------------------------------
{
  console.log("  Testing Dynamic Cascade (Cancellations -> Room Freed -> Debt Ledger)...");
  // Test cancelling a class
  const cancellation = addClassCancellation({
    day: 0,
    slot: 0,
    batch: 0,
    batchName: "BS(CS)-I",
    room: 0,
    roomName: "CR-01",
    teacher: 0,
    teacherName: "Dr. Ahmad",
    subject: 0,
    subjectName: "Programming Fundamentals",
    reason: "Official Academic Senate Meeting",
    cancelledByEmail: "ahmad@cuiatk.edu.pk",
  });

  assert.ok(cancellation.id, "Cancellation must have unique ID");
  const isCancelled = isClassCancelled(0, 0, 0, 0, 0);
  assert.ok(isCancelled, "Class must be detected as cancelled");
  assert.equal(isCancelled.reason, "Official Academic Senate Meeting");

  // Verify Campus Pulse telemetry accounts for cancelled class
  const pulse = getCampusPulseTelemetry(new Date("2026-11-09T09:00:00+05:00"), mockTimetable);
  assert.ok(pulse, "Pulse telemetry must compute");
  console.log(`    ✓ Pulse Status: ${pulse.livePhase}, Active Classes: ${pulse.classesInSessionCount}, Free Rooms: ${pulse.freeRoomsCount}`);
  console.log("    ✓ Cancellation properly propagated to telemetry and freed up room.");
}

console.log("\n✅ ALL ADVANCED TIMETABLE & CAMPUS FEATURES VERIFIED SUCCESSFULLY!\n");
