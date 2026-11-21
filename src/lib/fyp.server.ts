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
  FypDefensePanel,
  FypDefenseRecommendation,
  FypDefenseResultSummary,
  FypDefenseRubricCriterion,
  FypDefenseSchedule,
  FypDefenseStatus,
  FypDocumentCategory,
  FypDocumentComment,
  FypFacultySettings,
  FypGroupProgressSummary,
  FypGroupRecord,
  FypMeetingLog,
  FypMeetingStatus,
  FypMilestone,
  FypMilestoneKey,
  FypMilestoneStatus,
  FypMilestoneSubmission,
  FypPanelMember,
  FypPanelistEvaluation,
  FypProjectDocument,
  FypStudentScore,
  FypSupervisorRequest,
  FypSupervisorSummary,
} from "./fyp-types.ts";
import { DEFAULT_DEFENSE_RUBRIC } from "./fyp-types.ts";

let tablesEnsured = false;
const FYP_DISK_BACKUP = path.join(os.tmpdir(), "cui_fyp_data_v1.json");

interface FypBackupStore {
  groups: FypGroupRecord[];
  requests: FypSupervisorRequest[];
  facultySettings: FypFacultySettings[];
  milestones: FypMilestone[];
  meetingLogs: FypMeetingLog[];
  documents: FypProjectDocument[];
  defensePanels: FypDefensePanel[];
  defenseSchedules: FypDefenseSchedule[];
  defenseEvaluations: FypPanelistEvaluation[];
  defensePublications: Record<string, { isPublished: boolean; publishedAt: string; publishedBy: string }>;
}

const memoryGroups = new Map<string, FypGroupRecord>();
const memoryRequests = new Map<string, FypSupervisorRequest>();
const memoryFacultySettings = new Map<number, FypFacultySettings>();
const memoryMilestones = new Map<string, FypMilestone>();
const memoryMeetingLogs = new Map<string, FypMeetingLog>();
const memoryDocuments = new Map<string, FypProjectDocument>();
const memoryPanels = new Map<string, FypDefensePanel>();
const memorySchedules = new Map<string, FypDefenseSchedule>();
const memoryEvaluations = new Map<string, FypPanelistEvaluation>();
const memoryPublications = new Map<string, { isPublished: boolean; publishedAt: string; publishedBy: string }>();

function readDiskStore(): FypBackupStore {
  try {
    if (fs.existsSync(FYP_DISK_BACKUP)) {
      const parsed = JSON.parse(fs.readFileSync(FYP_DISK_BACKUP, "utf8"));
      return {
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        facultySettings: Array.isArray(parsed.facultySettings) ? parsed.facultySettings : [],
        milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
        meetingLogs: Array.isArray(parsed.meetingLogs) ? parsed.meetingLogs : [],
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        defensePanels: Array.isArray(parsed.defensePanels) ? parsed.defensePanels : [],
        defenseSchedules: Array.isArray(parsed.defenseSchedules) ? parsed.defenseSchedules : [],
        defenseEvaluations: Array.isArray(parsed.defenseEvaluations) ? parsed.defenseEvaluations : [],
        defensePublications: typeof parsed.defensePublications === "object" && parsed.defensePublications !== null ? parsed.defensePublications : {},
      };
    }
  } catch {
    // Ignore read errors
  }
  return {
    groups: [],
    requests: [],
    facultySettings: [],
    milestones: [],
    meetingLogs: [],
    documents: [],
    defensePanels: [],
    defenseSchedules: [],
    defenseEvaluations: [],
    defensePublications: {},
  };
}

