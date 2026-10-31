import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowUpRight, Bell, Bug, Check, ChevronDown, CircleHelp,
  CirclePlus, Clock3, Columns3, FileText, FolderKanban, Gauge, LayoutDashboard,
  LogOut, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Search, Send,
  Settings2, ShieldCheck, Ticket, Trash2, Users, X, RefreshCw, Sun, Moon
} from "lucide-react";
import { api, formatDate, toPriority, toStatus } from "./api.js";

const STATUSES = ["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const emptyIssue = { title: "", description: "", status: "OPEN", priority: "MEDIUM", assigneeId: "", labelIds: [] };

function Badge({ value, kind = "status" }) {
  const label = kind === "status" ? toStatus(value) : toPriority(value);
  return <span className={`badge ${kind}-${String(value).toLowerCase()}`}><i />{label}</span>;
}

function Login({ onLogin, error, busy }) {
  const [email, setEmail] = useState("admin@issuebuddy.local");
  const [password, setPassword] = useState("");
  return <div className="auth-screen"><div className="auth-card">
    <div className="brand auth-brand"><span className="brand-mark"><Bug size={19}/></span><span>Issue<span className="brand-light">Buddy</span></span></div>
    <div className="auth-kicker">YOUR TEAM WORKSPACE</div><h1>Welcome back.</h1><p className="muted">Sign in to manage projects and track work.</p>
    <form onSubmit={(event) => { event.preventDefault(); onLogin(email, password); }} className="auth-form">
      <label>Email address</label><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      <label>Password</label><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      {error && <div className="inline-error"><AlertCircle size={14}/>{error}</div>}
      <button className="button primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowUpRight size={16}/></button>
    </form>
    <div className="demo-note"><ShieldCheck size={14}/><span>Initial demo account is configured through <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> in your Docker environment.</span></div>
  </div></div>;
}

function IssueEditor({ issue, members, labels, onSave, onClose, busy }) {
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState(issue ? {
    title: issue.title, description: issue.description || "", status: issue.status, priority: issue.priority,
    assigneeId: issue.assigneeId || "", labelIds: issue.labels?.map((x) => x.label.id) || []
  } : emptyIssue);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal editor-modal">
    <div className="modal-head"><div><div className="kicker">{issue ? issue.issueKey : "NEW ISSUE"}</div><h2>{issue ? "Edit issue" : "Create an issue"}</h2><p className="muted">Keep the project work clear and actionable.</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    <form className="editor-form" onSubmit={async (event) => { event.preventDefault(); setSubmitError(""); try { await onSave(form); } catch (error) { setSubmitError(error.message); } }}>
      <label>Title <em>*</em><input className="field" autoFocus minLength="3" maxLength="160" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Login button not working" required /></label>
      <label>Description<textarea className="field textarea" rows="4" maxLength="10000" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the issue, context and expected behavior…" /></label>
      <div className="form-columns">
        <label>Status<select className="field" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{toStatus(s)}</option>)}</select></label>
        <label>Priority<select className="field" value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{toPriority(p)}</option>)}</select></label>
      </div>
      <label>Assignee<select className="field" value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}><option value="">Unassigned</option>{members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.projectRole || m.role}</option>)}</select></label>
      {labels.length > 0 && <div className="label-picker"><span className="form-label">Labels</span><div className="label-options">{labels.map((label) => <button type="button" key={label.id} className={`label-chip ${form.labelIds.includes(label.id) ? "selected" : ""}`} style={{ "--label-color": label.color }} onClick={() => set("labelIds", form.labelIds.includes(label.id) ? form.labelIds.filter((id) => id !== label.id) : [...form.labelIds, label.id])}>{label.name}</button>)}</div></div>}
      {submitError && <div className="inline-error"><AlertCircle size={14}/>{submitError}</div>}
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : issue ? "Save changes" : "Create issue"}</button></div>
    </form>
  </section></div>;
}

