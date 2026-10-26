import {
  LuAtSign,
  LuBookOpen,
  LuBug,
  LuCode,
  LuCompass,
  LuGraduationCap,
  LuGitPullRequest,
  LuLanguages,
  LuMail,
  LuMegaphone,
  LuNewspaper,
  LuShare2,
  LuTerminal,
  LuTrophy,
  LuUsers,
  LuVideo,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import type { QuestListItem } from "@/lib/quest-filters";

export type QuestVisualMeta = {
  Icon: IconType;
  containerClass: string;
};

export type QuestIconPreset = {
  id: string;
  label: string;
  Icon: IconType;
  colorHex: string;
  containerClass: string;
};

export const QUEST_ICON_PRESETS: QuestIconPreset[] = [
  {
    id: "video",
    label: "Video & Stream",
    Icon: LuVideo,
    colorHex: "#06b6d4",
    containerClass:
      "border-cyan-500/35 bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-blue-600/5 text-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.25)]",
  },
  {
    id: "social",
    label: "Social & Threads",
    Icon: LuShare2,
    colorHex: "#38bdf8",
    containerClass:
      "border-sky-500/35 bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-indigo-600/5 text-sky-400 shadow-[0_0_16px_rgba(14,165,233,0.25)]",
  },
  {
    id: "x",
    label: "Follow on X / Twitter",
    Icon: LuAtSign,
    colorHex: "#60a5fa",
    containerClass:
      "border-blue-500/35 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-sky-600/5 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.25)]",
  },
  {
    id: "translate",
    label: "Translate & Localize",
    Icon: LuLanguages,
    colorHex: "#10b981",
    containerClass:
      "border-emerald-500/35 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-green-600/5 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.25)]",
  },
  {
    id: "tutorial",
    label: "Tutorial & Academy",
    Icon: LuGraduationCap,
    colorHex: "#f59e0b",
    containerClass:
      "border-amber-500/35 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-600/5 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.25)]",
  },
  {
    id: "docs",
    label: "Documentation",
    Icon: LuBookOpen,
    colorHex: "#eab308",
    containerClass:
      "border-yellow-500/35 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-orange-600/5 text-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.25)]",
  },
  {
    id: "bug",
    label: "Bug Report & Testing",
    Icon: LuBug,
    colorHex: "#818cf8",
    containerClass:
      "border-indigo-500/35 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-blue-600/5 text-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.25)]",
  },
  {
    id: "code",
    label: "Developer & Code",
    Icon: LuCode,
    colorHex: "#c084fc",
    containerClass:
      "border-purple-500/35 bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-600/5 text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.25)]",
  },
  {
    id: "github",
    label: "GitHub / Pull Request",
    Icon: LuGitPullRequest,
    colorHex: "#a855f7",
    containerClass:
      "border-violet-500/35 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-indigo-600/5 text-violet-400 shadow-[0_0_16px_rgba(168,85,247,0.25)]",
  },
  {
    id: "community",
    label: "Meetup & Community",
    Icon: LuUsers,
    colorHex: "#d946ef",
    containerClass:
      "border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-violet-600/5 text-fuchsia-400 shadow-[0_0_16px_rgba(217,70,239,0.25)]",
  },
  {
    id: "announce",
    label: "Discord & Announce",
    Icon: LuMegaphone,
    colorHex: "#3b82f6",
    containerClass:
      "border-blue-500/35 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-violet-600/5 text-[#8eb6ff] shadow-[0_0_16px_rgba(59,130,246,0.25)]",
  },
  {
    id: "article",
    label: "Article & Recap",
    Icon: LuNewspaper,
    colorHex: "#14b8a6",
    containerClass:
      "border-teal-500/35 bg-gradient-to-br from-teal-500/20 via-cyan-500/10 to-emerald-600/5 text-teal-400 shadow-[0_0_16px_rgba(20,184,166,0.25)]",
  },
  {
    id: "mail",
    label: "Newsletter & Email",
    Icon: LuMail,
    colorHex: "#94a3b8",
    containerClass:
      "border-slate-500/35 bg-gradient-to-br from-slate-500/20 via-gray-500/10 to-zinc-600/5 text-slate-300 shadow-[0_0_16px_rgba(148,163,184,0.2)]",
  },
  {
    id: "terminal",
    label: "Node & Validator",
    Icon: LuTerminal,
    colorHex: "#84cc16",
    containerClass:
      "border-lime-500/35 bg-gradient-to-br from-lime-500/20 via-emerald-500/10 to-green-600/5 text-lime-400 shadow-[0_0_16px_rgba(132,204,22,0.25)]",
  },
  {
    id: "trophy",
    label: "Milestone & Bounty",
    Icon: LuTrophy,
    colorHex: "#fbbf24",
    containerClass:
      "border-amber-400/35 bg-gradient-to-br from-amber-400/20 via-yellow-500/10 to-orange-600/5 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.25)]",
  },
];

const PRESETS_BY_ID = new Map(QUEST_ICON_PRESETS.map((p) => [p.id, p]));

export function questIconVisual(
  quest: Pick<QuestListItem, "title" | "description" | "icon">,
): QuestVisualMeta {
  const iconKey = quest.icon?.toLowerCase().trim();

  if (iconKey && PRESETS_BY_ID.has(iconKey)) {
    const preset = PRESETS_BY_ID.get(iconKey)!;
    return {
      Icon: preset.Icon,
      containerClass: preset.containerClass,
    };
  }

  // Aliases for legacy values
  if (iconKey === "languages") {
    const preset = PRESETS_BY_ID.get("translate")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }
  if (iconKey === "learn") {
    const preset = PRESETS_BY_ID.get("tutorial")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }
  if (iconKey === "dev") {
    const preset = PRESETS_BY_ID.get("code")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }
  if (iconKey === "meetup") {
    const preset = PRESETS_BY_ID.get("community")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }
  if (iconKey === "news") {
    const preset = PRESETS_BY_ID.get("article")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }
  if (iconKey === "megaphone") {
    const preset = PRESETS_BY_ID.get("announce")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  const hay = `${quest.title} ${quest.description}`.toLowerCase();

  // 1. Video / Media
  if (/video|clip|record|youtube|stream|watch|loom/.test(hay)) {
    const preset = PRESETS_BY_ID.get("video")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 2. Translation / Internationalization
  if (/translate|translation|language|snippet|i18n|locale/.test(hay)) {
    const preset = PRESETS_BY_ID.get("translate")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 3. Bug reporting / QA (NO RED - indigo/violet theme!)
  if (/bug|issue|reproduce|glitch|fix|report a/.test(hay)) {
    const preset = PRESETS_BY_ID.get("bug")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 4. Social / X / Follow / Twitter
  if (/on x\b|follow|x\.com|twitter|tweet|thread|post a social|social/.test(hay)) {
    const preset = /follow|on x\b/.test(hay)
      ? PRESETS_BY_ID.get("x")!
      : PRESETS_BY_ID.get("social")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 5. Tutorials / Documentation / Learning
  if (/tutorial|guide|walkthrough|learn|docs|documentation|course/.test(hay)) {
    const preset = /tutorial|learn|course/.test(hay)
      ? PRESETS_BY_ID.get("tutorial")!
      : PRESETS_BY_ID.get("docs")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 6. Meetups / Community gatherings
  if (/meetup|community|ama|event|conference|hackathon|call|attend/.test(hay)) {
    const preset = PRESETS_BY_ID.get("community")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 7. Developer / Code / GitHub
  if (/code|github|pull request|pr|repo|commit|developer|sdk|api/.test(hay)) {
    const preset = /github|pull request|pr|repo/.test(hay)
      ? PRESETS_BY_ID.get("github")!
      : PRESETS_BY_ID.get("code")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 8. Node / Validator / Shannon / Relays
  if (/node|validator|relay|shannon|terminal|rpc|pocket core/.test(hay)) {
    const preset = PRESETS_BY_ID.get("terminal")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 9. Discord / Announcements
  if (/discord|announce|telegram|channel/.test(hay)) {
    const preset = PRESETS_BY_ID.get("announce")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 10. Articles / Recap / News / Blog
  if (/blog|article|write|recap|news|medium/.test(hay)) {
    const preset = PRESETS_BY_ID.get("article")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // 11. Email / Onboarding
  if (/email|verify|onboard/.test(hay)) {
    const preset = PRESETS_BY_ID.get("mail")!;
    return { Icon: preset.Icon, containerClass: preset.containerClass };
  }

  // Default challenge / explorer
  return {
    Icon: LuCompass,
    containerClass:
      "border-primary/35 bg-gradient-to-br from-primary/25 via-[#1a6dff]/15 to-transparent text-[#8eb6ff] shadow-[0_0_16px_rgba(26,109,255,0.25)]",
  };
}

export function questIconFor(
  quest: Pick<QuestListItem, "title" | "description" | "icon">,
): IconType {
  return questIconVisual(quest).Icon;
}