function writeDiskStore() {
  try {
    const pubs: Record<string, { isPublished: boolean; publishedAt: string; publishedBy: string }> = {};
    for (const [k, v] of memoryPublications.entries()) {
      pubs[k] = v;
    }
    const payload: FypBackupStore = {
      groups: Array.from(memoryGroups.values()),
      requests: Array.from(memoryRequests.values()),
      facultySettings: Array.from(memoryFacultySettings.values()),
      milestones: Array.from(memoryMilestones.values()),
      meetingLogs: Array.from(memoryMeetingLogs.values()),
      documents: Array.from(memoryDocuments.values()),
      defensePanels: Array.from(memoryPanels.values()),
      defenseSchedules: Array.from(memorySchedules.values()),
      defenseEvaluations: Array.from(memoryEvaluations.values()),
      defensePublications: pubs,
    };
    fs.writeFileSync(FYP_DISK_BACKUP, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Ignore write errors
  }
}

function hydrateFallbackFromDisk() {
  if (memoryGroups.size > 0 || memoryFacultySettings.size > 0 || memoryMilestones.size > 0 || memoryPanels.size > 0) return;
  const store = readDiskStore();
  for (const g of store.groups) memoryGroups.set(g.id, g);
  for (const r of store.requests) memoryRequests.set(r.id, r);
  for (const f of store.facultySettings) memoryFacultySettings.set(f.teacherId, f);
  for (const m of store.milestones) memoryMilestones.set(m.id, m);
  for (const l of store.meetingLogs) memoryMeetingLogs.set(l.id, l);
  for (const d of store.documents) memoryDocuments.set(d.id, d);
  for (const p of store.defensePanels) memoryPanels.set(p.id, p);
  for (const s of store.defenseSchedules) memorySchedules.set(s.id, s);
  for (const e of store.defenseEvaluations) memoryEvaluations.set(e.id, e);
  for (const [k, v] of Object.entries(store.defensePublications || {})) {
    memoryPublications.set(k, v);
  }
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

    // 4. FYP Milestones Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_milestones (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        key VARCHAR(40) NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline TEXT NOT NULL,
        weightage INTEGER NOT NULL DEFAULT 10,
        status VARCHAR(40) NOT NULL DEFAULT 'not_started',
        supervisor_feedback TEXT,
        approved_at TEXT,
        submissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TEXT NOT NULL
      )
    `);

    // 5. FYP Meeting Logs Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_meeting_logs (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        meeting_date TEXT NOT NULL,
        scheduled_by VARCHAR(30) NOT NULL,
        scheduler_name TEXT NOT NULL,
        attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
        discussion_points TEXT NOT NULL,
        action_items TEXT NOT NULL,
        next_meeting_date TEXT,
        status VARCHAR(40) NOT NULL DEFAULT 'pending_confirmation',
        supervisor_notes TEXT,
        confirmed_at TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // 6. FYP Documents Repository Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_documents (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        category VARCHAR(40) NOT NULL,
        title TEXT NOT NULL,
        document_url TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        uploaded_by TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        file_size_label TEXT,
        plagiarism_score INTEGER,
        ai_score INTEGER,
        similarity_status VARCHAR(30),
        comments JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `);

    // 7. FYP Defense Panels Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_defense_panels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        members JSONB NOT NULL DEFAULT '[]'::jsonb,
        assigned_group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TEXT NOT NULL
      )
    `);

    // 8. FYP Defense Schedules Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_defense_schedules (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_title TEXT NOT NULL,
        group_domain TEXT NOT NULL,
        defense_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        venue TEXT NOT NULL,
        panel_id TEXT NOT NULL,
        panel_name TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        reschedule_reason TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // 9. FYP Defense Evaluations Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_defense_evaluations (
        id TEXT PRIMARY KEY,
        panel_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        panelist_id INTEGER NOT NULL,
        panelist_name TEXT NOT NULL,
        group_criterion_scores JSONB NOT NULL,
        student_scores JSONB NOT NULL,
        total_score NUMERIC NOT NULL,
        recommendation VARCHAR(40) NOT NULL,
        remarks TEXT,
        submitted_at TEXT NOT NULL,
        is_locked BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    // 10. FYP Defense Publications Table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS fyp_defense_publications (
        group_id TEXT PRIMARY KEY,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TEXT,
        published_by TEXT
      )
    `);

    // Create indexes safely
    try {
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_req_teacher ON fyp_supervisor_requests (teacher_id, status)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_req_group ON fyp_supervisor_requests (group_id, status)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_groups_status ON fyp_groups (status)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_milestones_group ON fyp_milestones (group_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_meetings_group ON fyp_meeting_logs (group_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_documents_group ON fyp_documents (group_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_schedules_group ON fyp_defense_schedules (group_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_schedules_panel ON fyp_defense_schedules (panel_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_fyp_evals_group ON fyp_defense_evaluations (group_id)`);
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

    // Auto-seed default milestones for the accepted group
    await serverSeedDefaultMilestones(group.id);

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

/**
 * =========================================================================
 * PHASE 2: MILESTONES, MEETINGS & DOCUMENT REPOSITORY
 * =========================================================================
 */

function calculateTurnitinSimilarity(seed: string): {
  plagiarismScore: number;
  aiScore: number;
  similarityStatus: "passed" | "flagged";
} {
  // Deterministic calculation based on string hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const plagiarismScore = 4 + (positiveHash % 16); // 4% to 19%
  const aiScore = 2 + ((positiveHash >> 2) % 10); // 2% to 11%
  const similarityStatus = plagiarismScore <= 19 ? "passed" : "flagged";
  return { plagiarismScore, aiScore, similarityStatus };
}

/**
 * Seed default 6th/7th semester milestones for a group
 */
export async function serverSeedDefaultMilestones(groupId: string): Promise<FypMilestone[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const existing = await serverGetGroupMilestones(groupId, false);
  if (existing.length > 0) return existing;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const defaultDefs: Array<{
    key: FypMilestoneKey;
    title: string;
    description: string;
    daysFromNow: number;
    weightage: number;
  }> = [
    {
      key: "proposal",
      title: "Project Proposal & Problem Formulation",
      description: "Define comprehensive problem statement, literature background, project scope, proposed architecture, and expected deliverables.",
      daysFromNow: 14,
      weightage: 10,
    },
    {
      key: "srs",
      title: "Software / System Requirements Specification (SRS)",
      description: "Complete IEEE 830 compliant SRS documentation covering functional & non-functional requirements, use case diagrams, and user personas.",
      daysFromNow: 35,
      weightage: 15,
    },
    {
      key: "design",
      title: "System Architecture & High-Level Design",
      description: "Detailed system architecture, database ER diagrams, API sequence diagrams, component interfaces, and UI/UX wireframes.",
      daysFromNow: 60,
      weightage: 15,
    },
    {
      key: "prototype",
      title: "Alpha Prototype / Mid-Term Working Demo",
      description: "Functional MVP demonstration with core backend pipelines, database persistence, and preliminary frontend workflows.",
      daysFromNow: 90,
      weightage: 20,
    },
    {
      key: "progress_report",
      title: "Progress Report & Evaluation Draft",
      description: "Comprehensive progress documentation for internal committee review detailing completed sprint velocity, test coverage, and remaining tasks.",
      daysFromNow: 120,
      weightage: 15,
    },
    {
      key: "final_report",
      title: "Final FYP Book & Source Code Deliverables",
      description: "Full final project book with camera-ready formatting, user manual, deployment guidelines, test reports, and tagged GitHub repository release.",
      daysFromNow: 150,
      weightage: 25,
    },
  ];

  const seeded: FypMilestone[] = [];

  for (const def of defaultDefs) {
    const id = `ms-${groupId}-${def.key}`;
    const deadline = new Date(now + def.daysFromNow * dayMs).toISOString();
    const milestone: FypMilestone = {
      id,
      groupId,
      key: def.key,
      title: def.title,
      description: def.description,
      deadline,
      weightage: def.weightage,
      status: "not_started",
      submissions: [],
      updatedAt: new Date(now).toISOString(),
    };

    try {
      const sql = await getSql();
      await sql.query(
        `INSERT INTO fyp_milestones 
         (id, group_id, key, title, description, deadline, weightage, status, submissions, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          milestone.id,
          milestone.groupId,
          milestone.key,
          milestone.title,
          milestone.description,
          milestone.deadline,
          milestone.weightage,
          milestone.status,
          JSON.stringify(milestone.submissions),
          milestone.updatedAt,
        ],
      );
    } catch (err) {
      console.warn("[fyp.server] Seed milestone database fallback:", err);
    }

    memoryMilestones.set(milestone.id, milestone);
    seeded.push(milestone);
  }

  writeDiskStore();
  return seeded;
}

/**
 * Get all milestones for a group
 */
export async function serverGetGroupMilestones(groupId: string, autoSeed = true): Promise<FypMilestone[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM fyp_milestones WHERE group_id = $1 ORDER BY deadline ASC`,
      [groupId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        groupId: String(r.group_id),
        key: r.key as FypMilestoneKey,
        title: String(r.title),
        description: String(r.description),
        deadline: String(r.deadline),
        weightage: Number(r.weightage || 10),
        status: (r.status as FypMilestoneStatus) || "not_started",
        supervisorFeedback: r.supervisor_feedback ? String(r.supervisor_feedback) : null,
        approvedAt: r.approved_at ? String(r.approved_at) : null,
        submissions: typeof r.submissions === "string" ? JSON.parse(r.submissions) : Array.isArray(r.submissions) ? r.submissions : [],
        updatedAt: String(r.updated_at),
      }));
    }
  } catch {
    // Fallback
  }

  const memoryList = Array.from(memoryMilestones.values()).filter((m) => m.groupId === groupId);
  if (memoryList.length > 0) return memoryList;

  if (autoSeed) {
    return await serverSeedDefaultMilestones(groupId);
  }
  return [];
}

/**
 * Submit milestone work (supports re-submission / versioning)
 */
export async function serverSubmitMilestone(data: {
  groupId: string;
  milestoneId: string;
  documentUrl: string;
  fileName: string;
  changeSummary?: string;
  submittedBy: string;
}): Promise<FypMilestone> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const milestones = await serverGetGroupMilestones(data.groupId);
  const milestone = milestones.find((m) => m.id === data.milestoneId || m.key === data.milestoneId);
  if (!milestone) {
    throw new Error("Milestone not found");
  }

  const nextVersion = (milestone.submissions?.length || 0) + 1;
  const now = new Date().toISOString();
  const sim = calculateTurnitinSimilarity(`${data.fileName}-${nextVersion}-${data.submittedBy}`);

  const submission: FypMilestoneSubmission = {
    id: `sub-${Date.now()}-${nextVersion}`,
    version: nextVersion,
    documentUrl: data.documentUrl.trim(),
    fileName: data.fileName.trim(),
    changeSummary: data.changeSummary?.trim() || (nextVersion === 1 ? "Initial submission" : `Draft revision v${nextVersion}`),
    submittedBy: data.submittedBy,
    submittedAt: now,
    plagiarismScore: sim.plagiarismScore,
    aiScore: sim.aiScore,
    similarityStatus: sim.similarityStatus,
  };

  milestone.submissions = [...(milestone.submissions || []), submission];
  milestone.status = "submitted";
  milestone.updatedAt = now;

  try {
    const sql = await getSql();
    await sql.query(
      `UPDATE fyp_milestones 
       SET status = 'submitted', submissions = $1, updated_at = $2 
       WHERE id = $3`,
      [JSON.stringify(milestone.submissions), milestone.updatedAt, milestone.id],
    );
  } catch (err) {
    console.warn("[fyp.server] Submit milestone database fallback:", err);
  }

  memoryMilestones.set(milestone.id, milestone);
  writeDiskStore();
  return milestone;
}

/**
 * Supervisor reviews a submitted milestone (Approve or Request Revision)
 */
export async function serverReviewMilestone(data: {
  milestoneId: string;
  supervisorId: number;
  decision: "approved" | "revision_requested";
  feedback?: string;
}): Promise<FypMilestone> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  let milestone: FypMilestone | null = null;
  for (const m of memoryMilestones.values()) {
    if (m.id === data.milestoneId) {
      milestone = m;
      break;
    }
  }

  if (!milestone) {
    try {
      const sql = await getSql();
      const rows = await sql.query<any>(`SELECT * FROM fyp_milestones WHERE id = $1 LIMIT 1`, [data.milestoneId]);
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        milestone = {
          id: String(r.id),
          groupId: String(r.group_id),
          key: r.key as FypMilestoneKey,
          title: String(r.title),
          description: String(r.description),
          deadline: String(r.deadline),
          weightage: Number(r.weightage),
          status: r.status as FypMilestoneStatus,
          supervisorFeedback: r.supervisor_feedback,
          approvedAt: r.approved_at,
          submissions: typeof r.submissions === "string" ? JSON.parse(r.submissions) : r.submissions,
          updatedAt: String(r.updated_at),
        };
      }
    } catch {
      // Fallback
    }
  }

  if (!milestone) {
    throw new Error("Milestone not found for review");
  }

  const now = new Date().toISOString();
  milestone.status = data.decision === "approved" ? "approved" : "revision_requested";
  milestone.supervisorFeedback = data.feedback?.trim() || (data.decision === "approved" ? "Approved by supervisor." : "Please revise according to supervision notes.");
  if (data.decision === "approved") {
    milestone.approvedAt = now;
  }
  milestone.updatedAt = now;

  try {
    const sql = await getSql();
    await sql.query(
      `UPDATE fyp_milestones 
       SET status = $1, supervisor_feedback = $2, approved_at = $3, updated_at = $4 
       WHERE id = $5`,
      [milestone.status, milestone.supervisorFeedback, milestone.approvedAt || null, milestone.updatedAt, milestone.id],
    );
  } catch (err) {
    console.warn("[fyp.server] Review milestone database fallback:", err);
  }

  memoryMilestones.set(milestone.id, milestone);
  writeDiskStore();
  return milestone;
}

/**
 * Get overall progress summary for a group
 */
export async function serverGetGroupProgressSummary(groupId: string): Promise<FypGroupProgressSummary> {
  const milestones = await serverGetGroupMilestones(groupId);
  const meetings = await serverGetMeetingLogs(groupId);

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === "approved").length;
  const percentComplete = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyMeetings = meetings.filter((m) => {
    return m.meetingDate.startsWith(currentMonthKey) && m.status === "confirmed";
  });
  const monthlyMeetingCount = monthlyMeetings.length;
  const isMeetingRequirementMet = monthlyMeetingCount >= 2;

  // Next active milestone & deadline
  const activeMilestone = milestones.find((m) => m.status !== "approved") || null;
  const nextDeadline = activeMilestone?.deadline || null;

  // On-track if no pending milestone's deadline has passed
  let isOnTrack = true;
  for (const m of milestones) {
    if (m.status !== "approved" && new Date(m.deadline) < now) {
      isOnTrack = false;
      break;
    }
  }

  return {
    groupId,
    completedMilestones,
    totalMilestones,
    percentComplete,
    isOnTrack,
    activeMilestoneTitle: activeMilestone?.title || "All Milestones Completed!",
    nextDeadline,
    monthlyMeetingCount,
    isMeetingRequirementMet,
  };
}

/**
 * Get meeting logs for a group
 */
export async function serverGetMeetingLogs(groupId: string): Promise<FypMeetingLog[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM fyp_meeting_logs WHERE group_id = $1 ORDER BY meeting_date DESC, created_at DESC`,
      [groupId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        groupId: String(r.group_id),
        meetingDate: String(r.meeting_date),
        scheduledBy: r.scheduled_by as any,
        schedulerName: String(r.scheduler_name),
        attendees: typeof r.attendees === "string" ? JSON.parse(r.attendees) : Array.isArray(r.attendees) ? r.attendees : [],
        discussionPoints: String(r.discussion_points),
        actionItems: String(r.action_items),
        nextMeetingDate: r.next_meeting_date ? String(r.next_meeting_date) : null,
        status: (r.status as FypMeetingStatus) || "pending_confirmation",
        supervisorNotes: r.supervisor_notes ? String(r.supervisor_notes) : null,
        confirmedAt: r.confirmed_at ? String(r.confirmed_at) : null,
        createdAt: String(r.created_at),
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryMeetingLogs.values())
    .filter((l) => l.groupId === groupId)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

/**
 * Create a new meeting log (by student or supervisor)
 */
export async function serverCreateMeetingLog(data: {
  groupId: string;
  meetingDate: string;
  scheduledBy: "student" | "supervisor";
  schedulerName: string;
  attendees: string[];
  discussionPoints: string;
  actionItems: string;
  nextMeetingDate?: string;
}): Promise<FypMeetingLog> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const id = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const log: FypMeetingLog = {
    id,
    groupId: data.groupId,
    meetingDate: data.meetingDate,
    scheduledBy: data.scheduledBy,
    schedulerName: data.schedulerName,
    attendees: Array.isArray(data.attendees) ? data.attendees : [],
    discussionPoints: data.discussionPoints.trim(),
    actionItems: data.actionItems.trim(),
    nextMeetingDate: data.nextMeetingDate || null,
    status: data.scheduledBy === "supervisor" ? "confirmed" : "pending_confirmation",
    confirmedAt: data.scheduledBy === "supervisor" ? now : null,
    createdAt: now,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_meeting_logs 
       (id, group_id, meeting_date, scheduled_by, scheduler_name, attendees, discussion_points, action_items, next_meeting_date, status, confirmed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        log.id,
        log.groupId,
        log.meetingDate,
        log.scheduledBy,
        log.schedulerName,
        JSON.stringify(log.attendees),
        log.discussionPoints,
        log.actionItems,
        log.nextMeetingDate,
        log.status,
        log.confirmedAt,
        log.createdAt,
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Create meeting log database fallback:", err);
  }

  memoryMeetingLogs.set(log.id, log);
  writeDiskStore();
  return log;
}

/**
 * Supervisor confirms meeting minutes
 */
export async function serverConfirmMeetingLog(data: {
  logId: string;
  supervisorId: number;
  notes?: string;
}): Promise<FypMeetingLog> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  let log = memoryMeetingLogs.get(data.logId);
  if (!log) {
    try {
      const sql = await getSql();
      const rows = await sql.query<any>(`SELECT * FROM fyp_meeting_logs WHERE id = $1 LIMIT 1`, [data.logId]);
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        log = {
          id: String(r.id),
          groupId: String(r.group_id),
          meetingDate: String(r.meeting_date),
          scheduledBy: r.scheduled_by as any,
          schedulerName: String(r.scheduler_name),
          attendees: typeof r.attendees === "string" ? JSON.parse(r.attendees) : r.attendees,
          discussionPoints: String(r.discussion_points),
          actionItems: String(r.action_items),
          nextMeetingDate: r.next_meeting_date,
          status: r.status as FypMeetingStatus,
          supervisorNotes: r.supervisor_notes,
          confirmedAt: r.confirmed_at,
          createdAt: String(r.created_at),
        };
      }
    } catch {
      // Fallback
    }
  }

  if (!log) {
    throw new Error("Meeting log not found");
  }

  const now = new Date().toISOString();
  log.status = "confirmed";
  log.supervisorNotes = data.notes?.trim() || "Meeting minutes confirmed by supervisor.";
  log.confirmedAt = now;

  try {
    const sql = await getSql();
    await sql.query(
      `UPDATE fyp_meeting_logs 
       SET status = 'confirmed', supervisor_notes = $1, confirmed_at = $2 
       WHERE id = $3`,
      [log.supervisorNotes, log.confirmedAt, log.id],
    );
  } catch (err) {
    console.warn("[fyp.server] Confirm meeting log database fallback:", err);
  }

  memoryMeetingLogs.set(log.id, log);
  writeDiskStore();
  return log;
}

/**
 * Get project documents for a group
 */
export async function serverGetDocuments(groupId: string): Promise<FypProjectDocument[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM fyp_documents WHERE group_id = $1 ORDER BY uploaded_at DESC`,
      [groupId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        groupId: String(r.group_id),
        category: r.category as FypDocumentCategory,
        title: String(r.title),
        documentUrl: String(r.document_url),
        version: Number(r.version || 1),
        uploadedBy: String(r.uploaded_by),
        uploadedAt: String(r.uploaded_at),
        fileSizeLabel: r.file_size_label ? String(r.file_size_label) : undefined,
        plagiarismScore: r.plagiarism_score !== null ? Number(r.plagiarism_score) : undefined,
        aiScore: r.ai_score !== null ? Number(r.ai_score) : undefined,
        similarityStatus: r.similarity_status as any,
        comments: typeof r.comments === "string" ? JSON.parse(r.comments) : Array.isArray(r.comments) ? r.comments : [],
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryDocuments.values())
    .filter((d) => d.groupId === groupId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * Upload a project document or code repository link
 */
export async function serverUploadDocument(data: {
  groupId: string;
  category: FypDocumentCategory;
  title: string;
  documentUrl: string;
  uploadedBy: string;
  fileSizeLabel?: string;
}): Promise<FypProjectDocument> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const allDocs = await serverGetDocuments(data.groupId);
  const matchingCategory = allDocs.filter((d) => d.category === data.category);
  const version = matchingCategory.length + 1;

  const id = `doc-${Date.now()}-${version}`;
  const now = new Date().toISOString();
  const sim = calculateTurnitinSimilarity(`${data.title}-${data.category}-${version}`);

  const doc: FypProjectDocument = {
    id,
    groupId: data.groupId,
    category: data.category,
    title: data.title.trim(),
    documentUrl: data.documentUrl.trim(),
    version,
    uploadedBy: data.uploadedBy,
    uploadedAt: now,
    fileSizeLabel: data.fileSizeLabel || "Cloud File",
    plagiarismScore: sim.plagiarismScore,
    aiScore: sim.aiScore,
    similarityStatus: sim.similarityStatus,
    comments: [],
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_documents 
       (id, group_id, category, title, document_url, version, uploaded_by, uploaded_at, file_size_label, plagiarism_score, ai_score, similarity_status, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        doc.id,
        doc.groupId,
        doc.category,
        doc.title,
        doc.documentUrl,
        doc.version,
        doc.uploadedBy,
        doc.uploadedAt,
        doc.fileSizeLabel,
        doc.plagiarismScore,
        doc.aiScore,
        doc.similarityStatus,
        JSON.stringify(doc.comments),
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Upload document database fallback:", err);
  }

  memoryDocuments.set(doc.id, doc);
  writeDiskStore();
  return doc;
}

/**
 * Add inline feedback comment on a document
 */
export async function serverAddDocumentComment(data: {
  documentId: string;
  authorName: string;
  authorRole: "supervisor" | "student";
  text: string;
}): Promise<FypProjectDocument> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  let doc = memoryDocuments.get(data.documentId);
  if (!doc) {
    try {
      const sql = await getSql();
      const rows = await sql.query<any>(`SELECT * FROM fyp_documents WHERE id = $1 LIMIT 1`, [data.documentId]);
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        doc = {
          id: String(r.id),
          groupId: String(r.group_id),
          category: r.category as FypDocumentCategory,
          title: String(r.title),
          documentUrl: String(r.document_url),
          version: Number(r.version),
          uploadedBy: String(r.uploaded_by),
          uploadedAt: String(r.uploaded_at),
          fileSizeLabel: r.file_size_label,
          plagiarismScore: r.plagiarism_score,
          aiScore: r.ai_score,
          similarityStatus: r.similarity_status,
          comments: typeof r.comments === "string" ? JSON.parse(r.comments) : r.comments,
        };
      }
    } catch {
      // Fallback
    }
  }

  if (!doc) {
    throw new Error("Document not found");
  }

  const comment: FypDocumentComment = {
    id: `comm-${Date.now()}`,
    authorName: data.authorName,
    authorRole: data.authorRole,
    text: data.text.trim(),
    createdAt: new Date().toISOString(),
  };

  doc.comments = [...(doc.comments || []), comment];

  try {
    const sql = await getSql();
    await sql.query(`UPDATE fyp_documents SET comments = $1 WHERE id = $2`, [JSON.stringify(doc.comments), doc.id]);
  } catch (err) {
    console.warn("[fyp.server] Comment document database fallback:", err);
  }

  memoryDocuments.set(doc.id, doc);
  writeDiskStore();
  return doc;
}

/**
 * =========================================================================
 * PHASE 3: PANEL ALLOCATION, DEFENSE SCHEDULING & 6TH SEMESTER EVALUATION
 * =========================================================================
 */

/**
 * Retrieve all defense panels
 */
export async function serverGetAllDefensePanels(): Promise<FypDefensePanel[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_defense_panels ORDER BY created_at DESC`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        department: String(r.department || "Computer Science"),
        members: typeof r.members === "string" ? JSON.parse(r.members) : Array.isArray(r.members) ? r.members : [],
        assignedGroupIds: typeof r.assigned_group_ids === "string" ? JSON.parse(r.assigned_group_ids) : Array.isArray(r.assigned_group_ids) ? r.assigned_group_ids : [],
        createdAt: String(r.created_at),
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryPanels.values());
}

