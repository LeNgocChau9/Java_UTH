export const APP_ROLES = [
  "DEVELOPER",
  "STAFF",
  "MANAGER",
  "TECH_LEAD",
  "ADMIN",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type NavItem = {
  role: AppRole;
  href: string;
  label: string;
  icon:
    | "archive"
    | "files"
    | "spark"
    | "alert"
    | "inbox"
    | "history"
    | "check"
    | "scroll"
    | "gauge"
    | "template"
    | "graph"
    | "users"
    | "settings"
    | "activity";
};
