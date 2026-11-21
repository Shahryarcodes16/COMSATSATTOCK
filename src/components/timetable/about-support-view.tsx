import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Code2,
  Copy,
  DoorOpen,
  ExternalLink,
  GraduationCap,
  Heart,
  Instagram,
  Layers,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import crest from "@/assets/crest.png";
import { useDesk } from "@/components/timetable/context";
import {
  APP_NAME,
  APP_SHORT_NAME,
  APP_TAGLINE,
  APP_ACRONYM_ITEMS,
  DEVELOPER_NAME,
  DEVELOPER_EMAIL,
  DEVELOPER_PHONE,
} from "@/lib/campus";

export function AboutSupportView() {
  const { goBack, setView } = useDesk();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const developerInfo = {
    name: "Muhammad Shahryar",
    regNo: "FA23-BCS-014",
    program: "BS Computer Science (BSCS)",
    campus: "COMSATS University Islamabad, Attock Campus",
    whatsapp: "03124855645",
    whatsappUrl: "https://wa.me/923124855645?text=Hi%20Shahryar!%20I'm%20using%20FORTIS%20app%20and%20wanted%20to%20connect.",
    email: "fa23-bcs-014@cuiatk.edu.pk",
    emailUrl: "mailto:fa23-bcs-014@cuiatk.edu.pk?subject=FORTIS%20App%20Inquiry%20%2F%20Support",
    instagram: "Shahryar.sherri",
    instagramUrl: "https://www.instagram.com/shahryar.sherri/",
    copyright: "© Muhammad Shahryar. All rights reserved.",
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2200);
  };

  const features = [
    {
      icon: Clock,
      letter: "T",
      title: "Interactive Timetables",
      description:
        "Real-time class schedule with live slot countdowns, batch filtering, and full Monday-to-Friday weekly timetable grids.",
    },
    {
      icon: DoorOpen,
      letter: "R",
      title: "Live Room Radar",
      description:
        "Instantly find empty classrooms, CS Computer Labs (Labs 1–7), Media Labs, and Lecture Theatres (LTs) right now across academic blocks.",
    },
    {
      icon: Calendar,
      letter: "S",
      title: "Exam Date Sheet Hub",
      description:
        "Interactive Midterm and Terminal examination schedules with room venues, morning/afternoon sessions, and conflict checks.",
    },
    {
      icon: GraduationCap,
      letter: "F",
      title: "Faculty Directory",
      description:
        "Complete academic directory with faculty designations, departments, teaching loads, and direct official university email contacts.",
    },
    {
      icon: Radio,
      letter: "O",
      title: "Teacher Office Hours",
      description:
        "Find when your teachers are free for student consultations, advising, and project guidance with live consultation badges.",
    },
    {
      icon: Megaphone,
      letter: "I",
      title: "Instant Push Alerts",
      description:
        "Real-time alerts for cancelled classes, emergency room changes, and arranged makeup lectures sent right to your device.",
    },
  ];

  return (
    <div className="page about-page stack">
      {/* Navigation Top Bar */}
      <div className="about-nav-bar">
        <button
          type="button"
          className="btn secondary sm tap"
          onClick={() => goBack("today")}
          title="Return to Timetable"
        >
          <ArrowLeft size={16} />
          <span>Back to Timetable</span>
        </button>
        <span className="about-pill-status">
          <Sparkles size={13} color="var(--c-accent)" />
          <span>Official Campus Application</span>
        </span>
      </div>

      {/* Hero Branding Section */}
      <div className="about-hero-card panel">
        <div className="about-hero-content">
          <img src={crest} alt="FORTIS Crest" className="about-hero-crest" />
          <div className="about-hero-text">
            <div className="about-title-row">
              <h1 className="about-brand-title">FORTIS</h1>
              <span className="about-badge-campus">CUI · ATK · APP</span>
            </div>
            <p className="about-hero-tagline">
              The smart, real-time campus companion engineered exclusively for the students and faculty of COMSATS University Islamabad, Attock Campus.
            </p>
            <div className="about-acronym-chips">
              {APP_ACRONYM_ITEMS.map((item) => (
                <span key={item.letter} className="acronym-chip">
                  <b>{item.letter}</b>
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Creator & Developer Profile Card */}
      <div className="developer-profile-card panel">
        <div className="developer-card-header">
          <div className="developer-avatar-wrap">
            <div className="developer-avatar">MS</div>
            <span className="developer-verified-badge" title="Verified Creator & Developer">
              🎓
            </span>
          </div>
          <div className="developer-header-info">
            <div className="developer-name-row">
              <h2>{developerInfo.name}</h2>
              <span className="developer-role-tag">Creator &amp; Lead Developer</span>
            </div>
            <p className="developer-sub">
              Reg: <strong>{developerInfo.regNo}</strong> · {developerInfo.program}
            </p>
            <p className="developer-institution">
              {developerInfo.campus}
            </p>
          </div>
        </div>

        {/* Creator's Story / Mission Note */}
        <div className="developer-mission-box">
          <p className="mission-quote">
            &ldquo;I built <strong>FORTIS</strong> so students at COMSATS Attock can effortlessly see their daily timetable, find free classrooms and computer labs in real time, and check their exam date sheets without any hassle. Everything is designed to be fast, clear, and always up to date.&rdquo;
          </p>
          <p className="mission-author">— {developerInfo.name}</p>
        </div>

        {/* Support & Contact Action Links */}
        <div className="developer-actions-grid">
          {/* WhatsApp Direct */}
          <a
            href={developerInfo.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-action-card whatsapp-card tap"
          >
            <div className="action-icon whatsapp-icon">
              <MessageCircle size={22} />
            </div>
            <div className="action-details">
              <span className="action-label">WhatsApp Support</span>
              <strong className="action-value">{developerInfo.whatsapp}</strong>
              <span className="action-sub">Instant chat with developer</span>
            </div>
            <ExternalLink size={16} className="action-arrow" />
          </a>

          {/* Email Direct */}
          <a
            href={developerInfo.emailUrl}
            className="dev-action-card email-card tap"
          >
            <div className="action-icon email-icon">
              <Mail size={22} />
            </div>
            <div className="action-details">
              <span className="action-label">University Email</span>
              <strong className="action-value">{developerInfo.email}</strong>
              <span className="action-sub">Official campus mail</span>
            </div>
            <ExternalLink size={16} className="action-arrow" />
          </a>

          {/* Instagram Direct */}
          <a
            href={developerInfo.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-action-card instagram-card tap"
          >
            <div className="action-icon instagram-icon">
              <Instagram size={22} />
            </div>
            <div className="action-details">
              <span className="action-label">Instagram</span>
              <strong className="action-value">@{developerInfo.instagram}</strong>
              <span className="action-sub">Follow for updates &amp; announcements</span>
            </div>
            <ExternalLink size={16} className="action-arrow" />
          </a>
        </div>

        {/* Quick Copy Action Bar */}
        <div className="copy-helper-bar">
          <span className="fine quiet">Quick copy contact details:</span>
          <div className="copy-btns">
            <button
              type="button"
              className="chip sm tap"
              onClick={() => handleCopy(developerInfo.whatsapp, "whatsapp")}
            >
              {copiedField === "whatsapp" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedField === "whatsapp" ? "Copied WhatsApp!" : "Copy WhatsApp"}</span>
            </button>
            <button
              type="button"
              className="chip sm tap"
              onClick={() => handleCopy(developerInfo.email, "email")}
            >
              {copiedField === "email" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedField === "email" ? "Copied Email!" : "Copy Email"}</span>
            </button>
            <button
              type="button"
              className="chip sm tap"
              onClick={() => handleCopy(developerInfo.instagram, "instagram")}
            >
              {copiedField === "instagram" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedField === "instagram" ? "Copied Handle!" : "Copy Instagram"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Features Overview */}
      <div className="about-features-section">
        <div className="section-head">
          <p className="eyebrow">Comprehensive Campus Hub</p>
          <h2>Key Features of FORTIS</h2>
          <p className="quiet">Built from the ground up to solve daily campus challenges.</p>
        </div>

        <div className="features-grid">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="feature-card panel">
                <div className="feature-card-top">
                  <div className="feature-icon-wrap">
                    <Icon size={20} />
                  </div>
                  <span className="feature-acro-badge">{feat.letter}</span>
                </div>
                <h3>{feat.title}</h3>
                <p className="quiet fine">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Support & Feedback Channels */}
      <div className="support-banner-card panel">
        <div className="support-banner-icon">
          <ShieldCheck size={28} color="var(--c-accent)" />
        </div>
        <div className="support-banner-info">
          <h3>Found an Issue?</h3>
          <p className="quiet fine">
            If you notice a timing error in your timetable, an unlisted batch, or have a feature suggestion to make FORTIS even better, please message directly via WhatsApp or email.
          </p>
          <div className="support-banner-actions">
            <a
              href={developerInfo.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn sm tap"
              style={{ background: "#25D366", color: "#fff", borderColor: "#25D366" }}
            >
              <MessageCircle size={15} />
              <span>Chat on WhatsApp</span>
            </a>
            <a
              href={developerInfo.emailUrl}
              className="btn secondary sm tap"
            >
              <Mail size={15} />
              <span>Send Email</span>
            </a>
          </div>
        </div>
      </div>

      {/* Official Copyright & Disclaimer Footer */}
      <div className="about-footer-panel">
        <p className="copyright-line">
          <strong>{developerInfo.copyright}</strong>
        </p>
        <p className="fine quiet">
          FORTIS · COMSATS University Islamabad, Attock Campus.
          <br />
          Developed by <strong>Muhammad Shahryar</strong> (FA23-BCS-014), Department of Computer Science.
        </p>
      </div>
    </div>
  );
}