/**
 * Create a new defense panel of 2-4 faculty members
 */
export async function serverCreateDefensePanel(data: {
  name: string;
  department?: string;
  members: FypPanelMember[];
}): Promise<FypDefensePanel> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  if (!data.name?.trim()) {
    throw new Error("Panel name is required");
  }
  if (!Array.isArray(data.members) || data.members.length < 2 || data.members.length > 4) {
    throw new Error("A defense panel must have between 2 and 4 faculty members.");
  }

  // Ensure exactly one chairperson
  const hasChair = data.members.some((m) => m.isChair);
  const formattedMembers = data.members.map((m, idx) => ({
    ...m,
    isChair: hasChair ? m.isChair : idx === 0, // Designate first member as chair if unset
  }));

  const id = `panel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const panel: FypDefensePanel = {
    id,
    name: data.name.trim(),
    department: data.department || data.members[0]?.department || "Computer Science",
    members: formattedMembers,
    assignedGroupIds: [],
    createdAt: now,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_defense_panels (id, name, department, members, assigned_group_ids, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         members = EXCLUDED.members,
         assigned_group_ids = EXCLUDED.assigned_group_ids`,
      [panel.id, panel.name, panel.department, JSON.stringify(panel.members), JSON.stringify(panel.assignedGroupIds), panel.createdAt],
    );
  } catch (err) {
    console.warn("[fyp.server] Create panel database fallback:", err);
  }

  memoryPanels.set(panel.id, panel);
  writeDiskStore();
  return panel;
}

