import test from "node:test";
import assert from "node:assert/strict";
import {
  rowsToRawTimetable,
  rawToTimetableRows,
  exportTimetableToCsv,
  generateSampleCsvTemplate,
} from "../src/lib/timetable-parser.ts";
import { validateTimetable } from "../src/lib/timetable-validator.ts";
import { computeTimetableDiff } from "../src/lib/timetable-diff.ts";

test("Timetable Validator detects room clashes", () => {
  // Two classes in the same room LH1 on Monday at L1
  const raw = {
    b: ["BS(CS)-I", "BS(SE)-I"],
    r: ["LH1", "CR1"],
    t: ["Dr. Sohail", "Dr. Numan"],
    s: ["ICT", "Physics"],
    e: [
      [0, 0, 0, 0, 0, 0, 0], // Monday L1, BS(CS)-I in LH1
      [0, 0, 1, 0, 1, 1, 0], // Monday L1, BS(SE)-I in LH1 (CLASH!)
    ],
  };

  const result = validateTimetable(raw);
  assert.equal(result.isValid, false);
  assert.equal(result.totalErrors >= 1, true);
  const roomClash = result.clashes.find((c) => c.type === "room_clash");
  assert.ok(roomClash);
  assert.match(roomClash.message, /LH1/);
});

test("Timetable Validator detects teacher double-booking", () => {
  // Same teacher Dr. Sohail scheduled in two different rooms at same time
  const raw = {
    b: ["BS(CS)-I", "BS(SE)-III"],
    r: ["LH1", "CR2"],
    t: ["Dr. Sohail"],
    s: ["Math", "Algorithms"],
    e: [
      [1, 2, 0, 0, 0, 0, 0], // Tuesday L3, Dr. Sohail in LH1
      [1, 2, 1, 1, 0, 1, 0], // Tuesday L3, Dr. Sohail in CR2 (CLASH!)
    ],
  };

  const result = validateTimetable(raw);
  assert.equal(result.isValid, false);
  const teacherClash = result.clashes.find((c) => c.type === "teacher_clash");
  assert.ok(teacherClash);
  assert.match(teacherClash.message, /Dr\. Sohail/);
});

test("Timetable Validator detects batch overlap", () => {
  // Same batch BS(CS)-I scheduled for two classes at same time
  const raw = {
    b: ["BS(CS)-I"],
    r: ["LH1", "CR2"],
    t: ["Dr. Sohail", "Dr. Numan"],
    s: ["Math", "Physics"],
    e: [
      [2, 1, 0, 0, 0, 0, 0], // Wednesday L2, BS(CS)-I
      [2, 1, 0, 1, 1, 1, 0], // Wednesday L2, BS(CS)-I (CLASH!)
    ],
  };

  const result = validateTimetable(raw);
  assert.equal(result.isValid, false);
  const batchClash = result.clashes.find((c) => c.type === "batch_clash");
  assert.ok(batchClash);
  assert.match(batchClash.message, /BS\(CS\)-I/);
});

test("Timetable Validator passes on clean schedule", () => {
  const raw = {
    b: ["BS(CS)-I", "BS(SE)-I"],
    r: ["LH1", "LH2"],
    t: ["Dr. Sohail", "Dr. Numan"],
    s: ["Math", "Physics"],
    e: [
      [0, 0, 0, 0, 0, 0, 0], // Monday L1, BS(CS)-I in LH1 with Dr. Sohail
      [0, 0, 1, 1, 1, 1, 0], // Monday L1, BS(SE)-I in LH2 with Dr. Numan
      [0, 1, 0, 1, 1, 1, 0], // Monday L2, BS(CS)-I in LH2 with Dr. Numan
    ],
  };

  const result = validateTimetable(raw);
  assert.equal(result.isValid, true);
  assert.equal(result.totalErrors, 0);
});

test("Timetable Diff detects added, modified, and removed classes", () => {
  const oldRaw = {
    b: ["BS(CS)-I"],
    r: ["LH1"],
    t: ["Dr. Sohail"],
    s: ["Math"],
    e: [[0, 0, 0, 0, 0, 0, 0]],
  };

  const newRaw = {
    b: ["BS(CS)-I"],
    r: ["LH1", "LH2"],
    t: ["Dr. Sohail", "Dr. Numan"],
    s: ["Math", "Physics"],
    e: [
      [0, 0, 0, 1, 0, 0, 0], // Modified room (LH1 -> LH2)
      [0, 1, 0, 0, 1, 1, 0], // Added new class (Physics)
    ],
  };

  const diff = computeTimetableDiff(oldRaw, newRaw);
  assert.equal(diff.addedCount, 1);
  assert.equal(diff.modifiedCount, 1);
  assert.equal(diff.affectedBatches.includes("BS(CS)-I"), true);
  assert.equal(diff.affectedTeachers.includes("Dr. Numan"), true);
});

test("Timetable Parser exports valid CSV template", () => {
  const template = generateSampleCsvTemplate();
  assert.ok(template.includes("Day,Slot,Time,Batch,Course,Teacher,Room,IsRepeater"));
  assert.ok(template.includes("Monday,L1"));
});
