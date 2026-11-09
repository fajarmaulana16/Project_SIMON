
import { useState } from "react";
import Login from "./Login";
import DashboardAdmin from "./pages/DashboardAdmin";
import PlannerDashboard from "./pages/PlannerDashboard";
import { EvaluatorDashboard, SupervisorDashboard } from "./pages/RoleDashboard";
import StaffDashboard from "./pages/StaffDashboard";

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("simon_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      sessionStorage.removeItem("simon_session");
      return null;
    }
  });

  function handleLogin(data) {
    const newSession = {
      token: data.token,
      user: data.user,
    };

    sessionStorage.setItem(
      "simon_session",
      JSON.stringify(newSession)
    );

    setSession(newSession);
  }

  function handleLogout() {
    sessionStorage.removeItem("simon_session");
    setSession(null);
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  const role = String(
    session.user?.roleNama || session.user?.role || ""
  ).toLowerCase();

  if (role === "admin" || role.includes("administrator")) {
    return <DashboardAdmin onLogout={handleLogout} session={session} />;
  }

  if (role === "planner") {
    return (
      <PlannerDashboard
        session={session}
        onLogout={handleLogout}
      />
    );
  }

  if (role === "staff") {
    return (
      <StaffDashboard
        session={session}
        onLogout={handleLogout}
      />
    );
  }

  if (role === "supervisor") {
    return (
      <SupervisorDashboard
        session={session}
        onLogout={handleLogout}
      />
    );
  }

  if (role === "evaluator") {
    return (
      <EvaluatorDashboard
        session={session}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 40,
        background: "#f4f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 850,
          margin: "30px auto",
          padding: 32,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 30px #172b4d12",
        }}
      >
        <p style={{ color: "#2865a7", fontWeight: 700 }}>
          SIMON · SISTEM INFORMASI MONITORING
        </p>

        <h1>Selamat datang, {session.user?.nama}</h1>
        <p>Login berhasil.</p>

        <p>
          <strong>Username:</strong>{" "}
          {session.user?.username}
        </p>

        <p>
          <strong>Role:</strong>{" "}
          {session.user?.roleNama || session.user?.role}
        </p>

        <button onClick={handleLogout}>Keluar</button>
      </section>
    </main>
  );
}
