/**
 * FORTIS ZeroClash Engine
 * Intelligent Combinatorial Course Conflict Resolver & Semester Schedule Builder
 * Solves section clashes across repeat, elective, and multi-department courses.
 */
import {
  batches,
  entries,
  rooms,
  subjects,
  teachers,
  DAYS,
  SLOTS,
  type ClassEntry,
} from "@/lib/schedule";
import { findScheduleClashes, type ScheduleClash } from "@/lib/my-schedule";

export interface SubjectOffering {
  subjectId: number;
  subjectName: string;
  batchId: number;
  batchName: string;
  teachers: string[];
  rooms: string[];
  entries: ClassEntry[];
  totalLectures: number;
}

export interface ZeroClashResult {
  id: string;
  offerings: SubjectOffering[];
  entries: ClassEntry[];
  clashes: ScheduleClash[];
  clashCount: number;
  isClashFree: boolean;
  activeDays: number;
  gapSlots: number;
  hasFreeFriday: boolean;
  score: number;
}

/**
 * Returns all distinct section offerings for a given subject ID
 */
export function getOfferingsForSubject(subjectId: number): SubjectOffering[] {
  const subjectName = subjects[subjectId] || `Subject #${subjectId}`;
  const subjectEntries = entries.filter((e) => e.subject === subjectId);

  // Group by batch
  const batchMap = new Map<number, ClassEntry[]>();
  for (const entry of subjectEntries) {
    const list = batchMap.get(entry.batch) || [];
    list.push(entry);
    batchMap.set(entry.batch, list);
  }

  const offerings: SubjectOffering[] = [];
  for (const [batchId, batchClassEntries] of batchMap.entries()) {
    const batchName = batches[batchId] || `Section #${batchId}`;
    const teacherNames = Array.from(
      new Set(batchClassEntries.map((e) => teachers[e.teacher]).filter(Boolean)),
    );
    const roomNames = Array.from(
      new Set(batchClassEntries.map((e) => rooms[e.room]).filter(Boolean)),
    );

    offerings.push({
      subjectId,
      subjectName,
      batchId,
      batchName,
      teachers: teacherNames,
      rooms: roomNames,
      entries: batchClassEntries,
      totalLectures: batchClassEntries.length,
    });
  }

  return offerings.sort((a, b) => a.batchName.localeCompare(b.batchName));
}

/**
 * Get all subjects available in the active timetable with offering counts
 */