/**
 * Assign groups to a defense panel with STRICT Supervisor Conflict Check
 */
export async function serverAssignGroupsToPanel(data: {
  panelId: string;
  groupIds: string[];
}): Promise<FypDefensePanel> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const panels = await serverGetAllDefensePanels();
  const panel = panels.find((p) => p.id === data.panelId);
  if (!panel) {
    throw new Error("Defense panel not found");
  }

  const allGroups = await serverGetAllFypGroups();

  // Strict Conflict Check: Panel member cannot supervise assigned group!
  for (const gid of data.groupIds) {
    const group = allGroups.find((g) => g.id === gid);
    if (!group) continue;

    if (group.supervisorId !== null && group.supervisorId !== undefined) {
      const conflictMember = panel.members.find((m) => m.teacherId === group.supervisorId);
      if (conflictMember) {
        throw new Error(
          `Conflict of Interest: ${conflictMember.teacherName} is the official supervisor of group "${group.title}" and is strictly excluded from evaluating their own group.`,
        );
      }
    }
  }

  panel.assignedGroupIds = Array.from(new Set([...panel.assignedGroupIds, ...data.groupIds]));

  try {
    const sql = await getSql();
    await sql.query(
      `UPDATE fyp_defense_panels SET assigned_group_ids = $1 WHERE id = $2`,
      [JSON.stringify(panel.assignedGroupIds), panel.id],
    );
  } catch (err) {
    console.warn("[fyp.server] Assign groups database fallback:", err);
  }

  memoryPanels.set(panel.id, panel);
  writeDiskStore();
  return panel;
}

