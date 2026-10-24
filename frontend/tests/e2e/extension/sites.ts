export type Target = { name: string; url: string };

const ALL: Record<string, Target> = {
  local:     { name: 'local-demo', url: process.env.EO_LOCAL_URL ?? 'http://127.0.0.1:4173/' },
  portfolio: { name: 'portfolio',  url: 'https://paulcreates.online/' },
  store:     { name: 'store',      url: process.env.EO_STORE_URL ?? 'https://tshirt-experiment.pages.dev/' },
  agent:     { name: 'agent',      url: 'https://agent.paulcreates.online/' },
  staging:   { name: 'staging',    url: process.env.EO_STAGING_URL ?? 'https://stg.agent.paulcreates.online/' },
};

export const TARGETS: Target[] = (process.env.EO_TARGETS ?? 'local,portfolio,store,agent')
  .split(',')
  .map((k) => {
    const trimmed = k.trim();
    const t = ALL[trimmed];
    if (!t) throw new Error(`Unknown EO_TARGETS entry "${trimmed}". Known: ${Object.keys(ALL).join(', ')}`);
    return t;
  });
