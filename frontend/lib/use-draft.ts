"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, put, errorText } from "./api";
import type { Draft } from "./types";
import { useApp } from "./context";

export function useDraft(id: string) {
  const [draft, setDraft] = useState<Draft | null>(null),
    [saveState, setSaveState] = useState("loading"),
    [error, setError] = useState("");
  const current = useRef<Draft | null>(null),
    revision = useRef(0),
    dirty = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saving = useRef<Promise<Draft | null> | null>(null),
    mounted = useRef(true);
  const { guard } = useApp();
  const accept = useCallback((d: Draft) => {
    current.current = d;
    revision.current = d.revision;
    dirty.current = false;
    if (mounted.current) {
      setDraft(d);
      setSaveState("saved");
      setError("");
    }
  }, []);
  const flush = useCallback(async (): Promise<Draft | null> => {
    if (timer.current) clearTimeout(timer.current);
    if (saving.current) return saving.current;
    if (!current.current || !dirty.current) return current.current;
    const run = async () => {
      try {
        while (dirty.current && current.current) {
          const snapshot = current.current;
          dirty.current = false;
          if (mounted.current) setSaveState("saving");
          const saved = await put<Draft>("/drafts/" + id, {
            ...snapshot,
            revision: revision.current,
          });
          revision.current = saved.revision;
          current.current = {
            ...current.current,
            revision: saved.revision,
            updated_at: saved.updated_at,
          };
          if (mounted.current) setDraft(current.current);
        }
        if (mounted.current) {
          setSaveState("saved");
          setError("");
        }
        return current.current;
      } catch (e) {
        dirty.current = true;
        if (mounted.current) {
          setSaveState("error");
          setError(errorText(e));
        }
        throw e;
      } finally {
        saving.current = null;
      }
    };
    saving.current = run();
    return saving.current;
  }, [id]);
  const edit = useCallback(
    (patch: Partial<Draft>) => {
      if (!current.current) return;
      current.current = { ...current.current, ...patch, status: "draft" };
      setDraft(current.current);
      dirty.current = true;
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush().catch(() => {}), 650);
    },
    [flush],
  );
  useEffect(() => {
    mounted.current = true;
    let active = true;
    api<Draft>("/drafts/" + id)
      .then((d) => {
        if (active) accept(d);
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
          setSaveState("error");
        }
      });
    return () => {
      active = false;
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void flush().catch(() => {});
    };
  }, [id, accept, flush]);
  useEffect(() => {
    guard.current = flush;
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => {
      if (guard.current === flush) guard.current = null;
      window.removeEventListener("beforeunload", prevent);
    };
  }, [guard, flush]);
  return { draft, saveState, error, edit, flush, accept, setError };
}
