import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeScheduleToShareString,
  decodeScheduleFromShareString,
  generateQuickShareUrl,
  generateWhatsAppShareLink,
} from "./quick-share.ts";
import type { ClassEntry } from "./schedule.ts";

test("QuickShare: encodes and decodes schedule entries cleanly", () => {
  const sampleEntries: ClassEntry[] = [
    { day: 0, slot: 1, batch: 5, room: 2, teacher: 8, subject: 14, repeater: false },
    { day: 2, slot: 3, batch: 5, room: 4, teacher: 10, subject: 22, repeater: true },
  ];

  const shareCode = encodeScheduleToShareString(sampleEntries, {
    senderName: "Ali Khan",
    batchName: "BCS-4A",
  });

  assert.ok(shareCode && shareCode.length > 0);

  const decoded = decodeScheduleFromShareString(shareCode);
  assert.ok(decoded);
  assert.equal(decoded.senderName, "Ali Khan");
  assert.equal(decoded.batchName, "BCS-4A");
  assert.equal(decoded.entries.length, 2);

  assert.deepEqual(decoded.entries[0], sampleEntries[0]);
  assert.deepEqual(decoded.entries[1], sampleEntries[1]);
});

test("QuickShare: generates valid web and WhatsApp share links", () => {
  const sampleEntries: ClassEntry[] = [
    { day: 1, slot: 2, batch: 3, room: 1, teacher: 4, subject: 9, repeater: false },
  ];

  const webUrl = generateQuickShareUrl(sampleEntries, {
    senderName: "Fatima",
    origin: "https://fortis-comsats.app",
  });

  assert.ok(webUrl.startsWith("https://fortis-comsats.app/?share=") || webUrl.startsWith("https://fortis-comsats.app?share="));

  const waUrl = generateWhatsAppShareLink(sampleEntries, {
    senderName: "Fatima",
    origin: "https://fortis-comsats.app",
  });

  assert.ok(waUrl.startsWith("https://api.whatsapp.com/send?text="));
  assert.ok(waUrl.includes(encodeURIComponent("Fatima")));
  assert.ok(waUrl.includes(encodeURIComponent("FORTIS")));
});

test("QuickShare: handles corrupted string gracefully without crashing", () => {
  const corrupt = decodeScheduleFromShareString("this-is-not-valid-base64-json!@#$%");
  assert.equal(corrupt, null);
});
