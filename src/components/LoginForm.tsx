"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || "登录失败");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>随手记录</h1>
        <p className={styles.hint}>单人登录，密码在服务器环境变量里。</p>
        <label className={styles.label}>
          密码
          <input
            className={styles.input}
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "登录中…" : "进入"}
        </button>
      </form>
    </main>
  );
}
