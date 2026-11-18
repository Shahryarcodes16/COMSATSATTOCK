/**
 * Server-side Persistence Layer for FYP Management System (Phase 1)
 * Handles Groups, Supervisor Quotas, and Student Requests.
 * Supports PostgreSQL (Neon) with PGLite / JSON disk backup fallback.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dbSource, getSql } from "./db.ts";
import { facultyList, getFacultyByTeacher } from "./faculty.ts";
import type {
  FypFacultySettings,
  FypGroupRecord,
  FypSupervisorRequest,
  FypSupervisorSummary,
} from "./fyp-types.ts";

let tablesEnsured = false;
const FYP_DISK_BACKUP = path.join(os.tmpdir(), "cui_fyp_data_v1.json");

interface FypBackupStore {
  groups: FypGroupRecord[];
  requests: FypSupervisorRequest[];
  facultySettings: FypFacultySettings[];
}

const memoryGroups = new Map<string, FypGroupRecord>();
const memoryRequests = new Map<string, FypSupervisorRequest>();
const memoryFacultySettings = new Map<number, FypFacultySettings>();

function readDiskStore(): FypBackupStore {
  try {
    if (fs.existsSync(FYP_DISK_BACKUP)) {
      const parsed = JSON.parse(fs.readFileSync(FYP_DISK_BACKUP, "utf8"));
      return {
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        facultySettings: Array.isArray(parsed.facultySettings) ? parsed.facultySettings : [],
      };
    }
  } catch {
    // Ignore read errors
  }
  return { groups: [], requests: [], facultySettings: [] };
}

function writeDiskStore() {
  try {
    const payload: FypBackupStore = {
      groups: Array.from(memoryGroups.values()),
      requests: Array.from(memoryRequests.values()),
      facultySettings: Array.from(memoryFacultySettings.values()),
    };
    fs.writeFileSync(FYP_DISK_BACKUP, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Ignore write errors
  }
}

function hydrateFallbackFromDisk() {
  if (memoryGroups.size > 0 || memoryFacultySettings.size > 0) return;
  const store = readDiskStore();
  for (const g of store.groups) memoryGroups.set(g.id, g);
  for (const r of store.requests) memoryRequests.set(r.id, r);
  for (const f of store.facultySettings) memoryFacultySettings.set(f.teacherId, f);
}

// Seed reasonable default research areas for faculty based on their department
function getDefaultResearchAreas(department: string): string[] {
  const dept = department.toLowerCase();
  if (dept.includes("computer science")) {
    return [
      "Artificial Intelligence & Machine Learning",
      "Computer Vision & Image Processing",
      "Web & Mobile Application Engineering",
      "Cyber Security & Digital Forensics",
      "Natural Language Processing (NLP)",
    ];
  }
  if (dept.includes("engineering")) {
    return [
      "Internet of Things (IoT) & Embedded Systems",
      "Robotics & Autonomous Systems",
      "Networks & Wireless Communications",
      "Control Systems",
    ];
  }
  if (dept.includes("management")) {
    return [
      "Data Science & Big Data Analytics",
      "ERP & Enterprise Systems",
      "E-Commerce & Digital Marketing",
      "FinTech & Quantitative Finance",
    ];
  }
  return [
    "Applied Machine Learning",
    "Computational Modelling",
    "Software Architecture",
  ];
}

export async function ensureFypTables() {
  if (tablesEnsured) return;
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();

    // 1. FYP Groups Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_groups (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        domain VARCHAR(120) NOT NULL,
        abstract TEXT NOT NULL,
        leader JSONB NOT NULL,
        members JSONB NOT NULL DEFAULT '[]'::jsonb,
        supervisor_id INTEGER,
        supervisor_name TEXT,
        status VARCHAR(40) NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 2. Supervisor Requests Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_supervisor_requests (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_title TEXT NOT NULL,
        group_domain TEXT NOT NULL,
        leader_name TEXT NOT NULL,
        leader_reg_no TEXT NOT NULL,
        leader_email TEXT NOT NULL,
        member_count INTEGER NOT NULL DEFAULT 1,
        teacher_id INTEGER NOT NULL,
        teacher_name TEXT NOT NULL,
        preference_order INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        faculty_remark TEXT,
        created_at TEXT NOT NULL,
        responded_at TEXT
      )
    `);

    // 3. Faculty FYP Quotas & Research Settings Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_faculty_settings (
        teacher_id INTEGER PRIMARY KEY,
        teacher_name TEXT NOT NULL,
        email TEXT NOT NULL,
        department TEXT NOT NULL,
        max_slots INTEGER NOT NULL DEFAULT 5,
        research_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
        available_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_accepting BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes safely
    try {
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_req_teacher ON fyp_supervisor_requests (teacher_id, status)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_req_group ON fyp_supervisor_requests (group_id, status)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_groups_status ON fyp_groups (status)`);
    } catch {
      // Ignore index duplicate warnings
    }

    tablesEnsured = true;
  } catch (err) {
    console.warn("[fyp.server] Database table initialization warning (using resilient fallback):", err);
    tablesEnsured = true; // Still marked ensured so we don't repeat query failure on every call
  }
}

/**
 * Get or initialize faculty FYP settings and quotas
 */