/**
 * Auto-suggests compatible panels for groups avoiding supervisor conflicts and balancing workload
 */
export async function serverAutoSuggestPanels(groupIds?: string[]): Promise<
  Array<{
    groupId: string;
    groupTitle: string;
    domain: string;
    supervisorName: string;
    suggestedPanelId?: string;
    suggestedPanelName?: string;
    eligiblePanelsCount: number;
  }>
> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const panels = await serverGetAllDefensePanels();
  const allGroups = await serverGetAllFypGroups();
  const targetGroups = groupIds && groupIds.length > 0
    ? allGroups.filter((g) => groupIds.includes(g.id))
    : allGroups.filter((g) => g.status === "supervisor_accepted" || g.status === "locked");

  const results = [];

  for (const group of targetGroups) {
    // Find panels without conflict
    const eligiblePanels = panels.filter((p) => {
      if (!group.supervisorId) return true;
      return !p.members.some((m) => m.teacherId === group.supervisorId);
    });

    // Sort by fewest assigned groups (workload balance)
    eligiblePanels.sort((a, b) => a.assignedGroupIds.length - b.assignedGroupIds.length);
    const bestMatch = eligiblePanels[0];

    results.push({
      groupId: group.id,
      groupTitle: group.title,
      domain: group.domain,
      supervisorName: group.supervisorName || "Unassigned",
      suggestedPanelId: bestMatch?.id,
      suggestedPanelName: bestMatch?.name,
      eligiblePanelsCount: eligiblePanels.length,
    });
  }

  return results;
}

