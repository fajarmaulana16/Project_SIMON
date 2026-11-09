
import { useEffect, useState } from "react";
import { ChartColumn, Eye, EyeOff, LoaderCircle } from "lucide-react";
import "./login.css";

const API_URL = "http://localhost:3001";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("login-screen-active");
    document.body.classList.add("login-screen-active");

    return () => {
      document.documentElement.classList.remove("login-screen-active");
      document.body.classList.remove("login-screen-active");
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login gagal.");
      }

      onLogin(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Backend tidak terhubung. Pastikan server berjalan."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-form-content">
          <div className="login-brand login-brand-light">
            <div className="login-brand-icon">
              <ChartColumn size={25} />
            </div>
            <div>
              <h1>SIMON</h1>
              <p>Monitoring System</p>
            </div>
          </div>

          <header className="login-heading">
            <h2>Selamat Datang Kembali</h2>
            <p>Masuk ke akun Anda untuk melanjutkan.</p>
          </header>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username atau email</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Masukkan username atau email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Memeriksa akun...
                </>
              ) : (
                "Masuk ke SIMON"
              )}
            </button>
          </form>
          <p className="login-footer">© SIMON · Sistem Monitoring</p>
        </div>
      </section>
      <aside className="login-brand-panel" aria-label="SIMON Monitoring System">
        <div className="login-promo-content">
          <div className="login-promo-mark">
            <ChartColumn size={34} />
          </div>
          <p className="login-promo-eyebrow">Sistem Informasi Monitoring</p>
          <h2>Pantau pekerjaan,<br />capai tujuan bersama.</h2>
          <p className="login-promo-description">
            Kelola rencana dan pantau progres pekerjaan dalam satu platform
            yang terintegrasi.
          </p>
          <div className="login-promo-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </aside>
    </main>
  );
}