export async function serverGetFacultyFypSettings(teacherId: number): Promise<FypFacultySettings> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  // Find faculty details from known directory
  const facultyMember = getFacultyByTeacher(teacherId);
  const teacherName = facultyMember?.name || `Teacher #${teacherId}`;
  const email = facultyMember?.email || "";
  const department = facultyMember?.department || "Computer Science";

  // Calculate live accepted count and pending requests
  const allGroups = await serverGetAllFypGroups();
  const acceptedCount = allGroups.filter(
    (g) => g.supervisorId === teacherId && (g.status === "supervisor_accepted" || g.status === "locked"),
  ).length;

  const allRequests = await serverGetAllRequests();
  const pendingCount = allRequests.filter(
    (r) => r.teacherId === teacherId && r.status === "pending",
  ).length;

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM fyp_faculty_settings WHERE teacher_id = $1 LIMIT 1`,
      [teacherId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return {
        teacherId,
        teacherName: String(row.teacher_name || teacherName),
        email: String(row.email || email),
        department: String(row.department || department),
        maxSlots: Number(row.max_slots ?? 5),
        acceptedCount,
        pendingCount,
        researchAreas: Array.isArray(row.research_areas) ? row.research_areas : getDefaultResearchAreas(department),
        availableIdeas: Array.isArray(row.available_ideas) ? row.available_ideas : [],
        isAccepting: row.is_accepting !== false,
        updatedAt: String(row.updated_at || new Date().toISOString()),
      };
    }
  } catch {
    // Fallback below
  }

  // Memory fallback
  const cached = memoryFacultySettings.get(teacherId);
  if (cached) {
    return {
      ...cached,
      acceptedCount,
      pendingCount,
    };
  }

  const initialSettings: FypFacultySettings = {
    teacherId,
    teacherName,
    email,
    department,
    maxSlots: 5,
    acceptedCount,
    pendingCount,
    researchAreas: getDefaultResearchAreas(department),
    availableIdeas: [
      {
        id: `idea-${teacherId}-1`,
        title: "Intelligent Campus Assistant with Multimodal RAG",
        description: "Development of a unified assistant for university students with vector retrieval across syllabi, schedules, and past exams.",
      },
    ],
    isAccepting: true,
    updatedAt: new Date().toISOString(),
  };

  memoryFacultySettings.set(teacherId, initialSettings);
  writeDiskStore();
  return initialSettings;
}

/**
 * Save faculty FYP settings and quotas
 */
export async function serverSaveFacultyFypSettings(data: {
  teacherId: number;
  maxSlots?: number;
  researchAreas?: string[];
  availableIdeas?: { id: string; title: string; description: string }[];
  isAccepting?: boolean;
}): Promise<FypFacultySettings> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const current = await serverGetFacultyFypSettings(data.teacherId);
  const updated: FypFacultySettings = {
    ...current,
    maxSlots: typeof data.maxSlots === "number" ? Math.max(1, Math.min(15, data.maxSlots)) : current.maxSlots,
    researchAreas: Array.isArray(data.researchAreas) ? data.researchAreas : current.researchAreas,
    availableIdeas: Array.isArray(data.availableIdeas) ? data.availableIdeas : current.availableIdeas,
    isAccepting: typeof data.isAccepting === "boolean" ? data.isAccepting : current.isAccepting,
    updatedAt: new Date().toISOString(),
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_faculty_settings 
       (teacher_id, teacher_name, email, department, max_slots, research_areas, available_ideas, is_accepting, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (teacher_id) DO UPDATE SET
         max_slots = EXCLUDED.max_slots,
         research_areas = EXCLUDED.research_areas,
         available_ideas = EXCLUDED.available_ideas,
         is_accepting = EXCLUDED.is_accepting,
         updated_at = EXCLUDED.updated_at`,
      [
        updated.teacherId,
        updated.teacherName,
        updated.email,
        updated.department,
        updated.maxSlots,
        JSON.stringify(updated.researchAreas),
        JSON.stringify(updated.availableIdeas),
        updated.isAccepting,
        updated.updatedAt,
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Save faculty settings database fallback:", err);
  }

  memoryFacultySettings.set(updated.teacherId, updated);
  writeDiskStore();
  return updated;
}

