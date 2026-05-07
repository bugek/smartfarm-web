import { LoadingScreen, LoginScreen, NoMembershipScreen } from "./AuthScreens";
import { AppShell } from "./AppShell";
import { ChemicalUseScreen } from "./screens/ChemicalUseScreen";
import { ChecklistScreen } from "./screens/ChecklistScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { useAuthSession } from "./auth/session";
import { useAppState } from "./store";

export function App() {
  const auth = useAuthSession();

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  if (!auth.session) {
    return (
      <LoginScreen
        error={auth.error}
        isSubmitting={auth.isSubmitting}
        onSubmit={auth.login}
      />
    );
  }

  if (auth.session.memberships.length === 0) {
    const viewerName =
      auth.session.user.displayName?.trim() || auth.session.user.email || auth.session.user.id;
    return (
      <NoMembershipScreen
        name={viewerName}
        email={auth.session.user.email}
        onSignOut={auth.logout}
      />
    );
  }

  return <WorkspaceApp auth={auth} />;
}

function WorkspaceApp({ auth }: { auth: ReturnType<typeof useAuthSession> }) {
  const state = useAppState({
    session: auth.session!,
    signOut: auth.logout,
    setActiveOrganizationId: auth.setActiveOrganizationId,
    syncMemberships: auth.syncMemberships
  });

  return (
    <div className="app">
      <AppShell state={state} />
      <main className="main">
        {state.screen === "checklist" ? <ChecklistScreen state={state} /> : null}
        {state.screen === "evidence" ? <EvidenceScreen state={state} /> : null}
        {state.screen === "chemicals" ? <ChemicalUseScreen state={state} /> : null}
        {state.screen === "review" ? <ReviewScreen state={state} /> : null}
      </main>
    </div>
  );
}
