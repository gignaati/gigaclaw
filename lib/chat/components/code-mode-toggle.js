"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { GitBranchIcon } from "./icons.js";
import { Combobox } from "./ui/combobox.js";
import { cn } from "../utils.js";
function CodeModeToggle({
  enabled,
  onToggle,
  repo,
  onRepoChange,
  branch,
  onBranchChange,
  locked,
  getRepositories,
  getBranches
}) {
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [reposLoaded, setReposLoaded] = useState(false);
  const handleToggle = useCallback(() => {
    if (locked) return;
    const next = !enabled;
    onToggle(next);
    if (next && !reposLoaded) {
      setLoadingRepos(true);
      getRepositories().then((data) => {
        setRepos(data || []);
        setReposLoaded(true);
        setLoadingRepos(false);
      }).catch(() => setLoadingRepos(false));
    }
    if (!next) {
      onRepoChange("");
      onBranchChange("");
      setBranches([]);
    }
  }, [locked, enabled, reposLoaded, onToggle, onRepoChange, onBranchChange, getRepositories]);
  useEffect(() => {
    if (!repo || locked) return;
    setLoadingBranches(true);
    setBranches([]);
    getBranches(repo).then((data) => {
      const branchList = data || [];
      setBranches(branchList);
      const defaultBranch = branchList.find((b) => b.isDefault);
      if (defaultBranch) {
        onBranchChange(defaultBranch.name);
      }
      setLoadingBranches(false);
    }).catch(() => setLoadingBranches(false));
  }, [repo]);
  if (!process.env.NEXT_PUBLIC_CODE_WORKSPACE) return null;
  if (locked && enabled) {
    return /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2.5 text-sm text-muted-foreground", children: [
      repo && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(GitBranchIcon, { size: 14 }),
        /* @__PURE__ */ jsx("span", { children: repo })
      ] }),
      branch && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "opacity-40", children: "\xB7" }),
        /* @__PURE__ */ jsx("span", { children: branch })
      ] })
    ] }) });
  }
  const repoOptions = repos.map((r) => ({ value: r.full_name, label: r.full_name }));
  const branchOptions = branches.map((b) => ({ value: b.name, label: b.name }));
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-center gap-3", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: handleToggle,
        className: "inline-flex items-center gap-2 group",
        role: "switch",
        "aria-checked": enabled,
        "aria-label": "Toggle Code mode",
        children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                enabled ? "bg-primary" : "bg-muted-foreground/30"
              ),
              children: /* @__PURE__ */ jsx(
                "span",
                {
                  className: cn(
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    enabled && "translate-x-4"
                  )
                }
              )
            }
          ),
          /* @__PURE__ */ jsx("span", { className: cn(
            "text-xs font-medium transition-colors",
            enabled ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          ), children: "Code" })
        ]
      }
    ),
    enabled && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "w-full sm:w-auto sm:min-w-[220px]", children: /* @__PURE__ */ jsx(
        Combobox,
        {
          options: repoOptions,
          value: repo,
          onChange: onRepoChange,
          placeholder: "Select repository...",
          loading: loadingRepos
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: cn("w-full sm:w-auto sm:min-w-[180px]", !repo && "opacity-50 pointer-events-none"), children: /* @__PURE__ */ jsx(
        Combobox,
        {
          options: branchOptions,
          value: branch,
          onChange: onBranchChange,
          placeholder: "Select branch...",
          loading: loadingBranches
        }
      ) })
    ] })
  ] });
}
export {
  CodeModeToggle
};
