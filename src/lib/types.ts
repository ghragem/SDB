export type DayState = "ataque" | "normal" | "sobrevivencia";

export type ProjectStatus =
  | "ideia" | "planejamento" | "construcao" | "validacao"
  | "operando" | "escalando" | "pausado" | "encerrado";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: number;
  objective: string | null;
  next_proof: string | null;
  next_delivery: string | null;
  blocker: string | null;
  hypotheses: string | null;
  risks: string | null;
  last_progress_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  deadline: string | null;
  created_at: string;
};

export type SessionItem = {
  kind: "projeto" | "estudo" | "falar" | "decisao" | "revisao" | "escrever" | "dinheiro";
  title: string;
  detail: string;
  minutes: number;
  href?: string | null;
  ref_id?: string | null;
  done?: boolean;
};

export type Checkin = {
  id: string;
  day: string;
  mode: "falar" | "escrever" | "rapido";
  energy: number | null;
  focus: number | null;
  pressure: number | null;
  main_worry: string | null;
  raw_text: string | null;
  day_state: DayState | null;
  reading: string | null;
  reading_source: "ia" | "regras" | null;
  created_at: string;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ideia: "Ideia",
  planejamento: "Planejamento",
  construcao: "Construção",
  validacao: "Validação",
  operando: "Operando",
  escalando: "Escalando",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export const ACTIVE_STATUSES: ProjectStatus[] = [
  "planejamento", "construcao", "validacao", "operando", "escalando",
];

export const DAY_STATE_LABEL: Record<DayState, string> = {
  ataque: "Ataque",
  normal: "Normal",
  sobrevivencia: "Sobrevivência",
};