/**
 * Retrieve all registered groups
 */
export async function serverGetAllFypGroups(): Promise<FypGroupRecord[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_groups ORDER BY updated_at DESC`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        domain: String(r.domain),
        abstract: String(r.abstract),
        leader: typeof r.leader === "string" ? JSON.parse(r.leader) : r.leader,
        members: typeof r.members === "string" ? JSON.parse(r.members) : Array.isArray(r.members) ? r.members : [],
        supervisorId: r.supervisor_id !== null && r.supervisor_id !== undefined ? Number(r.supervisor_id) : null,
        supervisorName: r.supervisor_name ? String(r.supervisor_name) : null,
        status: (r.status as any) || "draft",
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryGroups.values());
}

/**
 * Retrieve all supervisor requests
 */
export async function serverGetAllRequests(): Promise<FypSupervisorRequest[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_supervisor_requests ORDER BY created_at DESC`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        groupId: String(r.group_id),
        groupTitle: String(r.group_title),
        groupDomain: String(r.group_domain),
        leaderName: String(r.leader_name),
        leaderRegNo: String(r.leader_reg_no),
        leaderEmail: String(r.leader_email),
        memberCount: Number(r.member_count || 1),
        teacherId: Number(r.teacher_id),
        teacherName: String(r.teacher_name),
        preferenceOrder: Number(r.preference_order || 1),
        status: (r.status as any) || "pending",
        facultyRemark: r.faculty_remark ? String(r.faculty_remark) : null,
        createdAt: String(r.created_at),
        respondedAt: r.responded_at ? String(r.responded_at) : null,
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryRequests.values());
}

/**
 * Find group by student email or registration number
 */
export async function serverGetFypGroupByStudent(identifier: string): Promise<FypGroupRecord | null> {
  const clean = identifier.trim().toLowerCase();
  const groups = await serverGetAllFypGroups();

  for (const group of groups) {
    if (
      group.leader.email?.toLowerCase() === clean ||
      group.leader.regNo?.toLowerCase() === clean ||
      group.leader.studentId?.toLowerCase() === clean
    ) {
      return group;
    }
    for (const m of group.members) {
      if (
        m.email?.toLowerCase() === clean ||
        m.regNo?.toLowerCase() === clean ||
        m.studentId?.toLowerCase() === clean
      ) {
        return group;
      }
    }
  }
  return null;
}

