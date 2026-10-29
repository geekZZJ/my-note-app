"use client";

import { FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { EntryTag } from "@/db/schema";
import { TAG_LABELS } from "@/lib/tags";
import styles from "./AskPanel.module.css";

type Suggestion = {
  id: number;
  tag: EntryTag;
  reason: string;
  body: string;
  happenedAtLocal: string;
};

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");
  const [applyingId, setApplyingId] = useState<number | null>(null);

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || "提问失败");
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setError("DeepSeek 没有返回内容");
        return;
      }
      const decoder = new TextDecoder();
      let textSoFar = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textSoFar += decoder.decode(value, { stream: true });
        setAnswer(textSoFar);
      }
      if (!textSoFar.trim()) {
        setError("DeepSeek 没有返回内容");
      }
    } catch {
      setError("网络错误");
    } finally {
      setAsking(false);
    }
  }

  async function suggest() {
    setSuggesting(true);
    setError("");
    try {
      const res = await fetch("/api/suggest-tags", { method: "POST" });
      const data = (await res.json()) as {
        suggestions?: Suggestion[];
        empty?: boolean;
        error?: string;
      };
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError(data.error || "建议失败");
        return;
      }
      setSuggestions(data.suggestions ?? []);
      if (data.empty) {
        setError("现在没有未分类的记录");
      } else if ((data.suggestions ?? []).length === 0) {
        setError("最近 30 条未分类里，没有把握够的建议");
      }
    } catch {
      setError("网络错误");
    } finally {
      setSuggesting(false);
    }
  }

  async function applyTag(item: Suggestion) {
    setApplyingId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/entries/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: item.tag }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "保存标签失败");
        return;
      }
      setSuggestions((list) => list.filter((row) => row.id !== item.id));
    } catch {
      setError("网络错误");
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.back} href="/">
          返回
        </a>
        <h1 className={styles.title}>问问这些记录</h1>
      </header>
      <p className={styles.note}>
        问题会连同全部记录发给 DeepSeek。答案不写入日记。
      </p>
      <form className={styles.form} onSubmit={onAsk}>
        <textarea
          className={styles.input}
          value={question}
          placeholder="例如：这周钱主要花在哪"
          rows={3}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking}
        />
        <button
          className={styles.primary}
          type="submit"
          disabled={asking || !question.trim()}
        >
          {asking ? "正在回答…" : "提问"}
        </button>
      </form>
      {answer ? (
        <div className={styles.answer}>
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      ) : null}
      <div className={styles.suggestRow}>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void suggest()}
          disabled={suggesting}
        >
          {suggesting ? "正在看未分类…" : "给未分类建议标签"}
        </button>
      </div>
      {suggestions.length > 0 ? (
        <ul className={styles.list}>
          {suggestions.map((item) => (
            <li key={item.id} className={styles.item}>
              <p className={styles.itemBody}>{item.body}</p>
              <p className={styles.itemMeta}>
                {item.happenedAtLocal} · 建议标成{TAG_LABELS[item.tag]}
                {item.reason ? `，${item.reason}` : ""}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={applyingId === item.id}
                  onClick={() => void applyTag(item)}
                >
                  用这个
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() =>
                    setSuggestions((list) =>
                      list.filter((row) => row.id !== item.id),
                    )
                  }
                >
                  跳过
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </main>
  );
}