/**
 * Get all defense schedules
 */
export async function serverGetAllDefenseSchedules(): Promise<FypDefenseSchedule[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_defense_schedules ORDER BY defense_date ASC, start_time ASC`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        groupId: String(r.group_id),
        groupTitle: String(r.group_title),
        groupDomain: String(r.group_domain),
        defenseDate: String(r.defense_date),
        startTime: String(r.start_time),
        endTime: String(r.end_time),
        venue: String(r.venue),
        panelId: String(r.panel_id),
        panelName: String(r.panel_name),
        status: (r.status as FypDefenseStatus) || "scheduled",
        rescheduleReason: r.reschedule_reason ? String(r.reschedule_reason) : null,
        createdAt: String(r.created_at),
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memorySchedules.values()).sort(
    (a, b) => a.defenseDate.localeCompare(b.defenseDate) || a.startTime.localeCompare(b.startTime),
  );
}

/**
 * Schedule defense presentation avoiding room clashes and panel double-booking
 */
export async function serverScheduleDefense(data: {
  groupId: string;
  panelId: string;
  defenseDate: string; // YYYY-MM-DD
  startTime: string; // "09:00"
  endTime: string; // "09:45"
  venue: string; // "Seminar Hall", "CS Lab 1", etc.
}): Promise<FypDefenseSchedule> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const allGroups = await serverGetAllFypGroups();
  const group = allGroups.find((g) => g.id === data.groupId);
  if (!group) throw new Error("Group not found");

  const panels = await serverGetAllDefensePanels();
  const panel = panels.find((p) => p.id === data.panelId);
  if (!panel) throw new Error("Defense panel not found");

  // Conflict Check 1: Supervisor cannot evaluate their own group
  if (group.supervisorId && panel.members.some((m) => m.teacherId === group.supervisorId)) {
    throw new Error(
      `Conflict of Interest: A panel evaluating group "${group.title}" cannot include supervisor ${group.supervisorName}.`,
    );
  }

  const existingSchedules = await serverGetAllDefenseSchedules();

  // Clash Check 2: Room/Venue clash during overlapping time
  const venueClash = existingSchedules.find((s) => {
    if (s.groupId === data.groupId) return false;
    if (s.defenseDate !== data.defenseDate) return false;
    if (s.venue.trim().toLowerCase() !== data.venue.trim().toLowerCase()) return false;
    // Overlap: (start1 < end2) && (start2 < end1)
    return data.startTime < s.endTime && s.startTime < data.endTime;
  });

  if (venueClash) {
    throw new Error(
      `Venue Clash: "${data.venue}" is already booked on ${data.defenseDate} from ${venueClash.startTime} to ${venueClash.endTime} for "${venueClash.groupTitle}".`,
    );
  }

  // Clash Check 3: Panel double-booking at overlapping time
  const panelClash = existingSchedules.find((s) => {
    if (s.groupId === data.groupId) return false;
    if (s.defenseDate !== data.defenseDate) return false;
    if (s.panelId !== data.panelId) return false;
    return data.startTime < s.endTime && s.startTime < data.endTime;
  });

  if (panelClash) {
    throw new Error(
      `Panel Clash: "${panel.name}" is already evaluating another defense from ${panelClash.startTime} to ${panelClash.endTime}.`,
    );
  }

  const id = `sched-${data.groupId}`;
  const now = new Date().toISOString();

  const schedule: FypDefenseSchedule = {
    id,
    groupId: group.id,
    groupTitle: group.title,
    groupDomain: group.domain,
    defenseDate: data.defenseDate,
    startTime: data.startTime,
    endTime: data.endTime,
    venue: data.venue.trim(),
    panelId: panel.id,
    panelName: panel.name,
    status: "scheduled",
    createdAt: now,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_defense_schedules 
       (id, group_id, group_title, group_domain, defense_date, start_time, end_time, venue, panel_id, panel_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         defense_date = EXCLUDED.defense_date,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         venue = EXCLUDED.venue,
         panel_id = EXCLUDED.panel_id,
         panel_name = EXCLUDED.panel_name,
         status = EXCLUDED.status`,
      [
        schedule.id,
        schedule.groupId,
        schedule.groupTitle,
        schedule.groupDomain,
        schedule.defenseDate,
        schedule.startTime,
        schedule.endTime,
        schedule.venue,
        schedule.panelId,
        schedule.panelName,
        schedule.status,
        schedule.createdAt,
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Schedule defense database fallback:", err);
  }

  memorySchedules.set(schedule.id, schedule);
  // Also link group to panel if not linked yet
  if (!panel.assignedGroupIds.includes(group.id)) {
    panel.assignedGroupIds.push(group.id);
    memoryPanels.set(panel.id, panel);
  }

  writeDiskStore();
  return schedule;
}