/**
 * Find group by its ID
 */
export async function serverGetFypGroupById(groupId: string): Promise<FypGroupRecord | null> {
  const groups = await serverGetAllFypGroups();
  return groups.find((g) => g.id === groupId) || null;
}

/**
 * Create or update a student FYP group
 */
export async function serverSaveFypGroup(data: {
  id?: string;
  title: string;
  domain: string;
  abstract: string;
  leader: any;
  members: any[];
}): Promise<FypGroupRecord> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const id = data.id || `fyp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const existing = await serverGetFypGroupById(id);

  if (existing && existing.status === "locked") {
    throw new Error("Group is locked after final supervisor assignment. Changes require Coordinator approval.");
  }

  const now = new Date().toISOString();
  const record: FypGroupRecord = {
    id,
    title: data.title.trim(),
    domain: data.domain.trim(),
    abstract: data.abstract.trim(),
    leader: data.leader,
    members: Array.isArray(data.members) ? data.members : [],
    supervisorId: existing ? existing.supervisorId : null,
    supervisorName: existing ? existing.supervisorName : null,
    status: existing ? existing.status : "draft",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_groups 
       (id, title, domain, abstract, leader, members, supervisor_id, supervisor_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         domain = EXCLUDED.domain,
         abstract = EXCLUDED.abstract,
         leader = EXCLUDED.leader,
         members = EXCLUDED.members,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.title,
        record.domain,
        record.abstract,
        JSON.stringify(record.leader),
        JSON.stringify(record.members),
        record.supervisorId,
        record.supervisorName,
        record.status,
        record.createdAt,
        record.updatedAt,
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Save group database fallback:", err);
  }

  memoryGroups.set(record.id, record);
  writeDiskStore();
  return record;
}

/**
 * List available faculty supervisors with live remaining slots, research tags, and ideas
 */
export async function serverGetAvailableSupervisors(department?: string): Promise<FypSupervisorSummary[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  // Filter teachers with valid teacherId
  const eligibleTeachers = facultyList.filter((f) => typeof f.teacherId === "number" && f.teacherId > 0);
  const allGroups = await serverGetAllFypGroups();

  const results: FypSupervisorSummary[] = [];

  for (const faculty of eligibleTeachers) {
    if (department && department !== "All" && faculty.department !== department) {
      continue;
    }

    const teacherId = faculty.teacherId as number;
    const settings = await serverGetFacultyFypSettings(teacherId);

    // Live active supervised count
    const acceptedCount = allGroups.filter(
      (g) => g.supervisorId === teacherId && (g.status === "supervisor_accepted" || g.status === "locked"),
    ).length;

    const remainingSlots = Math.max(0, settings.maxSlots - acceptedCount);
    const isAvailable = settings.isAccepting && remainingSlots > 0;

    results.push({
      teacherId,
      teacherName: faculty.name,
      email: faculty.email,
      department: faculty.department,
      maxSlots: settings.maxSlots,
      acceptedCount,
      remainingSlots,
      isAvailable,
      researchAreas: settings.researchAreas,
      availableIdeas: settings.availableIdeas,
    });
  }

  // Sort by available remaining slots descending, then name
  return results.sort((a, b) => b.remainingSlots - a.remainingSlots || a.teacherName.localeCompare(b.teacherName));
}

/**
 * Submit supervisor request from a student group
 */
export async function serverSubmitSupervisorRequest(data: {
  groupId: string;
  teacherId: number;
  preferenceOrder: number;
  studentEmail: string;
}): Promise<FypSupervisorRequest> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const group = await serverGetFypGroupById(data.groupId);
  if (!group) {
    throw new Error("Group not found");
  }

  if (group.status === "supervisor_accepted" || group.status === "locked") {
    throw new Error("This group already has an assigned supervisor.");
  }

  // Check supervisor capacity
  const settings = await serverGetFacultyFypSettings(data.teacherId);
  if (!settings.isAccepting) {
    throw new Error(`${settings.teacherName} is currently not accepting new supervision requests.`);
  }

  if (settings.acceptedCount >= settings.maxSlots) {
    throw new Error(`${settings.teacherName} has reached their maximum quota limit (${settings.maxSlots} groups).`);
  }

  // Check if a pending request for this teacher already exists
  const groupRequests = await serverGetSupervisorRequestsForGroup(data.groupId);
  const existingPending = groupRequests.find(
    (r) => r.teacherId === data.teacherId && r.status === "pending",
  );
  if (existingPending) {
    throw new Error(`A pending supervision request to ${settings.teacherName} is already submitted.`);
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newRequest: FypSupervisorRequest = {
    id: requestId,
    groupId: group.id,
    groupTitle: group.title,
    groupDomain: group.domain,
    leaderName: group.leader.fullName,
    leaderRegNo: group.leader.regNo,
    leaderEmail: data.studentEmail || group.leader.email,
    memberCount: (group.members?.length || 0) + 1,
    teacherId: data.teacherId,
    teacherName: settings.teacherName,
    preferenceOrder: data.preferenceOrder || 1,
    status: "pending",
    createdAt: now,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_supervisor_requests 
       (id, group_id, group_title, group_domain, leader_name, leader_reg_no, leader_email, member_count, teacher_id, teacher_name, preference_order, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newRequest.id,
        newRequest.groupId,
        newRequest.groupTitle,
        newRequest.groupDomain,
        newRequest.leaderName,
        newRequest.leaderRegNo,
        newRequest.leaderEmail,
        newRequest.memberCount,
        newRequest.teacherId,
        newRequest.teacherName,
        newRequest.preferenceOrder,
        newRequest.status,
        newRequest.createdAt,
      ],
    );

    // Update group status to supervisor_pending
    group.status = "supervisor_pending";
    group.updatedAt = now;
    await sql.query(`UPDATE fyp_groups SET status = 'supervisor_pending', updated_at = $1 WHERE id = $2`, [
      now,
      group.id,
    ]);
  } catch (err) {
    console.warn("[fyp.server] Submit request database fallback:", err);
  }

  memoryRequests.set(newRequest.id, newRequest);
  group.status = "supervisor_pending";
  group.updatedAt = now;
  memoryGroups.set(group.id, group);
  writeDiskStore();

  return newRequest;
}

/**
 * Get all requests submitted by a specific group
 */
export async function serverGetSupervisorRequestsForGroup(groupId: string): Promise<FypSupervisorRequest[]> {
  const all = await serverGetAllRequests();
  return all.filter((r) => r.groupId === groupId).sort((a, b) => a.preferenceOrder - b.preferenceOrder);
}

/**
 * Get faculty deck info: pending incoming requests, accepted groups, and quotas
 */
export async function serverGetFacultyFypRequests(teacherId: number): Promise<{
  pendingRequests: FypSupervisorRequest[];
  acceptedGroups: FypGroupRecord[];
  settings: FypFacultySettings;
}> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const settings = await serverGetFacultyFypSettings(teacherId);
  const allRequests = await serverGetAllRequests();
  const pendingRequests = allRequests.filter(
    (r) => r.teacherId === teacherId && r.status === "pending",
  );

  const allGroups = await serverGetAllFypGroups();
  const acceptedGroups = allGroups.filter(
    (g) => g.supervisorId === teacherId && (g.status === "supervisor_accepted" || g.status === "locked"),
  );

  return {
    pendingRequests,
    acceptedGroups,
    settings,
  };
}

/**
 * Respond to a supervision request (Accept or Decline with remarks)
 */
export async function serverRespondSupervisorRequest(data: {
  requestId: string;
  teacherId: number;
  decision: "accepted" | "declined";
  remark?: string;
}): Promise<{
  success: boolean;
  error?: string;
  request?: FypSupervisorRequest;
  group?: FypGroupRecord;
}> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const allRequests = await serverGetAllRequests();
  const req = allRequests.find((r) => r.id === data.requestId);
  if (!req) {
    return { success: false, error: "Request not found" };
  }

  if (req.teacherId !== data.teacherId) {
    return { success: false, error: "Unauthorized: Request does not belong to this teacher." };
  }

  if (req.status !== "pending") {
    return { success: false, error: `Request has already been ${req.status}.` };
  }

  const group = await serverGetFypGroupById(req.groupId);
  if (!group) {
    return { success: false, error: "Associated student group was not found." };
  }

  const now = new Date().toISOString();

  if (data.decision === "accepted") {
    // Quota capacity invariant check
    const settings = await serverGetFacultyFypSettings(data.teacherId);
    if (settings.acceptedCount >= settings.maxSlots) {
      return {
        success: false,
        error: `Cannot accept: Your maximum supervision quota of ${settings.maxSlots} groups is full.`,
      };
    }

    req.status = "accepted";
    req.facultyRemark = data.remark || "Accepted. Welcome to the FYP cohort!";
    req.respondedAt = now;

    // Bind group to this supervisor
    group.supervisorId = data.teacherId;
    group.supervisorName = req.teacherName;
    group.status = "supervisor_accepted";
    group.updatedAt = now;

    // Cancel other pending requests from this group
    const otherRequests = allRequests.filter((r) => r.groupId === group.id && r.id !== req.id && r.status === "pending");
    for (const other of otherRequests) {
      other.status = "cancelled";
      other.respondedAt = now;
      other.facultyRemark = `Automatically cancelled because group was accepted by ${req.teacherName}.`;
      memoryRequests.set(other.id, other);
    }

    try {
      const sql = await getSql();
      await sql.query(
        `UPDATE fyp_supervisor_requests SET status = 'accepted', faculty_remark = $1, responded_at = $2 WHERE id = $3`,
        [req.facultyRemark, req.respondedAt, req.id],
      );
      await sql.query(
        `UPDATE fyp_groups SET supervisor_id = $1, supervisor_name = $2, status = 'supervisor_accepted', updated_at = $3 WHERE id = $4`,
        [group.supervisorId, group.supervisorName, group.updatedAt, group.id],
      );
      await sql.query(
        `UPDATE fyp_supervisor_requests SET status = 'cancelled', responded_at = $1, faculty_remark = $2 WHERE group_id = $3 AND id != $4 AND status = 'pending'`,
        [now, `Automatically cancelled because group was accepted by ${req.teacherName}.`, group.id, req.id],
      );
    } catch (err) {
      console.warn("[fyp.server] Accept request database fallback:", err);
    }

    memoryRequests.set(req.id, req);
    memoryGroups.set(group.id, group);
    writeDiskStore();

    return { success: true, request: req, group };
  } else {
    // Decline request
    req.status = "declined";
    req.facultyRemark = data.remark || "Declined due to domain mismatch or slot capacity.";
    req.respondedAt = now;

    // Check if group has any other pending requests
    const remainingPending = allRequests.filter(
      (r) => r.groupId === group.id && r.id !== req.id && r.status === "pending",
    );
    if (remainingPending.length === 0) {
      group.status = "draft";
      group.updatedAt = now;
    }

    try {
      const sql = await getSql();
      await sql.query(
        `UPDATE fyp_supervisor_requests SET status = 'declined', faculty_remark = $1, responded_at = $2 WHERE id = $3`,
        [req.facultyRemark, req.respondedAt, req.id],
      );
      if (remainingPending.length === 0) {
        await sql.query(`UPDATE fyp_groups SET status = 'draft', updated_at = $1 WHERE id = $2`, [now, group.id]);
      }
    } catch (err) {
      console.warn("[fyp.server] Decline request database fallback:", err);
    }

    memoryRequests.set(req.id, req);
    if (remainingPending.length === 0) {
      memoryGroups.set(group.id, group);
    }
    writeDiskStore();

    return { success: true, request: req, group };
  }
}
