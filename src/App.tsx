import { AppShell } from "./AppShell";
import { ChecklistScreen } from "./screens/ChecklistScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { useAppState } from "./store";

export function App() {
  const state = useAppState();

  return (
    <div className="app">
      <AppShell state={state} />
      <main className="main">
        {state.screen === "checklist" ? <ChecklistScreen state={state} /> : null}
        {state.screen === "evidence" ? <EvidenceScreen state={state} /> : null}
        {state.screen === "review" ? <ReviewScreen state={state} /> : null}
      </main>
    </div>
  );
}