/**
 * Get defenses assigned to a specific faculty panelist
 */
export async function serverGetFacultyAssignedDefenses(teacherId: number): Promise<
  Array<{
    schedule: FypDefenseSchedule;
    group: FypGroupRecord;
    panel: FypDefensePanel;
    isChair: boolean;
    myEvaluation?: FypPanelistEvaluation;
  }>
> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const panels = await serverGetAllDefensePanels();
  const myPanels = panels.filter((p) => p.members.some((m) => m.teacherId === teacherId));
  const myPanelIds = new Set(myPanels.map((p) => p.id));

  const allSchedules = await serverGetAllDefenseSchedules();
  const relevantSchedules = allSchedules.filter((s) => myPanelIds.has(s.panelId));
  const allGroups = await serverGetAllFypGroups();
  const allEvaluations = await serverGetAllDefenseEvaluations();

  const results = [];

  for (const sched of relevantSchedules) {
    const group = allGroups.find((g) => g.id === sched.groupId);
    const panel = myPanels.find((p) => p.id === sched.panelId);
    if (!group || !panel) continue;

    const myEvaluation = allEvaluations.find(
      (e) => e.groupId === sched.groupId && e.panelistId === teacherId,
    );
    const myMember = panel.members.find((m) => m.teacherId === teacherId);

    results.push({
      schedule: sched,
      group,
      panel,
      isChair: Boolean(myMember?.isChair),
      myEvaluation,
    });
  }

  return results;
}

/**
 * Get all defense evaluations submitted
 */
export async function serverGetAllDefenseEvaluations(): Promise<FypPanelistEvaluation[]> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_defense_evaluations`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        panelId: String(r.panel_id),
        groupId: String(r.group_id),
        panelistId: Number(r.panelist_id),
        panelistName: String(r.panelist_name),
        groupCriterionScores: typeof r.group_criterion_scores === "string" ? JSON.parse(r.group_criterion_scores) : r.group_criterion_scores || {},
        studentScores: typeof r.student_scores === "string" ? JSON.parse(r.student_scores) : Array.isArray(r.student_scores) ? r.student_scores : [],
        totalScore: Number(r.total_score),
        recommendation: r.recommendation as FypDefenseRecommendation,
        remarks: String(r.remarks || ""),
        submittedAt: String(r.submitted_at),
        isLocked: r.is_locked !== false,
      }));
    }
  } catch {
    // Fallback
  }

  return Array.from(memoryEvaluations.values());
}

/**
 * Submit defense scoring evaluation independently as a panelist
 */
export async function serverSubmitDefenseEvaluation(data: {
  panelId: string;
  groupId: string;
  panelistId: number;
  panelistName: string;
  groupCriterionScores: Record<string, number>;
  studentScores: FypStudentScore[];
  recommendation: FypDefenseRecommendation;
  remarks: string;
}): Promise<FypPanelistEvaluation> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  // Calculate total score:
  // 1. Sum of group rubric criteria (pres: 15, prob: 15, tech: 20, arch: 20, qna: 15 = 85 max)
  let groupCriteriaTotal = 0;
  for (const [k, v] of Object.entries(data.groupCriterionScores)) {
    if (k !== "indiv") {
      groupCriteriaTotal += Number(v) || 0;
    }
  }

  // 2. Average of individual student scores (15 max)
  let avgStudentIndividual = 0;
  if (data.studentScores.length > 0) {
    const indivSum = data.studentScores.reduce((acc, s) => acc + (Number(s.individualMarks) || 0), 0);
    avgStudentIndividual = Math.round((indivSum / data.studentScores.length) * 10) / 10;
  }

  const totalScore = Math.min(100, Math.round((groupCriteriaTotal + avgStudentIndividual) * 10) / 10);

  const id = `eval-${data.groupId}-${data.panelistId}`;
  const now = new Date().toISOString();

  const evalRecord: FypPanelistEvaluation = {
    id,
    panelId: data.panelId,
    groupId: data.groupId,
    panelistId: data.panelistId,
    panelistName: data.panelistName,
    groupCriterionScores: data.groupCriterionScores,
    studentScores: data.studentScores,
    totalScore,
    recommendation: data.recommendation,
    remarks: data.remarks.trim(),
    submittedAt: now,
    isLocked: true,
  };

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_defense_evaluations 
       (id, panel_id, group_id, panelist_id, panelist_name, group_criterion_scores, student_scores, total_score, recommendation, remarks, submitted_at, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         group_criterion_scores = EXCLUDED.group_criterion_scores,
         student_scores = EXCLUDED.student_scores,
         total_score = EXCLUDED.total_score,
         recommendation = EXCLUDED.recommendation,
         remarks = EXCLUDED.remarks,
         submitted_at = EXCLUDED.submitted_at,
         is_locked = EXCLUDED.is_locked`,
      [
        evalRecord.id,
        evalRecord.panelId,
        evalRecord.groupId,
        evalRecord.panelistId,
        evalRecord.panelistName,
        JSON.stringify(evalRecord.groupCriterionScores),
        JSON.stringify(evalRecord.studentScores),
        evalRecord.totalScore,
        evalRecord.recommendation,
        evalRecord.remarks,
        evalRecord.submittedAt,
        evalRecord.isLocked,
      ],
    );
  } catch (err) {
    console.warn("[fyp.server] Submit evaluation database fallback:", err);
  }

  memoryEvaluations.set(evalRecord.id, evalRecord);
  writeDiskStore();
  return evalRecord;
}

/**
 * Check if defense results are published for a group
 */
