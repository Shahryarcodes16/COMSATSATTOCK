import { useState, useMemo } from "react";
import { Search, Mail, Copy, Check, Calendar, X, Building2, User } from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import { DEPARTMENTS, Department, FacultyMember, filterFaculty, facultyList } from "@/lib/faculty";

function getInitials(name: string): string {
  const clean = name.replace(/\b(prof|dr|mr|ms|engr)\b\.?/gi, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "F";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function FacultyDirectory() {
  const { open } = useDesk();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department>("All");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);

  // Reset pagination when search or filters change
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setVisibleCount(24);
  };

  const handleDeptChange = (dept: Department) => {
    setDepartment(dept);
    setVisibleCount(24);
  };

  const filtered = useMemo(() => {
    return filterFaculty({ query, department });
  }, [query, department]);

  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { All: facultyList.length };
    for (const d of DEPARTMENTS) {
      if (d !== "All") {
        counts[d] = facultyList.filter((f) => f.department === d).length;
      }
    }
    return counts;
  }, []);

  const copyEmail = async (member: FacultyMember) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(member.email);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = member.email;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedId(member.id);
      setTimeout(() => {
        setCopiedId((current) => (current === member.id ? null : current));
      }, 2000);
    } catch (e) {
      console.error("Failed to copy email", e);
    }
  };

  return (
    <div className="faculty-directory">
      <div className="faculty-directory-controls">
        <label className="search directory-search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            value={query}
            aria-label="Search faculty by name or email"
            placeholder="Search by faculty name or email (e.g. muazzam, farman, cuiatk)..."
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="icon-btn search-clear tap"
              aria-label="Clear search"
              onClick={() => handleQueryChange("")}
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </label>

        {/* Department Chips */}
        <div className="chips directory-chips" role="tablist" aria-label="Filter by department">
          {DEPARTMENTS.map((dept) => {
            const active = department === dept;
            return (
              <button
                key={dept}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "chip chip-active tap" : "chip tap"}
                onClick={() => handleDeptChange(dept)}
              >
                <span>{dept}</span>
                <span className="chip-count">{departmentCounts[dept] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="faculty-results-head">
        <p className="fine" role="status">
          Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} faculty members
          {department !== "All" ? ` in ${department}` : ""}
          {query.trim() ? ` matching "${query.trim()}"` : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="directory-empty">
          <User size={32} className="quiet" aria-hidden />
          <p className="bold">No faculty members found</p>
          <p className="quiet fine">
            No faculty match &quot;{query}&quot;{department !== "All" ? ` in ${department}` : ""}.
          </p>
          {(query || department !== "All") && (
            <button
              type="button"
              className="btn tap"
              onClick={() => {
                setQuery("");
                setDepartment("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="directory-grid">
          {filtered.slice(0, visibleCount).map((member) => {
            const isCopied = copiedId === member.id;
            const hasTimetable = member.teacherId !== null;

            return (
              <div key={member.id} className="faculty-card">
                <div className="faculty-card-header">
                  <div className="avatar faculty-avatar" aria-hidden>
                    {getInitials(member.name)}
                  </div>
                  <div className="faculty-card-info">
                    <h3 className="faculty-card-name">{member.name}</h3>
                    <div className="faculty-card-dept">
                      <Building2 size={12} aria-hidden />
                      <span>{member.department}</span>
                    </div>
                  </div>
                </div>

                <div className="faculty-card-email-box">
                  <div className="faculty-email-text" title={member.email}>
                    <Mail size={14} className="email-icon" aria-hidden />
                    <a
                      href={`mailto:${member.email}`}
                      className="email-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {member.email}
                    </a>
                  </div>
                  <button
                    type="button"
                    className={`btn copy-email-btn tap ${isCopied ? "copied" : ""}`}
                    onClick={() => copyEmail(member)}
                    aria-label={`Copy email for ${member.name}`}
                    title="Copy email address"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} aria-hidden />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="faculty-card-actions">
                  <a
                    href={`mailto:${member.email}`}
                    className="btn tap send-mail-btn"
                    title={`Send email to ${member.name}`}
                  >
                    <Mail size={14} aria-hidden />
                    <span>Send Email</span>
                  </a>

                  {hasTimetable ? (
                    <button
                      type="button"
                      className="btn solid tap view-schedule-btn"
                      onClick={() => open({ type: "teacher", id: member.teacherId! })}
                      title="View teaching schedule"
                    >
                      <Calendar size={14} aria-hidden />
                      <span>Schedule</span>
                    </button>
                  ) : (
                    <span className="fine quiet no-schedule-tag">Visiting/Admin</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleCount < filtered.length ? (
        <button
          type="button"
          className="btn tap faculty-show-more"
          onClick={() => setVisibleCount((c) => c + 24)}
        >
          Show more faculty ({filtered.length - visibleCount} remaining)
        </button>
      ) : null}
    </div>
  );
}
