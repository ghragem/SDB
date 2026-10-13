import {
  BookOpen, FolderKanban, Inbox, Library, Lightbulb, ListChecks, Mic, Scale, Settings, Target, Wallet, Bell,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/hoje", label: "Hoje", icon: Target },
  { href: "/aprender", label: "Aprender", icon: BookOpen },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/decidir", label: "Decidir", icon: Scale },
  { href: "/ideias", label: "Ideias", icon: Lightbulb },
  { href: "/falar", label: "Falar", icon: Mic },
  { href: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { href: "/brain", label: "Brain", icon: Library },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/review", label: "Review", icon: ListChecks },
];

export const SECONDARY: NavItem[] = [
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export const MOBILE_TABS = ["/hoje", "/aprender", "/projetos", "/brain"];