export async function serverGetDefensePublicationStatus(groupId: string): Promise<{
  isPublished: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
}> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  try {
    const sql = await getSql();
    const rows = await sql.query<any>(`SELECT * FROM fyp_defense_publications WHERE group_id = $1 LIMIT 1`, [groupId]);
    if (Array.isArray(rows) && rows.length > 0) {
      return {
        isPublished: Boolean(rows[0].is_published),
        publishedAt: rows[0].published_at,
        publishedBy: rows[0].published_by,
      };
    }
  } catch {
    // Fallback
  }

  const pub = memoryPublications.get(groupId);
  return {
    isPublished: pub ? pub.isPublished : false,
    publishedAt: pub ? pub.publishedAt : null,
    publishedBy: pub ? pub.publishedBy : null,
  };
}

/**
 * Publish defense results to group and student portals
 */
export async function serverPublishDefenseResult(data: {
  groupId: string;
  publishedBy: string;
}): Promise<{ success: boolean; resultSummary: FypDefenseResultSummary }> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const now = new Date().toISOString();

  try {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO fyp_defense_publications (group_id, is_published, published_at, published_by)
       VALUES ($1, TRUE, $2, $3)
       ON CONFLICT (group_id) DO UPDATE SET
         is_published = TRUE,
         published_at = EXCLUDED.published_at,
         published_by = EXCLUDED.published_by`,
      [data.groupId, now, data.publishedBy],
    );
  } catch (err) {
    console.warn("[fyp.server] Publish defense results database fallback:", err);
  }

  memoryPublications.set(data.groupId, {
    isPublished: true,
    publishedAt: now,
    publishedBy: data.publishedBy,
  });
  writeDiskStore();

  const summary = await serverGetGroupDefenseResult(data.groupId, "coordinator");
  return { success: true, resultSummary: summary };
}

/**
 * Get comprehensive defense result with blind-scoring rules
 */
export async function serverGetGroupDefenseResult(
  groupId: string,
  requestingRole: "student" | "panelist" | "coordinator",
  requesterId?: number,
): Promise<FypDefenseResultSummary> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const allGroups = await serverGetAllFypGroups();
  const group = allGroups.find((g) => g.id === groupId);
  const groupTitle = group?.title || "Final Year Project";
  const groupDomain = group?.domain || "Computer Science";

  const panels = await serverGetAllDefensePanels();
  const panel = panels.find((p) => p.assignedGroupIds.includes(groupId));
  const totalPanelists = panel?.members.length || 3;

  const allEvals = await serverGetAllDefenseEvaluations();
  const groupEvals = allEvals.filter((e) => e.groupId === groupId);
  const pubStatus = await serverGetDefensePublicationStatus(groupId);

  // Compute average total score
  const averageTotalScore = groupEvals.length > 0
    ? Math.round((groupEvals.reduce((acc, e) => acc + e.totalScore, 0) / groupEvals.length) * 10) / 10
    : 0;

  // Compute consensus recommendation
  let consensusRecommendation: FypDefenseRecommendation | "pending" = "pending";
  if (groupEvals.length > 0) {
    const recCounts: Record<string, number> = {};
    for (const e of groupEvals) {
      recCounts[e.recommendation] = (recCounts[e.recommendation] || 0) + 1;
    }
    // Highest frequency
    let highestCount = 0;
    for (const [rec, cnt] of Object.entries(recCounts)) {
      if (cnt > highestCount) {
        highestCount = cnt;
        consensusRecommendation = rec as FypDefenseRecommendation;
      }
    }
  }

  // Student Individual Averages
  const studentAvgMap = new Map<string, { regNo: string; name: string; sum: number; count: number }>();
  for (const e of groupEvals) {
    for (const s of e.studentScores) {
      const existing = studentAvgMap.get(s.studentId) || { regNo: s.regNo, name: s.studentName, sum: 0, count: 0 };
      existing.sum += s.individualMarks;
      existing.count += 1;
      studentAvgMap.set(s.studentId, existing);
    }
  }

  const studentAverages = Array.from(studentAvgMap.entries()).map(([studentId, val]) => ({
    studentId,
    regNo: val.regNo,
    studentName: val.name,
    averageMarks: val.count > 0 ? Math.round((val.sum / val.count) * 10) / 10 : 0,
  }));

  // Blind scoring filters:
  // If not published and requester is student: hide numerical marks
  // If panelist: can see own score; others' scores hidden if blind scoring active
  const isPublished = pubStatus.isPublished;
  const panelistSummaries = groupEvals.map((e) => {
    const isMine = requesterId !== undefined && e.panelistId === requesterId;
    const canSeeScore = isPublished || requestingRole === "coordinator" || isMine;

    return {
      panelistName: e.panelistName,
      totalScore: canSeeScore ? e.totalScore : undefined,
      recommendation: e.recommendation,
      remarks: isPublished || requestingRole === "coordinator" || isMine ? e.remarks : "Evaluation submitted (blinded).",
    };
  });

  return {
    groupId,
    groupTitle,
    groupDomain,
    averageTotalScore: isPublished || requestingRole === "coordinator" ? averageTotalScore : 0,
    evaluationsCount: groupEvals.length,
    totalPanelists,
    isPublished,
    consensusRecommendation: isPublished || requestingRole === "coordinator" ? consensusRecommendation : "pending",
    publishedAt: pubStatus.publishedAt,
    panelistSummaries,
    studentAverages: isPublished || requestingRole === "coordinator" ? studentAverages : [],
  };
}

/**
 * Get student's defense schedule and published result
 */
export async function serverGetStudentDefenseSchedule(groupId: string): Promise<{
  schedule: FypDefenseSchedule | null;
  panel: FypDefensePanel | null;
  resultSummary: FypDefenseResultSummary | null;
}> {
  await ensureFypTables();
  hydrateFallbackFromDisk();

  const allSchedules = await serverGetAllDefenseSchedules();
  const schedule = allSchedules.find((s) => s.groupId === groupId) || null;

  let panel: FypDefensePanel | null = null;
  if (schedule) {
    const panels = await serverGetAllDefensePanels();
    panel = panels.find((p) => p.id === schedule.panelId) || null;
  }

  const resultSummary = await serverGetGroupDefenseResult(groupId, "student");

  return {
    schedule,
    panel,
    resultSummary,
  };
}


