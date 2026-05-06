import { useState } from "react";

interface LoginScreenProps {
  error?: string;
  isSubmitting: boolean;
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
}

export function LoginScreen({ error, isSubmitting, onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="auth-eyebrow">SmartFarm GAP access</p>
          <h1>Sign in to your organization workspace</h1>
          <p className="muted">
            Farmers capture evidence here, advisors review submissions, and compliance leads
            track audit readiness across the organization.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit({ email, password });
          }}
        >
          <label>
            <span className="label">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@farm.co"
              required
            />
          </label>

          <label>
            <span className="label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
            />
          </label>

          {error ? (
            <div className="screen-banner screen-banner-error" role="alert">
              <strong>Sign-in failed.</strong>
              <p>{error}</p>
            </div>
          ) : null}

          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card-compact">
        <p className="auth-eyebrow">SmartFarm GAP access</p>
        <h1>Loading your workspace</h1>
        <p className="muted">Checking your session and organization memberships.</p>
      </section>
    </div>
  );
}

interface NoMembershipScreenProps {
  name: string;
  email: string;
  onSignOut: () => Promise<void>;
}

export function NoMembershipScreen({ name, email, onSignOut }: NoMembershipScreenProps) {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card-compact">
        <p className="auth-eyebrow">SmartFarm GAP access</p>
        <h1>No organization membership found</h1>
        <p className="muted">
          {name}
          {email ? ` (${email})` : ""} signed in successfully, but this account does not belong to
          an active SmartFarm organization yet.
        </p>
        <div className="auth-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