export function getAllAvailableSubjects(): { id: number; name: string; sectionCount: number }[] {
  const subjectSectionCount = new Map<number, Set<number>>();
  for (const entry of entries) {
    const set = subjectSectionCount.get(entry.subject) || new Set<number>();
    set.add(entry.batch);
    subjectSectionCount.set(entry.subject, set);
  }

  const result: { id: number; name: string; sectionCount: number }[] = [];
  for (let i = 0; i < subjects.length; i++) {
    const sections = subjectSectionCount.get(i);
    if (sections && sections.size > 0) {
      result.push({
        id: i,
        name: subjects[i],
        sectionCount: sections.size,
      });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all subject IDs taught in a specific batch (e.g. for pre-filling a regular semester)
 */
export function getSubjectsForBatch(batchId: number): number[] {
  const batchEntries = entries.filter((e) => e.batch === batchId);
  return Array.from(new Set(batchEntries.map((e) => e.subject)));
}

/**
 * Calculates dead waiting gaps between first and last class on each day
 */
function calculateGaps(classList: ClassEntry[]): { gapSlots: number; activeDays: number; hasFreeFriday: boolean } {
  const daySlotMap = new Map<number, Set<number>>();
  for (const item of classList) {
    const set = daySlotMap.get(item.day) || new Set<number>();
    set.add(item.slot);
    daySlotMap.set(item.day, set);
  }

  let totalGaps = 0;
  let activeDays = 0;
  let hasFriday = false;

  for (let day = 0; day < 5; day++) {
    const slots = daySlotMap.get(day);
    if (!slots || slots.size === 0) continue;

    activeDays++;
    if (day === 4) hasFriday = true;

    if (slots.size >= 2) {
      const slotArray = Array.from(slots).sort((a, b) => a - b);
      const min = slotArray[0];
      const max = slotArray[slotArray.length - 1];
      const span = max - min + 1;
      const gaps = span - slots.size;
      totalGaps += Math.max(0, gaps);
    }
  }

  return {
    gapSlots: totalGaps,
    activeDays,
    hasFreeFriday: !hasFriday,
  };
}

/**
 * The Core FORTIS ZeroClash Combinatorial Constraint Solver
 */
export function generateZeroClashSchedules(
  selectedSubjectIds: number[],
  maxResults = 12,
): ZeroClashResult[] {
  if (!selectedSubjectIds || selectedSubjectIds.length === 0) return [];

  // 1. Gather all offerings for each selected subject
  const subjectOfferingsList: SubjectOffering[][] = [];
  for (const subId of selectedSubjectIds) {
    const offerings = getOfferingsForSubject(subId);
    if (offerings.length > 0) {
      subjectOfferingsList.push(offerings);
    }
  }

  if (subjectOfferingsList.length === 0) return [];

  // 2. Combinatorial search
  const allCombinations: ZeroClashResult[] = [];
  let combIndex = 0;

  function backtrack(
    depth: number,
    currentOfferings: SubjectOffering[],
    occupiedSlots: Set<string>,
    clashCount: number,
  ) {
    if (depth === subjectOfferingsList.length) {
      // Form candidate schedule
      const flatEntries: ClassEntry[] = [];
      for (const off of currentOfferings) {
        flatEntries.push(...off.entries);
      }

      const clashes = findScheduleClashes(flatEntries);
      const isClashFree = clashes.length === 0;
      const { gapSlots, activeDays, hasFreeFriday } = calculateGaps(flatEntries);

      // Score formula:
      // Heavy bonus for 0 clashes, heavy penalty per clash.
      // Small penalty for dead gap hours.
      // Small bonus for compact days & free Friday.
      const score =
        (isClashFree ? 20000 : -1000 * clashes.length) -
        gapSlots * 80 +
        (hasFreeFriday ? 150 : 0) +
        (5 - activeDays) * 100;

      allCombinations.push({
        id: `zeroclash-${++combIndex}`,
        offerings: [...currentOfferings],
        entries: flatEntries,
        clashes,
        clashCount: clashes.length,
        isClashFree,
        activeDays,
        gapSlots,
        hasFreeFriday,
        score,
      });
      return;
    }

    const currentSubjectOfferings = subjectOfferingsList[depth];

    for (const offering of currentSubjectOfferings) {
      // Fast branch clash check
      let branchesClashes = 0;
      const nextOccupied = new Set(occupiedSlots);

      for (const entry of offering.entries) {
        const slotKey = `${entry.day}-${entry.slot}`;
        if (nextOccupied.has(slotKey)) {
          branchesClashes++;
        }
        nextOccupied.add(slotKey);
      }

      // If we already have a clash and we want strict zero clashes, we can allow mild branch exploration
      // or stop if clashCount exceeds threshold to keep algorithm blazing fast
      if (clashCount + branchesClashes > 3) continue;

      currentOfferings.push(offering);
      backtrack(depth + 1, currentOfferings, nextOccupied, clashCount + branchesClashes);
      currentOfferings.pop();
    }
  }

  backtrack(0, [], new Set<string>(), 0);

  // 3. Sort: Clash-free first, then highest score
  allCombinations.sort((a, b) => {
    if (a.isClashFree && !b.isClashFree) return -1;
    if (!a.isClashFree && b.isClashFree) return 1;
    return b.score - a.score;
  });

  return allCombinations.slice(0, maxResults);
}
