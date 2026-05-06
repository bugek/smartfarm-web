const phases = [
  "Organizations and memberships",
  "Farm sites, plots, and crop cycles",
  "GAP records and evidence collection",
  "Advisor review and readiness follow-up"
];

const repos = [
  { name: "smartfarm-api", role: "backend system of record" },
  { name: "smartfarm-docs", role: "product, GAP, and workflow decisions" },
  { name: "smartfarm-infra", role: "runtime and deployment scaffolding" }
];

export function App() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SmartFarm GAP Platform</p>
          <h1>Frontend workspace for farmers and advisors</h1>
          <p className="lede">
            This repo is the UI home for Phase 1. It starts with GAP-first workflows and grows into advisory,
            communication, and AI-assisted operations.
          </p>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Phase 1 surfaces</h2>
          <ul>
            {phases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Connected repos</h2>
          <ul>
            {repos.map((repo) => (
              <li key={repo.name}>
                <strong>{repo.name}</strong>
                <span>{repo.role}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

