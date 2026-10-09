import {
  Activity,
  Archive,
  Bell,
  FileStack,
  FileWarning,
  GitFork,
  History,
  Inbox,
  LayoutTemplate,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareChartGantt,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/types/navigation";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  archive: Archive,
  files: FileStack,
  spark: Sparkles,
  alert: FileWarning,
  inbox: Inbox,
  history: History,
  check: ShieldCheck,
  scroll: Scale,
  gauge: SquareChartGantt,
  template: LayoutTemplate,
  graph: GitFork,
  users: Users,
  settings: Settings,
  activity: Activity,
};

export function NavIcon({
  name,
  className,
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon aria-hidden strokeWidth={1.75} className={className} />;
}

export function BellIcon({ className }: { className?: string }) {
  return <Bell aria-hidden strokeWidth={1.75} className={className} />;
}
