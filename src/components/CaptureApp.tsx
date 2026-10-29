"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash/debounce";
import { useRouter } from "next/navigation";
import type { EntryTag } from "@/db/schema";
import type { SerializedEntry } from "@/lib/serialize";
import { formatMoneyBody, isEntryTag, TAG_OPTIONS } from "@/lib/tags";
import styles from "./CaptureApp.module.css";

type DraftTag = EntryTag | "";
type TagFilter = "" | "none" | EntryTag;

const TAG_BADGE: Record<EntryTag, string> = {
  body: styles.tagBody,
  learn: styles.tagLearn,
  decision: styles.tagDecision,
  money: styles.tagMoney,
};

function todayLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function formatHeading(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    timeZone: "UTC",
  }).format(utc);
  return `${m}月${d}日 ${weekday}`;
}

const FILTERS: Array<{ value: TagFilter; label: string }> = [
  { value: "", label: "全部" },
  { value: "none", label: "未分类" },
  ...TAG_OPTIONS.flatMap((opt) =>
    opt.value ? [{ value: opt.value, label: opt.label }] : [],
  ),
];

export function CaptureApp() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [ready, setReady] = useState(false);
  const [tagFilter, setTagFilter] = useState<TagFilter>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const composing = useRef(false);
  const applySearch = useMemo(
    () => debounce((value: string) => setDebouncedQuery(value), 300),
    [],
  );
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState<DraftTag>("");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyReason, setMoneyReason] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<SerializedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTag, setEditTag] = useState<DraftTag>("");
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    setDate(todayLocal());
    setReady(true);
  }, []);

  useEffect(() => {
    return () => applySearch.cancel();
  }, [applySearch]);

  useEffect(() => {
    if (draftTag === "money") amountRef.current?.focus();
  }, [draftTag]);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ date });
      if (tagFilter) params.set("tag", tagFilter);
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      const res = await fetch(`/api/entries?${params.toString()}`);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as {
        entries?: SerializedEntry[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "加载失败");
        setEntries([]);
        return;
      }
      setEntries(data.entries ?? []);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [date, tagFilter, debouncedQuery, router]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    let body = "";
    if (draftTag === "money") {
      try {
        body = formatMoneyBody(moneyAmount, moneyReason);
      } catch (err) {
        setError(err instanceof Error ? err.message : "写下花了多少、为什么花");
        return;
      }
    } else {
      body = draft.trim();
    }
    if (!body || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          tag: draftTag || null,
        }),
      });
      const data = (await res.json()) as {
        entry?: SerializedEntry;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      setDraft("");
      setMoneyAmount("");
      setMoneyReason("");
      // 新记录按今天时间写入；若当前在看别的日期，跳回今天
      const today = todayLocal();
      if (date !== today) {
        setDate(today);
      } else {
        await load();
      }
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: SerializedEntry) {
    setEditingId(entry.id);
    setEditBody(entry.body);
    setEditTag(isEntryTag(entry.tag) ? entry.tag : "");
    setEditTime(entry.happenedAtLocal);
  }

  async function saveEdit(id: number) {
    setError("");
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: editBody,
          tag: editTag || null,
          happenedAt: editTime,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "更新失败");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setError("网络错误");
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm("删除这条记录？")) return;
    setError("");
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "删除失败");
        return;
      }
      if (editingId === id) setEditingId(null);
      await load();
    } catch {
      setError("网络错误");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const heading = useMemo(() => formatHeading(date), [date]);
  const moneyMissing =
    !loading &&
    date === todayLocal() &&
    tagFilter === "" &&
    !debouncedQuery.trim() &&
    entries.length > 0 &&
    !entries.some((entry) => entry.tag === "money");
  const moneyReady =
    moneyAmount.trim().length > 0 && moneyReason.trim().length > 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>今天记下的事</p>
          <h1 className={styles.title}>随手记录</h1>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.linkButton} href="/api/export">
            导出
          </a>
          <button type="button" className={styles.ghost} onClick={logout}>
            退出
          </button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <div className={styles.dateBar}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="前一天"
            onClick={() => setDate((d) => shiftDate(d, -1))}
          >
            ‹
          </button>
          <div className={styles.dateCenter}>
            <strong>{heading || "…"}</strong>
            <label className={styles.datePicker}>
              <span className={styles.dateIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                  <path d="M3.5 10h17" />
                  <path d="M8 3.5v3" />
                  <path d="M16 3.5v3" />
                </svg>
              </span>
              <input
                className={styles.dateInput}
                type="date"
                value={date}
                aria-label="选择日期"
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="后一天"
            onClick={() => setDate((d) => shiftDate(d, 1))}
          >
            ›
          </button>
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => setDate(todayLocal())}
          >
            今天
          </button>
        </div>
        <div className={styles.filters}>
          {FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={
                tagFilter === item.value ? styles.chipActive : styles.chip
              }
              onClick={() => setTagFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
          <input
            className={styles.search}
            type="search"
            placeholder="搜索这一天"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              if (!composing.current) applySearch(value);
            }}
            onCompositionStart={() => {
              composing.current = true;
              applySearch.cancel();
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              applySearch(e.currentTarget.value);
            }}
          />
        </div>
      </section>

      <section className={styles.timeline}>
        {loading ? <p className={styles.muted}>加载中…</p> : null}
        {!loading && entries.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>这一天还是空白</p>
            <p className={styles.muted}>
              身体、学习与工作、做过的决定、今天的钱，想到一句就记。不选标签也能存。
            </p>
          </div>
        ) : null}
        <ul className={styles.list}>
          {entries.map((entry) => {
            const tagLabel = entry.tag
              ? TAG_OPTIONS.find((t) => t.value === entry.tag)?.label ||
                "未分类"
              : "未分类";
            const tagClass = isEntryTag(entry.tag)
              ? TAG_BADGE[entry.tag]
              : styles.tagNone;
            const isEditing = editingId === entry.id;
            return (
              <li key={entry.id} className={styles.item}>
                {isEditing ? (
                  <div className={styles.editBox}>
                    <textarea
                      className={styles.textarea}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                    />
                    <div className={styles.editMeta}>
                      <select
                        className={styles.select}
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value as DraftTag)}
                      >
                        {TAG_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.value}>
                            {opt.label === "不标" ? "未分类" : opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className={styles.timeInput}
                        type="datetime-local"
                        value={editTime}
                        aria-label="发生时间"
                        onChange={(e) => setEditTime(e.target.value)}
                      />
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => void saveEdit(entry.id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.itemMeta}>
                      <time>{entry.happenedAtLocal.slice(11)}</time>
                      <span className={`${styles.badge} ${tagClass}`}>
                        {tagLabel}
                      </span>
                    </div>
                    <p className={styles.itemBody}>{entry.body}</p>
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => startEdit(entry)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => void removeEntry(entry.id)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <form className={styles.composer} onSubmit={onCreate}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {moneyMissing && draftTag !== "money" ? (
          <button
            type="button"
            className={styles.moneyHint}
            onClick={() => setDraftTag("money")}
          >
            今天的钱还没记：花了多少、为什么花
          </button>
        ) : null}
        <div className={styles.tagRow}>
          {TAG_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={
                draftTag === opt.value ? styles.chipActive : styles.chip
              }
              onClick={() => setDraftTag(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {draftTag === "money" ? (
          <div className={styles.inputRow}>
            <label className={styles.amountField}>
              <input
                ref={amountRef}
                className={styles.amountInput}
                inputMode="decimal"
                placeholder="花了多少"
                aria-label="花了多少"
                value={moneyAmount}
                onChange={(e) => setMoneyAmount(e.target.value)}
                disabled={saving}
              />
              <span>元</span>
            </label>
            <input
              className={styles.composerInput}
              placeholder="为什么花"
              aria-label="为什么花"
              value={moneyReason}
              onChange={(e) => setMoneyReason(e.target.value)}
              disabled={saving}
            />
            <button
              className={styles.primary}
              type="submit"
              disabled={saving || !moneyReady}
            >
              {saving ? "…" : "记下"}
            </button>
          </div>
        ) : (
          <div className={styles.inputRow}>
            <input
              className={styles.composerInput}
              placeholder="想到就写一句，回车保存"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
            />
            <button
              className={styles.primary}
              type="submit"
              disabled={saving || !draft.trim()}
            >
              {saving ? "…" : "记下"}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
