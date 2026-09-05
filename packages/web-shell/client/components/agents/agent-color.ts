const AGENT_COLORS = {
  red: '#f47067',
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  purple: '#bc8cff',
  orange: '#f0883e',
  pink: '#db61a2',
  cyan: '#39c5cf',
} as const;

export type AgentColorName = keyof typeof AGENT_COLORS;

export interface AgentDisplayColor {
  color: string;
  name?: AgentColorName;
  automatic: boolean;
}

function isAgentColorName(value: string): value is AgentColorName {
  return value in AGENT_COLORS;
}

export function resolveAgentColor(
  agentName: string,
  configuredColor?: string,
): AgentDisplayColor {
  const configured = configuredColor?.trim().toLowerCase();
  if (configured && isAgentColorName(configured)) {
    return {
      color: AGENT_COLORS[configured],
      name: configured,
      automatic: false,
    };
  }
  if (configured && /^#[\da-f]{6}$/i.test(configured)) {
    return { color: configured, automatic: false };
  }

  const names = Object.keys(AGENT_COLORS) as AgentColorName[];
  let hash = 0;
  for (const character of agentName) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  const name = names[hash % names.length];
  return { color: AGENT_COLORS[name], name, automatic: true };
}
