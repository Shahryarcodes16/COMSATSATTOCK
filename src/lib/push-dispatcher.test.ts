import test from "node:test";
import assert from "node:assert/strict";
import { dispatchUpcomingClassReminders } from "./push.server.ts";

test("Background Push Dispatcher: handles weekend / off-campus hours gracefully without crashing", async () => {
  // Sunday Date: 2026-11-15 (Sunday)
  const sunday = new Date("2026-11-15T10:00:00+05:00");
  const res = await dispatchUpcomingClassReminders(sunday);

  assert.equal(typeof res.checked, "number");
  assert.equal(res.sent, 0);
  assert.equal(res.skipped, 0);
});

test("Background Push Dispatcher: runs safely on academic weekdays", async () => {
  // Monday Date: 2026-11-16 (Monday at 08:20 AM PKT -> Slot 1 lead threshold)
  const mondayAlertTime = new Date("2026-11-16T08:20:00+05:00");
  const res = await dispatchUpcomingClassReminders(mondayAlertTime);

  assert.equal(typeof res.checked, "number");
  assert.equal(typeof res.sent, "number");
  assert.equal(typeof res.skipped, "number");
});