function IssueDetail({ issue, onClose, onChanged, members }) {
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState("activity");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState([]);
  const refresh = useCallback(async () => {
    try {
      const [c, a, full] = await Promise.all([
        api(`/api/issues/${issue.id}/comments`), api(`/api/issues/${issue.id}/activity`), api(`/api/issues/${issue.id}`)
      ]);
      setComments(c.data); setActivity(a.data); setAttachments(full.attachments || []);
    } catch (err) { setError(err.message); }
  }, [issue.id]);
  useEffect(() => { refresh(); }, [refresh]);
  async function addComment(event) {
    event.preventDefault(); if (!comment.trim()) return;
    setBusy(true); setError("");
    try { await api(`/api/issues/${issue.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); await refresh(); onChanged(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function uploadFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const data = new FormData(); data.append("file", file); setBusy(true); setError("");
    try { await api(`/api/attachments/issues/${issue.id}/attachments`, { method: "POST", body: data }); await refresh(); onChanged(); }
    catch (err) { setError(err.message); } finally { setBusy(false); event.target.value = ""; }
  }
  async function downloadFile(attachmentId, name) {
    try {
      const token = localStorage.getItem("issuebuddy-token");
      const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const response = await fetch(`${base}/api/attachments/${attachmentId}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not download attachment.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal detail-modal">
    <div className="modal-head"><div><div className="kicker">{issue.issueKey} · ISSUE DETAILS</div><h2>{issue.title}</h2><p className="muted">Reported by {issue.reporter?.name || "Unknown"} · Updated {formatDate(issue.updatedAt)}</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    <div className="detail-meta"><Badge value={issue.status}/><Badge value={issue.priority} kind="priority"/><span className="meta-person"><Users size={13}/>{issue.assignee?.name || "Unassigned"}</span></div>
    <p className="detail-description">{issue.description || "No description provided."}</p>
    {issue.labels?.length > 0 && <div className="detail-labels">{issue.labels.map(({label}) => <span key={label.id} className="label-chip" style={{"--label-color":label.color}}>{label.name}</span>)}</div>}
    <div className="detail-tabs"><button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><Activity size={14}/> Activity</button><button className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}><MessageSquare size={14}/> Comments <span>{comments.length}</span></button><button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}><Paperclip size={14}/> Files <span>{attachments.length}</span></button></div>
    {error && <div className="inline-error"><AlertCircle size={14}/>{error}</div>}
    <div className="detail-content">
      {tab === "activity" && (activity.length ? activity.map((entry) => <div className="activity-item" key={entry.id}><span className="activity-icon"><Activity size={13}/></span><div><strong>{entry.actor?.name || "System"}</strong><span>{entry.action.replaceAll("_", " ").toLowerCase()}</span><small>{formatDate(entry.createdAt)}</small></div></div>) : <div className="quiet-empty">No activity has been recorded yet.</div>)}
      {tab === "comments" && <><div className="comments-list">{comments.length ? comments.map((item) => <article className="comment" key={item.id}><div className="comment-avatar">{item.user.name.slice(0,1).toUpperCase()}</div><div><div className="comment-head"><strong>{item.user.name}</strong><time>{formatDate(item.createdAt)}</time></div><p>{item.body}</p></div></article>) : <div className="quiet-empty">No comments yet. Start the discussion.</div>}</div><form className="comment-form" onSubmit={addComment}><input className="field" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" maxLength="5000"/><button className="button primary" disabled={busy || !comment.trim()}><Send size={14}/> Send</button></form></>}
      {tab === "files" && <><div className="file-list">{attachments.map((file) => <button className="file-row" key={file.id} onClick={() => downloadFile(file.id, file.originalName)}><FileText size={17}/><span><strong>{file.originalName}</strong><small>{(file.size / 1024).toFixed(1)} KB · {file.uploadedBy?.name || "Member"}</small></span><ArrowUpRight size={14}/></button>)}{!attachments.length && <div className="quiet-empty">No files attached yet.</div>}</div><label className="upload-control"><Paperclip size={14}/> Attach a file <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={uploadFile} disabled={busy}/><small>PNG, JPG, WEBP, PDF or TXT · max 10 MB</small></label></>}
    </div>
  </section></div>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("issuebuddy-token"));
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(Boolean(localStorage.getItem("issuebuddy-token")));
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [issues, setIssues] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [view, setView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("issuebuddy-theme") || "dark");

  const logout = useCallback(() => { localStorage.removeItem("issuebuddy-token"); setToken(null); setUser(null); setProjects([]); setProjectId(""); }, []);
  useEffect(() => { const handler = () => logout(); window.addEventListener("issuebuddy:unauthorized", handler); return () => window.removeEventListener("issuebuddy:unauthorized", handler); }, [logout]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("issuebuddy-theme", theme); }, [theme]);

  useEffect(() => {
    if (!token) { setUser(null); setInitializing(false); return; }
    api("/api/auth/me").then((data) => setUser(data.user)).catch(() => logout()).finally(() => setInitializing(false));
  }, [token, logout]);

  const loadProjects = useCallback(async () => {
    const result = await api("/api/projects");
    setProjects(result.data);
    if (result.data.length && !result.data.some((p) => p.id === projectId)) setProjectId(result.data[0].id);
  }, [projectId]);

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    setError("");
    try {
      const [issuesData, analyticsData, membersData, labelsData] = await Promise.all([
        api(`/api/issues?projectId=${projectId}&page=1&pageSize=100`),
        api(`/api/analytics/projects/${projectId}/analytics`),
        api(`/api/projects/${projectId}/members`),
        api(`/api/projects/${projectId}/labels`)
      ]);
      setIssues(issuesData.data); setAnalytics(analyticsData); setMembers(membersData.data); setLabels(labelsData.data);
    } catch (err) { setError(err.message); }
  }, [projectId]);

  const loadNotifications = useCallback(async () => {
    try { const result = await api("/api/notifications"); setNotifications(result.data); setUnread(result.unread); } catch { /* Notification panel is non-critical. */ }
  }, []);

  useEffect(() => { if (user) loadProjects().catch((err) => setError(err.message)); }, [user, loadProjects]);
  useEffect(() => { if (projectId) loadProjectData(); }, [projectId, loadProjectData]);
  useEffect(() => { if (user) loadNotifications(); }, [user, loadNotifications]);

  const project = projects.find((p) => p.id === projectId);
  const filteredIssues = useMemo(() => issues.filter((issue) => {
    const q = query.toLowerCase();
    return (!q || `${issue.issueKey} ${issue.title} ${issue.description}`.toLowerCase().includes(q)) &&
      (statusFilter === "ALL" || issue.status === statusFilter) &&
      (priorityFilter === "ALL" || issue.priority === priorityFilter);
  }), [issues, query, statusFilter, priorityFilter]);

  async function signIn(email, password) {
    setBusy(true); setLoginError("");
    try { const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem("issuebuddy-token", result.token); setToken(result.token); setUser(result.user); }
    catch (err) { setLoginError(err.message); } finally { setBusy(false); }
  }
  async function refreshAll() { await Promise.all([loadProjectData(), loadNotifications()]); }
  async function saveIssue(form) {
    if (!projectId) throw new Error("Create or select a project first.");
    setBusy(true); setError("");
    try {
      const payload = { ...form, assigneeId: form.assigneeId || null };
      if (editor?.id) await api(`/api/issues/${editor.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api(`/api/issues?projectId=${projectId}`, { method: "POST", body: JSON.stringify({ ...payload, projectId }) });
      setEditor(null); setNotice(editor?.id ? "Issue updated." : "Issue created."); await refreshAll();
    } catch (err) { setError(err.message); throw err; } finally { setBusy(false); }
  }
  async function deleteIssue(issue) {
    if (!window.confirm(`Delete ${issue.issueKey}? This cannot be undone.`)) return;
    try { await api(`/api/issues/${issue.id}`, { method: "DELETE" }); setNotice(`${issue.issueKey} deleted.`); setDetail(null); await refreshAll(); }
    catch (err) { setError(err.message); }
  }
  async function updateStatus(issue, status) {
    try { await api(`/api/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await refreshAll(); }
    catch (err) { setError(err.message); }
  }
  async function createProject() {
    const name = window.prompt("Project name"); if (!name?.trim()) return;
    const suggested = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "WORK";
    const key = window.prompt("Project key (2–12 letters/numbers)", suggested); if (!key) return;
    try { const result = await api("/api/projects", { method: "POST", body: JSON.stringify({ name, key, description: "" }) }); await loadProjects(); setProjectId(result.id); setView("dashboard"); setNotice("Project created."); }
    catch (err) { setError(err.message); }
  }
  async function markNotification(item) {
    if (!item.readAt) { await api(`/api/notifications/${item.id}/read`, { method: "PATCH" }); await loadNotifications(); }
    if (item.issueId) { const selected = issues.find((i) => i.id === item.issueId); if (selected) setDetail(selected); }
  }
  async function markAllRead() { await api("/api/notifications/read-all", { method: "POST" }); await loadNotifications(); }

  if (initializing) return <div className="loading-screen"><div className="brand-mark"><Bug size={18}/></div><span>Loading IssueBuddy…</span></div>;
  if (!token || !user) return <Login onLogin={signIn} error={loginError} busy={busy}/>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark"><Bug size={18}/></span><span>Issue<span className="brand-light">Buddy</span></span></a>
      <div className="workspace-switch"><span className="workspace-square">{project?.key?.slice(0,1) || "I"}</span><span><small>WORKSPACE</small><strong>{project?.name || "Select project"}</strong></span><ChevronDown size={14}/></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><LayoutDashboard size={16}/> Overview</button>
        <button className={view === "issues" ? "active" : ""} onClick={() => setView("issues")}><Ticket size={16}/> Issues <span>{issues.length}</span></button>
        <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}><Columns3 size={16}/> Board</button>
      </nav>
      <div className="side-divider"/><div className="side-label side-label-row">PROJECTS <button title="Create project" onClick={createProject}><Plus size={14}/></button></div>
      <div className="project-list">{projects.map((p) => <button key={p.id} className={projectId === p.id ? "selected" : ""} onClick={() => { setProjectId(p.id); setView("dashboard"); }}><span className="project-dot">{p.key.slice(0,1)}</span><span>{p.name}</span><small>{p._count?.issues ?? ""}</small></button>)}</div>
      <div className="sidebar-bottom"><div className="user-card"><div className="user-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.role}</small></div><button title="Sign out" onClick={logout}><LogOut size={15}/></button></div><div className="sidebar-meta">ISSUEBUDDY · PHASE 2</div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Projects <span>/</span> <strong>{project?.key || "Workspace"}</strong> <span>/</span> {view === "dashboard" ? "Overview" : view === "kanban" ? "Board" : "Issues"}</div>
        <div className="topbar-actions"><button className="icon-btn" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}</button><div className="notification-wrap"><button className="icon-btn notification-button" title="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={16}/>{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</button>
          {showNotifications && <div className="notification-popover"><div className="popover-head"><strong>Notifications</strong><button onClick={markAllRead}>Mark all read</button></div>{notifications.length ? notifications.slice(0,8).map((item) => <button className={`notification-item ${!item.readAt ? "unread" : ""}`} key={item.id} onClick={() => markNotification(item)}><span className="notification-mark"><Bell size={13}/></span><span><strong>{item.message}</strong><small>{formatDate(item.createdAt)}</small></span></button>) : <div className="quiet-empty">You're all caught up.</div>}</div>}
        </div><div className="top-user"><span className="user-avatar small">{user.name.slice(0,1).toUpperCase()}</span><span>{user.name}</span></div></div>
      </header>

      <div className="page-content">
        {error && <div className="alert error"><AlertCircle size={15}/>{error}<button onClick={() => setError("")}><X size={14}/></button></div>}
        {notice && <div className="alert success"><Check size={15}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}
        {!project ? <div className="empty-project panel"><FolderKanban size={30}/><h2>No project yet</h2><p>Create a project to start tracking issues.</p>{["ADMIN", "MANAGER"].includes(user.role) && <button className="button primary" onClick={createProject}><Plus size={15}/> Create project</button>}</div> : <>
          {view === "dashboard" && <Dashboard project={project} analytics={analytics} issues={issues} onIssues={() => setView("issues")} onOpen={setDetail}/>}
          {(view === "issues" || view === "kanban") && <>
            <div className="page-heading"><div><div className="kicker">{project.key} / TRACKING</div><h1>{view === "kanban" ? "Board" : "Issues"}</h1><p className="muted">Manage priorities, owners and delivery status.</p></div><div className="heading-actions"><button className="button ghost" onClick={refreshAll}><RefreshCw size={14}/> Refresh</button><button className="button primary" onClick={() => setEditor({})}><Plus size={15}/> Create issue</button></div></div>
            <div className="issues-toolbar"><div className="search-input"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search issues…"/></div><select className="field compact" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{toStatus(s)}</option>)}</select><select className="field compact" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="ALL">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{toPriority(p)}</option>)}</select><span className="result-count">{filteredIssues.length} results</span></div>
            {view === "issues" ? <div className="panel issue-table-panel"><div className="table-wrap"><table className="issue-table"><thead><tr><th>Issue</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Updated</th><th/></tr></thead><tbody>{filteredIssues.map((issue) => <tr key={issue.id}><td><button className="issue-title" onClick={() => setDetail(issue)}><span className="issue-key">{issue.issueKey}</span><strong>{issue.title}</strong></button><div className="issue-labels">{issue.labels?.map(({label}) => <span key={label.id} style={{"--label-color": label.color}}>{label.name}</span>)}</div></td><td><Badge value={issue.status}/></td><td><Badge value={issue.priority} kind="priority"/></td><td><span className="assignee"><i>{issue.assignee?.name?.slice(0,1) || "—"}</i>{issue.assignee?.name || "Unassigned"}</span></td><td className="date-text">{formatDate(issue.updatedAt)}</td><td><button className="icon-btn tiny" onClick={() => setEditor(issue)} title="Edit issue"><Pencil size={14}/></button></td></tr>)}{!filteredIssues.length && <tr><td colSpan="6" className="table-empty">No matching issues. Create one or adjust your filters.</td></tr>}</tbody></table></div><div className="table-foot">Showing {filteredIssues.length} of {issues.length} issues</div></div> : <div className="kanban-board">{STATUSES.map((status) => <div className="kanban-column" key={status}><div className="kanban-head"><Badge value={status}/><span>{filteredIssues.filter((i) => i.status === status).length}</span></div>{filteredIssues.filter((i) => i.status === status).map((issue) => <article className="kanban-card" key={issue.id}><div className="kanban-card-top"><small>{issue.issueKey}</small><button className="icon-btn tiny" onClick={() => setEditor(issue)}><Pencil size={12}/></button></div><button className="kanban-title" onClick={() => setDetail(issue)}>{issue.title}</button><p>{issue.description}</p><div className="kanban-card-bottom"><Badge value={issue.priority} kind="priority"/><span className="assignee"><i>{issue.assignee?.name?.slice(0,1) || "—"}</i>{issue.assignee?.name || "Unassigned"}</span></div><select className="status-select" value={issue.status} onChange={(e) => updateStatus(issue, e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{toStatus(s)}</option>)}</select></article>)}</div>)}</div>}
          </>}
        </>}
        <footer className="page-footer"><span>IssueBuddy <b>PHASE 2</b></span><span><i className="online-dot"/> Connected to API and PostgreSQL</span></footer>
      </div>
    </main>
    {editor && <IssueEditor issue={editor.id ? editor : null} members={members} labels={labels} busy={busy} onClose={() => setEditor(null)} onSave={saveIssue}/>}
    {detail && <IssueDetail issue={detail} onClose={() => setDetail(null)} onChanged={refreshAll} members={members}/>}
  </div>;
}

function Dashboard({ project, analytics, issues, onIssues, onOpen }) {
  const status = analytics?.status || {};
  const priority = analytics?.priority || {};
  const total = analytics?.total ?? issues.length;
  const maxStatus = Math.max(1, ...Object.values(status));
  return <>
    <div className="page-heading dashboard-heading"><div><div className="kicker">{project.key} / OVERVIEW</div><h1>Good work starts here.</h1><p className="muted">A snapshot of what's happening in {project.name}.</p></div><button className="button primary" onClick={onIssues}><Ticket size={15}/> View all issues</button></div>
    <div className="metric-grid"><Metric icon={<Ticket size={17}/>} label="Total issues" value={total} tone="purple"/><Metric icon={<Clock3 size={17}/>} label="In progress" value={status.IN_PROGRESS || 0} tone="blue"/><Metric icon={<AlertCircle size={17}/>} label="Urgent" value={priority.URGENT || 0} tone="red"/><Metric icon={<Check size={17}/>} label="Assigned to me" value={analytics?.assignedToMe || 0} tone="green"/></div>
    <div className="dashboard-grid"><section className="panel overview-panel"><div className="section-head"><div><h2>Issue workflow</h2><p className="muted">Distribution by current status</p></div><Gauge size={17}/></div><div className="workflow-bars">{STATUSES.map((s) => <div className="workflow-row" key={s}><span>{toStatus(s)}</span><div className="bar-track"><i className={`bar-${s.toLowerCase()}`} style={{width:`${((status[s] || 0) / maxStatus) * 100}%`}}/></div><strong>{status[s] || 0}</strong></div>)}</div><div className="workflow-total"><span>Total tracked issues</span><strong>{total}</strong></div></section>
      <section className="panel priority-panel"><div className="section-head"><div><h2>Priority breakdown</h2><p className="muted">Where attention is needed</p></div><Activity size={17}/></div><div className="priority-grid">{PRIORITIES.map((p) => <div className={`priority-stat priority-stat-${p.toLowerCase()}`} key={p}><span>{toPriority(p)}</span><strong>{priority[p] || 0}</strong></div>)}</div><div className="priority-foot">Review urgent and high-priority work first.</div></section>
      <section className="panel recent-panel"><div className="section-head"><div><h2>Recently updated</h2><p className="muted">Latest activity in this project</p></div><button className="text-button" onClick={onIssues}>View all</button></div><div className="recent-list">{(analytics?.recent || []).map((issue) => <button className="recent-item" key={issue.id} onClick={() => onOpen(issue)}><span className="recent-bug"><Bug size={14}/></span><span className="recent-info"><strong>{issue.title}</strong><small>{issue.issueKey} · {issue.assignee?.name || "Unassigned"}</small></span><Badge value={issue.status}/></button>)}{!(analytics?.recent || []).length && <div className="quiet-empty">No issues yet. Create the first one.</div>}</div></section>
    </div>
  </>;
}
function Metric({icon,label,value,tone}) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div><ArrowUpRight className="metric-arrow" size={15}/></div>; }

export default App;
