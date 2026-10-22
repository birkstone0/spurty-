import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Users, FileText, User as UserIcon, Eye, EyeOff, ChevronDown,
  LogOut, Plus, Search, ExternalLink, X, Pencil, Trash2, Shield, CheckCircle
} from 'lucide-react';
import { apiUrl } from './config';

// Tables below this viewport width render as stacked cards instead of scrolling sideways.
const CARD_TABLE_QUERY = '(max-width: 640px)';

const AUTH_HEADERS = (token) => ({ 'Authorization': `Bearer ${token}` });

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  } catch { return '—'; }
}

// Short date for narrow table cells.
function fmtDateShort(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

// True when the viewport is narrow enough that tables should render as cards.
function useIsCardTable() {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(CARD_TABLE_QUERY).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(CARD_TABLE_QUERY);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return matches;
}

// Row checkbox with a label for assistive tech and a bigger touch target.
function RowCheck({ checked, onChange, label }) {
  return (
    <label className="row-check-wrap">
      <input
        type="checkbox"
        className="row-check"
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
    </label>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const [toast, setToast] = useState('');

  // Action modals driven by the Actions dropdown (Overview + Accounts).
  const [registerOpen, setRegisterOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    setAccountsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/accounts'), { headers: AUTH_HEADERS(token) });
      if (res.status === 401 || res.status === 403) { handleLogout(); return; }
      const data = await res.json();
      setAccounts(data);
    } catch { /* handled by empty/error states */ } finally {
      setAccountsLoading(false);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    if (!token || role !== 'admin') return;
    setLogsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/logs'), { headers: AUTH_HEADERS(token) });
      if (res.status === 401 || res.status === 403) { handleLogout(); return; }
      const data = await res.json();
      setLogs(data);
    } catch { /* handled below */ } finally {
      setLogsLoading(false);
    }
  }, [token, role]);

  const hasLoadedForToken = useRef(null);

  useEffect(() => {
    if (!token) return;
    if (hasLoadedForToken.current === token) return;
    hasLoadedForToken.current = token;
    fetchAccounts();
    fetchLogs();
  }, [token, fetchAccounts, fetchLogs]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    setToken(null); setRole(null); setUsername(null);
    setView('dashboard');
  }

  const openRegisterModal = () => setRegisterOpen(true);
  const openAddAccountModal = () => setAddAccountOpen(true);
  const openClaimModal = () => setClaimOpen(true);

  if (!token) {
    return <LoginScreen onLogin={(t, r, u) => { setToken(t); setRole(r); setUsername(u); }} />;
  }

  return (
    <div className="app-layout">
      {toast && <div className="toast">{toast}</div>}

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
          <X />
        </button>
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">SportsPlus</div>
          <div className="sidebar-brand-sub">Operations Console</div>
        </div>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav">
          <NavItem icon={LayoutDashboard} label="Overview" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setSidebarOpen(false); }} />
          <NavItem icon={Users} label="Accounts" active={view === 'accounts'} onClick={() => { setView('accounts'); setSidebarOpen(false); }} />
          {role === 'admin' && (
            <NavItem icon={FileText} label="System Logs" active={view === 'logs'} onClick={() => { setView('logs'); setSidebarOpen(false); }} />
          )}
          <NavItem icon={UserIcon} label="Profile" active={view === 'profile'} onClick={() => { setView('profile'); setSidebarOpen(false); }} />
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-operator">
            <span className="operator-username">{username || 'Operator'}</span>
            <span className="operator-role">{role === 'admin' ? 'Administrator' : 'Operator'}</span>
          </div>
          <NavItem icon={LogOut} label="Sign out" onClick={handleLogout} danger />
        </div>
      </aside>

      <div className="main-content">
        <button className="nav-toggle" onClick={() => setSidebarOpen(true)}>
          <LayoutDashboard size={15} /> Menu
        </button>

        {view === 'dashboard' && (
          <OverviewView
            accounts={accounts}
            loading={accountsLoading}
            onOpenRegister={openRegisterModal}
            onOpenAddAccount={openAddAccountModal}
            onOpenClaim={openClaimModal}
            onGoLogs={() => { setView('logs'); setSidebarOpen(false); }}
            onGoAccounts={() => { setView('accounts'); setSidebarOpen(false); }}
          />
        )}
        {view === 'accounts' && (
          <AccountsView
            accounts={accounts}
            loading={accountsLoading}
            token={token}
            onRefresh={fetchAccounts}
            notify={notify}
            onOpenRegister={openRegisterModal}
            onOpenClaim={openClaimModal}
          />
        )}
        {view === 'logs' && role === 'admin' && (
          <LogsView logs={logs} loading={logsLoading} />
        )}
        {view === 'profile' && (
          <ProfileView username={username} role={role} token={token} notify={notify} />
        )}

        {registerOpen && (
          <RegisterModal
            token={token}
            accounts={accounts}
            onClose={() => setRegisterOpen(false)}
            onDone={() => { setRegisterOpen(false); fetchAccounts(); fetchLogs(); notify('Registration submitted'); }}
            notify={notify}
          />
        )}
        {addAccountOpen && (
          <AddAccountModal
            token={token}
            onClose={() => setAddAccountOpen(false)}
            onSaved={() => { setAddAccountOpen(false); fetchAccounts(); notify('Account created'); }}
          />
        )}
        {claimOpen && (
          <ClaimModal
            token={token}
            accounts={accounts}
            onClose={() => setClaimOpen(false)}
            onDone={() => { fetchAccounts(); notify('Promo claim processed'); }}
          />
        )}
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, danger }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} onClick={onClick}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

/* ============================================================
   LOGIN
   ============================================================ */
function LoginScreen({ onLogin }) {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign in failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('username', data.username);
      onLogin(data.token, data.role, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <div className="login-brand-top">
          <div className="login-brand-name">SportsPlus</div>
          <div className="login-brand-sub">Operations Console</div>
          <div className="login-brand-accent" />
        </div>
        <div className="login-brand-footer">Secure access to your operations workspace.</div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-box">
          <div className="login-mobile-brand">
            <div className="login-brand-name">SportsPlus</div>
            <div className="login-brand-accent" />
          </div>
          <h1 className="login-form-title">Welcome back</h1>
          <p className="login-form-sub">Sign in to your SportsPlus operations account.</p>

          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-username">Email or username</label>
              <input
                id="login-username"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter your email or username"
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   OVERVIEW
   ============================================================ */
function OverviewView({ accounts, loading, onOpenRegister, onOpenAddAccount, onOpenClaim, onGoLogs, onGoAccounts }) {
  const total = accounts.length;
  const success = accounts.filter(a => a.status === 'verified').length;
  const failed = accounts.filter(a => a.status === 'failed').length;
  const pending = accounts.filter(a => a.status === 'otp_sent').length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Overview</div>
          <h1 className="page-title">Operations overview</h1>
          <p className="page-desc">Every registration attempt, verified session and blocked login across the SportsPlus network.</p>
        </div>
        <ActionsButton onRegister={onOpenRegister} onAddAccount={onOpenAddAccount} onClaim={onOpenClaim} />
      </div>

      <div className="stats-grid">
        <StatPanel label="Total attempts" value={total} desc="Every event recorded in the console" />
        <StatPanel label="Success" value={success} desc="Sessions completed end to end" />
        <StatPanel label="Failed" value={failed} desc="Blocked or timed-out attempts" danger />
        <StatPanel label="Pending OTP" value={pending} desc="Awaiting verification code" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Recent activity</div>
            <div className="panel-sub">Latest sign-in events</div>
          </div>
          <div className="panel-meta">
            <span className="count-badge">{total} entries</span>
            <button className="text-link" onClick={onGoLogs}>System Logs <ExternalLink size={13} /></button>
          </div>
        </div>
        <RecentActivityTable accounts={accounts} loading={loading} onGoAccounts={onGoAccounts} />
      </div>
    </>
  );
}

function StatPanel({ label, value, desc, danger }) {
  return (
    <div className="stat-panel">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${danger ? 'danger' : ''}`}>{value}</div>
      <div className="stat-desc">{desc}</div>
    </div>
  );
}

function ActionsButton({ onRegister, onAddAccount, onClaim }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const run = (fn) => () => { setOpen(false); if (fn) fn(); };

  return (
    <div className="actions-wrap" ref={ref}>
      <button className="btn btn-primary" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        Actions <ChevronDown size={14} />
      </button>
      {open && (
        <div className="actions-menu" role="menu">
          <button className="actions-menu-item" role="menuitem" onClick={run(onRegister)}><Plus size={15} /> Register user</button>
          <button className="actions-menu-item" role="menuitem" onClick={run(onAddAccount)}><UserIcon size={15} /> Add account</button>
          <button className="actions-menu-item" role="menuitem" onClick={run(onClaim)}><Shield size={15} /> Claim code</button>
        </div>
      )}
    </div>
  );
}

function RecentActivityTable({ accounts, loading }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const isCardTable = useIsCardTable();

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const info = `${a.mobile} ${a.firstName} ${a.lastName} ${a.errorReason || ''}`.toLowerCase();
    if (q && !info.includes(q)) return false;
    if (status !== 'all' && a.status !== status) return false;
    return true;
  });

  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <Search />
          <input type="text" placeholder="Search mobile or message" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="select-wrap">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">ALL STATUSES</option>
            <option value="verified">SUCCESS</option>
            <option value="failed">FAILED</option>
            <option value="otp_sent">PENDING</option>
          </select>
          <ChevronDown />
        </div>
      </div>
      <TableState loading={loading} empty={filtered.length === 0} emptyText="No activity matches your filters." />
      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table className={`data-table ${isCardTable ? 'mobile-cards' : ''}`}>
            <thead>
              <tr><th style={{ width: 40 }}><input type="checkbox" className="row-check" /></th><th>Date</th><th>Status</th><th>Information</th></tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a._id}>
                  <td className="cell-select" data-label="Select">
                    <RowCheck checked={false} onChange={() => {}} label="Select row" />
                  </td>
                  <td className="cell-muted" data-label="Date">{isCardTable ? fmtDateShort(a.createdAt) : fmtDate(a.createdAt)}</td>
                  <td data-label="Status"><StatusBadge status={a.status} /></td>
                  <td className="cell-muted cell-full" data-label="Information">
                    Mobile <strong className="cell-strong">{a.mobile}</strong>
                    {a.errorReason && <span className="cell-danger"> · {a.errorReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }) {
  const map = { verified: 'success', failed: 'failed', otp_sent: 'pending' };
  const label = { verified: 'Success', failed: 'Failed', otp_sent: 'Pending' };
  return <span className={`status-dot ${map[status] || 'muted'}`}>{label[status] || status}</span>;
}

function KYCBadge({ kyc }) {
  const s = (kyc || 'none').toLowerCase();
  const label = s === 'approved' ? 'Approved' : s === 'rejected' ? 'Rejected' : s === 'pending' ? 'Pending' : 'None';
  return <span className={`kyc-badge ${s}`}>{label}</span>;
}

function TableState({ loading, empty, emptyText }) {
  if (loading) return <div className="table-state"><div className="spinner" /><div className="state-title">Loading records</div></div>;
  if (empty) return <div className="table-state"><div className="state-title">Nothing here</div><div className="state-sub">{emptyText || 'No records match the current view.'}</div></div>;
  return null;
}

/* ============================================================
   ACCOUNTS
   ============================================================ */
function AccountsView({ accounts, loading, token, onRefresh, notify, onOpenRegister, onOpenClaim }) {
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [visiblePw, setVisiblePw] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const isCardTable = useIsCardTable();

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const hay = `${a.firstName} ${a.lastName} ${a.mobile}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (kycFilter !== 'all' && (a.kycStatus || 'none').toLowerCase() !== kycFilter) return false;
    return true;
  });

  const visibleIds = filtered.map(a => a._id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

  const toggleAll = () => {
    setSelected(allVisibleSelected ? selected.filter(id => !visibleIds.includes(id)) : [...new Set([...selected, ...visibleIds])]);
  };

  const toggleOne = (id) => {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(apiUrl(`/api/accounts/${deleteTarget._id}`), { method: 'DELETE', headers: AUTH_HEADERS(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      notify('Account deleted');
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      notify(e.message);
    }
  };

  const confirmBulkDelete = async () => {
    try {
      const res = await fetch(apiUrl('/api/accounts/bulk-delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ ids: selected })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
      notify(`${data.deleted} account${data.deleted === 1 ? '' : 's'} deleted`);
      setBulkDeleteOpen(false);
      setSelected([]);
      onRefresh();
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Accounts</div>
          <h1 className="page-title">Customer accounts</h1>
          <p className="page-desc">Manually entered and registered accounts, with KYC state and claim codes.</p>
        </div>
        <ActionsButton
          onRegister={onOpenRegister}
          onAddAccount={() => setAddOpen(true)}
          onClaim={onOpenClaim}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">All accounts</div>
            <div className="panel-sub">Newest first</div>
          </div>
          <span className="count-badge">{accounts.length} records</span>
        </div>

        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input type="text" placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="select-wrap">
            <select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)} aria-label="Filter by KYC status">
              <option value="all">ALL KYC</option>
              <option value="approved">APPROVED</option>
              <option value="pending">PENDING</option>
              <option value="rejected">REJECTED</option>
              <option value="none">NONE</option>
            </select>
            <ChevronDown />
          </div>
          {selected.length > 0 && (
            <button className="btn btn-danger" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 size={13} /> Delete ({selected.length})
            </button>
          )}
        </div>

        <TableState loading={loading} empty={filtered.length === 0} emptyText="No accounts match the current view." />
        {!loading && filtered.length > 0 && (
          <div className="table-wrap">
            <table className={`data-table ${isCardTable ? 'mobile-cards' : ''}`}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" className="row-check" checked={allVisibleSelected} onChange={toggleAll} /></th>
                  <th>Date</th><th>Name</th><th>Mobile</th><th>Password</th><th>KYC Status</th><th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a._id}>
                    <td className="cell-select" data-label="Select">
                      <RowCheck checked={selected.includes(a._id)} onChange={() => toggleOne(a._id)} label={`Select ${a.firstName} ${a.lastName}`} />
                    </td>
                    <td className="cell-muted" data-label="Date">{isCardTable ? fmtDateShort(a.createdAt) : fmtDate(a.createdAt)}</td>
                    <td className="cell-strong" data-label="Name">{a.firstName} {a.lastName}</td>
                    <td className="mono" data-label="Mobile">{a.mobile}</td>
                    <td data-label="Password">
                      <span className="pw-value">
                        {a.plainPassword ? (
                          <>
                            <span className="mono">{visiblePw === a._id ? a.plainPassword : '••••••••'}</span>
                            <button className="icon-btn" onClick={() => setVisiblePw(visiblePw === a._id ? null : a._id)} aria-label={visiblePw === a._id ? 'Hide password' : 'Show password'}>
                              {visiblePw === a._id ? <EyeOff /> : <Eye />}
                            </button>
                          </>
                        ) : <span className="cell-faint">—</span>}
                      </span>
                    </td>
                    <td data-label="KYC Status"><KYCBadge kyc={a.kycStatus} /></td>
                    <td className="cell-actions" data-label="Actions">
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => setEditTarget(a)} aria-label="Edit account"><Pencil /></button>
                        <button className="icon-btn danger" onClick={() => setDeleteTarget(a)} aria-label="Delete account"><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <AddAccountModal
          token={token}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); onRefresh(); notify('Account created'); }}
        />
      )}
      {editTarget && (
        <EditAccountModal
          token={token}
          account={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); onRefresh(); notify('Account updated'); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete account"
          desc={`Delete the account for ${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.mobile})? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {bulkDeleteOpen && (
        <ConfirmModal
          title="Delete selected accounts"
          desc={`Delete ${selected.length} account${selected.length === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}
    </>
  );
}

/* ============================================================
   SYSTEM LOGS
   ============================================================ */
function LogsView({ logs, loading }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [detail, setDetail] = useState(null);
  const isCardTable = useIsCardTable();

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const hay = `${l.firstName} ${l.lastName} ${l.mobile} ${l.errorReason || ''} ${l.dob || ''}`.toLowerCase();
    return !q || hay.includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">System Logs</div>
          <h1 className="page-title">Failed attempts</h1>
          <p className="page-desc">Raw failure detail behind every blocked registration and login, kept for review.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Failure detail</div>
            <div className="panel-sub">Grouped by attempt timestamp</div>
          </div>
          <span className="count-badge">{logs.length} records</span>
        </div>

        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input type="text" placeholder="Search name, mobile or reason" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="select-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by timestamp">
              <option value="newest">NEWEST FIRST</option>
              <option value="oldest">OLDEST FIRST</option>
            </select>
            <ChevronDown />
          </div>
        </div>

        <TableState loading={loading} empty={sorted.length === 0} emptyText="No failed attempts recorded." />
        {!loading && sorted.length > 0 && (
          <div className="table-wrap">
            <table className={`data-table ${isCardTable ? 'mobile-cards' : ''}`}>
              <thead>
                <tr><th style={{ width: 40 }}><input type="checkbox" className="row-check" /></th><th>Date</th><th>Name</th><th>Date of birth</th><th>Mobile</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {sorted.map(l => (
                  <tr key={l._id} style={{ cursor: 'pointer' }} onClick={() => setDetail(l)}>
                    <td className="cell-select" data-label="Select" onClick={(e) => e.stopPropagation()}>
                      <RowCheck checked={false} onChange={() => {}} label="Select row" />
                    </td>
                    <td className="cell-muted" data-label="Date">{isCardTable ? fmtDateShort(l.createdAt) : fmtDate(l.createdAt)}</td>
                    <td className="cell-strong" data-label="Name">{l.firstName} {l.lastName}</td>
                    <td className="cell-muted" data-label="Date of birth">{l.dob || '—'}</td>
                    <td className="mono" data-label="Mobile">{l.mobile || '—'}</td>
                    <td className="cell-danger cell-full" data-label="Reason">{l.errorReason || 'Blocked'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <LogDetailModal log={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

function LogDetailModal({ log, onClose }) {
  return (
    <Modal onClose={onClose} title="Failure record" desc="Diagnostic detail for the blocked attempt">
      <div className="profile-list">
        <div className="profile-row"><span className="row-label">Date</span><span className="row-value">{fmtDate(log.createdAt)}</span></div>
        <div className="profile-row"><span className="row-label">Name</span><span className="row-value">{log.firstName} {log.lastName}</span></div>
        <div className="profile-row"><span className="row-label">Date of birth</span><span className="row-value">{log.dob || '—'}</span></div>
        <div className="profile-row"><span className="row-label">Mobile</span><span className="row-value mono">{log.mobile || '—'}</span></div>
        <div className="profile-row"><span className="row-label">Reason</span><span className="row-value">{log.errorReason || 'No reason recorded'}</span></div>
        <div className="profile-row"><span className="row-label">Status</span><span className="row-value"><StatusBadge status="failed" /></span></div>
      </div>
    </Modal>
  );
}

/* ============================================================
   PROFILE
   ============================================================ */
function ProfileView({ username, role, token, notify }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/me'), { headers: AUTH_HEADERS(token) })
      .then(r => r.json())
      .then(setMe)
      .catch(() => {});
  }, [token]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Profile</div>
          <h1 className="page-title">Your account</h1>
          <p className="page-desc">Your operator identity and password for this console.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="panel profile-card">
          <div className="profile-avatar">{(username || 'O').charAt(0).toUpperCase()}</div>
          <div className="profile-name">{me?.username || username}</div>
          <div className="profile-email">{me?.role === 'admin' ? 'Administrator account' : 'Operator account'}</div>

          <div className="profile-list">
            <div className="profile-row"><span className="row-label">Role</span><span className="row-value">{role === 'admin' ? 'Admin' : 'Operator'}</span></div>
            <div className="profile-row"><span className="row-label">Access since</span><span className="row-value">{me?.createdAt ? fmtDate(me.createdAt) : '—'}</span></div>
            <div className="profile-row"><span className="row-label">Operator ID</span><span className="row-value mono">{me?._id ? me._id.slice(0, 12) : '—'}</span></div>
          </div>

          <button className="btn btn-outline btn-block" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('role'); localStorage.removeItem('username'); window.location.reload(); }}>
            Sign out
          </button>
        </div>

        <ChangePassword token={token} notify={notify} />
      </div>
    </>
  );
}

function ChangePassword({ token, notify }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (loading) return;
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('New password and confirmation do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/me/password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');
      setSuccess('Password updated successfully.');
      setCurrent(''); setNext(''); setConfirm('');
      notify('Password updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (k) => () => setShow(s => ({ ...s, [k]: !s[k] }));

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Change password</div>
          <div className="panel-sub">Confirm your current password, then set a new one.</div>
        </div>
      </div>
      <form className="panel-body" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <div className="field">
          <label htmlFor="cur-pw">Current password</label>
          <div className="input-wrap">
            <input id="cur-pw" type={show.current ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Enter current password" autoComplete="current-password" required />
            <button type="button" className="pw-toggle" onClick={toggle('current')} aria-label="Toggle visibility">{show.current ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-pw">New password</label>
          <div className="input-wrap">
            <input id="new-pw" type={show.next ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required />
            <button type="button" className="pw-toggle" onClick={toggle('next')} aria-label="Toggle visibility">{show.next ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="confirm-pw">Confirm new password</label>
          <div className="input-wrap">
            <input id="confirm-pw" type={show.confirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" required />
            <button type="button" className="pw-toggle" onClick={toggle('confirm')} aria-label="Toggle visibility">{show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '0.5rem' }} disabled={loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

/* ============================================================
   MODALS
   ============================================================ */
function Modal({ onClose, title, desc, wide, children, foot }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        {(title || desc) && (
          <div className="modal-head">
            <div className="modal-title">{title}</div>
            {desc && <div className="modal-desc">{desc}</div>}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

function ConfirmModal({ title, desc, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} title={title} desc={desc}
      foot={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 300 }}>This action cannot be undone.</p>
    </Modal>
  );
}

function AddAccountModal({ token, onClose, onSaved }) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [kyc, setKyc] = useState('No');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (loading) return;
    const clean = mobile.replace(/\D/g, '');
    if (clean.length < 7) { setError('Enter a valid mobile number.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/accounts/add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ mobile: clean, password, kycVerified: kyc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add account');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Add account manually" desc="Create an operator-side account with its own password."
      foot={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Adding...' : 'Add account'}</button>
        </>
      }>
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label htmlFor="am-mobile">Mobile</label>
          <input id="am-mobile" type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 9171234567" required />
        </div>
        <div className="field">
          <label htmlFor="am-pw">Password</label>
          <div className="input-wrap">
            <input id="am-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Account password" autoComplete="new-password" required />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label="Toggle visibility">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        <div className="field">
          <label>KYC verified?</label>
          <div className="radio-row">
            <label className="radio-option"><input type="radio" name="am-kyc" checked={kyc === 'Yes'} onChange={() => setKyc('Yes')} /> Yes</label>
            <label className="radio-option"><input type="radio" name="am-kyc" checked={kyc === 'No'} onChange={() => setKyc('No')} /> No</label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function EditAccountModal({ token, account, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(account.firstName || '');
  const [lastName, setLastName] = useState(account.lastName || '');
  const [mobile, setMobile] = useState(account.mobile || '');
  const [kyc, setKyc] = useState(account.kycStatus || 'none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/accounts/${account._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ firstName, lastName, mobile: mobile.replace(/\D/g, ''), kycStatus: kyc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Edit account" desc="Update the customer account record."
      foot={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save changes'}</button>
        </>
      }>
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label htmlFor="ea-first">First name</label>
          <input id="ea-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ea-last">Last name</label>
          <input id="ea-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ea-mobile">Mobile</label>
          <input id="ea-mobile" type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ea-kyc">KYC status</label>
          <div className="select-wrap">
            <select id="ea-kyc" value={kyc} onChange={(e) => setKyc(e.target.value)}>
              <option value="none">None</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   REGISTRATION (Actions -> Register user)
   ============================================================ */
function RegisterModal({ token, accounts, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [verifiedMobile, setVerifiedMobile] = useState('');

  const submitRegistration = async (e) => {
    e.preventDefault();
    setError('');
    if (loading) return;

    const cleanMobile = mobile.replace(/\D/g, '');
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');
    const age = dob ? calculateAge(dob) : 0;

    if (cleanMobile.length !== 10) { setError('Please enter a valid 10-digit mobile number.'); return; }
    if (!firstName) { setError('Full name is required.'); return; }
    if (!lastName) { setError('Please provide a first and last name.'); return; }
    if (!dob) { setError('Date of birth is required.'); return; }
    if (!age || Number.isNaN(age)) { setError('Date of birth could not be read. Use YYYY-MM-DD.'); return; }
    if (age < 21) { setError(`Registration blocked: the account holder is ${age} years old. Age 21 or above is required.`); return; }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ mobile: cleanMobile, firstName, lastName, dob, age })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) { setError('Your session has expired. Sign in again.'); return; }
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setGeneratedPassword(data.password);
      setVerifiedMobile(cleanMobile);
      setOtpValue('');
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (loading) return;
    if (!otpValue.trim()) { setError('Enter the verification code sent to the mobile number.'); return; }

    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({
          otpValue: otpValue.trim(),
          mobile: verifiedMobile,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' '),
          dob,
          age: calculateAge(dob),
          password: generatedPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) { setError('Your session has expired. Sign in again.'); return; }
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Register user" desc="Submit a new registration and complete SMS verification."
      foot={
        step === 3 ? (
          <>
            <span className="modal-foot-note">Registration complete</span>
            <button className="btn btn-primary" onClick={onDone}>Done</button>
          </>
        ) : step === 2 ? (
          <>
            <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn btn-primary" onClick={submitOtp} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify account'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn btn-primary" onClick={submitRegistration} disabled={loading}>
              {loading ? 'Submitting...' : 'Register'}
            </button>
          </>
        )
      }>
      {error && <div className="alert error">{error}</div>}

      {step === 1 && (
        <form onSubmit={submitRegistration}>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input id="reg-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
          </div>
          <div className="field">
            <label htmlFor="reg-mobile">Mobile number</label>
            <input id="reg-mobile" type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 9171234567" inputMode="numeric" required />
          </div>
          <div className="field">
            <label htmlFor="reg-dob">Date of birth</label>
            <input id="reg-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            <div className="field-hint">Registrants must be 21 or older.</div>
          </div>
          {accounts.some(a => a.mobile === mobile.replace(/\D/g, '')) && (
            <div className="field-error">This mobile number already has a console record. Add it manually instead.</div>
          )}
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitOtp}>
          <div className="alert success">Verification code sent to {verifiedMobile}.</div>
          <div className="profile-row"><span className="row-label">Password</span><span className="row-value mono">{generatedPassword}</span></div>
          <div className="field" style={{ marginTop: '1.25rem' }}>
            <label htmlFor="reg-otp">Verification code</label>
            <input id="reg-otp" type="text" value={otpValue} onChange={(e) => setOtpValue(e.target.value)} placeholder="123456" maxLength="6" style={{ textAlign: 'center', letterSpacing: '0.4em' }} required />
          </div>
          <p className="field-hint">Keep this window open — the generated password is required to complete verification.</p>
        </form>
      )}

      {step === 3 && (
        <div className="claim-processing">
          <CheckCircle size={30} color="#176334" />
          <div className="state-title">Account verified</div>
          <div className="state-sub">The registration completed and is now recorded in the console.</div>
        </div>
      )}
    </Modal>
  );
}

function calculateAge(dobStr) {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/* ============================================================
   CLAIM PROMO CODE (Actions -> Claim code)
   ============================================================ */
function ClaimModal({ token, accounts, onClose, onDone }) {
  const [mode, setMode] = useState('single'); // single | bulk
  const [promos, setPromos] = useState([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const [singlePromo, setSinglePromo] = useState('');
  const [singleAccount, setSingleAccount] = useState('');
  const [singleProcessing, setSingleProcessing] = useState(false);
  const [singleResult, setSingleResult] = useState(null);

  const [selectedPromos, setSelectedPromos] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [promoSearch, setPromoSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [newPromo, setNewPromo] = useState('');
  const [promoSaving, setPromoSaving] = useState(false);

  const fetchPromos = useCallback(async () => {
    if (!token) return;
    setPromosLoading(true);
    try {
      const res = await fetch(apiUrl('/api/promos'), { headers: AUTH_HEADERS(token) });
      if (res.status === 401 || res.status === 403) { setPromoError('Your session has expired. Sign in again.'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load promo codes');
      setPromos(Array.isArray(data) ? data : []);
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setPromosLoading(false);
    }
  }, [token]);

  const promosLoaded = useRef(false);

  useEffect(() => {
    if (promosLoaded.current) return;
    promosLoaded.current = true;
    fetchPromos();
  }, [fetchPromos]);

  const claimableAccounts = accounts.filter(a => a.plainPassword);
  const blockedAccounts = accounts.filter(a => !a.plainPassword);
  const filteredPromos = promos.filter(p => p.code.toLowerCase().includes(promoSearch.toLowerCase()));
  const filteredAccounts = claimableAccounts.filter(a => {
    const q = accountSearch.toLowerCase();
    return `${a.mobile} ${a.firstName} ${a.lastName}`.toLowerCase().includes(q);
  });

  const runClaim = async (accountIds, codes) => {
    const accountsToClaim = accounts.filter(a => accountIds.includes(a._id));
    if (accountsToClaim.length === 0) throw new Error('Select at least one account.');
    const missingPassword = accountsToClaim.filter(a => !a.plainPassword);
    if (missingPassword.length > 0) {
      const list = missingPassword.map(a => a.mobile).join(', ');
      throw new Error(`No stored password on record for ${list}. Add or re-verify the account first — claiming requires the account password.`);
    }

    const res = await fetch(apiUrl('/api/claim-promo-bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
      body: JSON.stringify({
        accounts: accountsToClaim.map(a => ({ mobile: a.mobile, password: a.plainPassword })),
        promoCodes: codes
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) throw new Error('Your session has expired. Sign in again.');
    if (!res.ok) throw new Error(data.error || 'Claim failed');
    return data;
  };

  const addPromoCode = async () => {
    const code = newPromo.trim();
    setPromoError('');
    if (!code) { setPromoError('Enter a promo code to add.'); return; }
    if (promos.some(p => p.code.toUpperCase() === code.toUpperCase())) {
      setPromoError('This promo code already exists.');
      return;
    }
    setPromoSaving(true);
    try {
      const res = await fetch(apiUrl('/api/promos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS(token) },
        body: JSON.stringify({ code })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) { setPromoError('Your session has expired. Sign in again.'); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to add promo code');

      setNewPromo('');
      if (mode === 'single') {
        setSinglePromo(data.promo.code);
      } else {
        setSelectedPromos(prev => (prev.includes(data.promo.code) ? prev : [...prev, data.promo.code]));
      }
      await fetchPromos();
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setPromoSaving(false);
    }
  };

  const submitSingle = async () => {
    setPromoError('');
    if (!singlePromo) { setPromoError('Select a promo code.'); return; }
    if (!singleAccount) { setPromoError('Select an account.'); return; }
    setSingleProcessing(true);
    setSingleResult(null);
    try {
      const data = await runClaim([singleAccount], [singlePromo]);
      const result = Array.isArray(data.results) ? data.results[0] : undefined;
      if (!result) throw new Error('The server did not return a claim result.');
      setSingleResult(result);
      if (result.success) onDone();
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setSingleProcessing(false);
    }
  };

  const submitBulk = async () => {
    setPromoError('');
    if (selectedAccounts.length === 0) { setPromoError('Select at least one account.'); return; }
    if (selectedPromos.length === 0) { setPromoError('Select at least one promo code.'); return; }
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const data = await runClaim(selectedAccounts, selectedPromos);
      setBulkResult(data);
      onDone();
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <Modal onClose={onClose} wide title="Claim promo code" desc="Apply an existing promo code to a customer account."
      foot={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={singleProcessing || bulkProcessing}>Close</button>
          {mode === 'single'
            ? <button className="btn btn-primary" onClick={submitSingle} disabled={singleProcessing || !singlePromo || !singleAccount}>{singleProcessing ? 'Claiming...' : 'Claim code'}</button>
            : <button className="btn btn-primary" onClick={submitBulk} disabled={bulkProcessing || selectedAccounts.length === 0 || selectedPromos.length === 0}>{bulkProcessing ? 'Processing...' : 'Claim for selected'}</button>}
        </>
      }>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'single'} className={`tab-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single Claim</button>
        <button type="button" role="tab" aria-selected={mode === 'bulk'} className={`tab-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>Bulk Claim</button>
      </div>

      {promoError && <div className="alert error">{promoError}</div>}

      {mode === 'single' && (
        singleResult ? (
          <div>
            <div className={`alert ${singleResult.success ? 'success' : 'error'}`}>
              {singleResult.success
                ? `Success — ${singleResult.promoCode} claimed for ${singleResult.mobile} (balance ₱${singleResult.balance}).`
                : `Failed — ${singleResult.promoCode}: ${singleResult.error}`}
            </div>
            <button className="btn btn-outline" onClick={() => { setSingleResult(null); setSinglePromo(''); setSingleAccount(''); }}>Claim another</button>
          </div>
        ) : singleProcessing ? (
          <div className="claim-processing"><div className="spinner" /><div className="state-title">Claiming promo code</div><div className="state-sub">This can take a moment while the account signs in.</div></div>
        ) : (
          <div>
            <div className="field">
              <label htmlFor="claim-promo">Promo code</label>
              <div className="select-wrap">
                <select id="claim-promo" value={singlePromo} onChange={(e) => setSinglePromo(e.target.value)}>
                  <option value="">{promosLoading ? 'Loading codes...' : 'Select a promo code'}</option>
                  {promos.map(p => <option key={p._id} value={p.code}>{p.code} ({p.claimCount} claimed)</option>)}
                </select>
                <ChevronDown />
              </div>
              {!promosLoading && promos.length === 0 && <div className="field-hint">No promo codes available yet. Add one below.</div>}
            </div>
            <div className="field">
              <label htmlFor="add-promo">Add promo code</label>
              <div className="input-row">
                <input id="add-promo" type="text" value={newPromo} onChange={(e) => setNewPromo(e.target.value)} placeholder="Enter a new promo code" autoComplete="off" />
                <button type="button" className="btn btn-primary" onClick={addPromoCode} disabled={promoSaving || !newPromo.trim()}>
                  {promoSaving ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="claim-account">Account</label>
              <div className="select-wrap">
                <select id="claim-account" value={singleAccount} onChange={(e) => setSingleAccount(e.target.value)}>
                  <option value="">Select an account</option>
                  {claimableAccounts.map(a => <option key={a._id} value={a._id}>{a.mobile} — {a.firstName} {a.lastName}</option>)}
                </select>
                <ChevronDown />
              </div>
              {claimableAccounts.length === 0 && <div className="field-hint">No accounts with a stored password are available to claim.</div>}
              {claimableAccounts.length > 0 && blockedAccounts.length > 0 && (
                <div className="field-hint">{blockedAccounts.length} account{blockedAccounts.length === 1 ? '' : 's'} cannot be claimed — no password stored. Create them via Add account or complete their registration.</div>
              )}
            </div>
          </div>
        )
      )}

      {mode === 'bulk' && (
        bulkResult ? (
          <ClaimResults results={bulkResult.results || []} onDone={() => { setBulkResult(null); onClose(); }} />
        ) : bulkProcessing ? (
          <div className="claim-processing"><div className="spinner" /><div className="state-title">Processing claims</div><div className="state-sub">Each account and code combination is submitted in order.</div></div>
        ) : (
          <div>
            <div className="field ms-field">
              <div className="ms-header-row">
                <label htmlFor="bulk-promo-search">Promo codes</label>
                <button type="button" className="ms-select-all" onClick={() => setSelectedPromos(filteredPromos.length > 0 && filteredPromos.every(p => selectedPromos.includes(p.code)) ? [] : filteredPromos.map(p => p.code))}>
                  {filteredPromos.length > 0 && filteredPromos.every(p => selectedPromos.includes(p.code)) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="ms-dropdown ms-dropdown-static">
                <div className="ms-search">
                  <Search />
                  <input id="bulk-promo-search" type="text" value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)} placeholder="Search promo codes..." />
                </div>
                <div className="ms-options">
                  {promosLoading ? (
                    <div className="ms-empty">Loading promo codes...</div>
                  ) : filteredPromos.length === 0 ? (
                    <div className="ms-empty">No promo codes{promoSearch ? ' matching your search' : ''} available.</div>
                  ) : filteredPromos.map(p => (
                    <label key={p._id} className="ms-option">
                      <input type="checkbox" checked={selectedPromos.includes(p.code)} onChange={() => setSelectedPromos(prev => prev.includes(p.code) ? prev.filter(c => c !== p.code) : [...prev, p.code])} />
                      <span className="ms-option-text">
                        <span className="ms-option-name">{p.code}</span>
                        <span className="ms-option-meta">{p.claimCount} claimed</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="ms-add">
                <input
                  type="text"
                  value={newPromo}
                  onChange={(e) => setNewPromo(e.target.value)}
                  placeholder="Add new code..."
                  autoComplete="off"
                  onClick={(e) => e.stopPropagation()}
                />
                <button type="button" onClick={addPromoCode} disabled={promoSaving || !newPromo.trim()} aria-label="Add promo code">
                  {promoSaving ? '...' : <Plus size={16} />}
                </button>
              </div>
            </div>

            <div className="field ms-field">
              <div className="ms-header-row">
                <label htmlFor="bulk-account-search">Accounts</label>
                <button type="button" className="ms-select-all" onClick={() => setSelectedAccounts(filteredAccounts.length > 0 && filteredAccounts.every(a => selectedAccounts.includes(a._id)) ? [] : filteredAccounts.map(a => a._id))}>
                  {filteredAccounts.length > 0 && filteredAccounts.every(a => selectedAccounts.includes(a._id)) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="ms-dropdown ms-dropdown-static">
                <div className="ms-search">
                  <Search />
                  <input id="bulk-account-search" type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search by mobile or name..." />
                </div>
                <div className="ms-options">
                  {filteredAccounts.length === 0 ? (
                    <div className="ms-empty">No accounts{accountSearch ? ' matching your search' : ''} with a stored password.</div>
                  ) : filteredAccounts.map(a => (
                    <label key={a._id} className="ms-option">
                      <input type="checkbox" checked={selectedAccounts.includes(a._id)} onChange={() => setSelectedAccounts(prev => prev.includes(a._id) ? prev.filter(id => id !== a._id) : [...prev, a._id])} />
                      <span className="ms-option-text">
                        <span className="ms-option-name">{a.mobile}</span>
                        <span className="ms-option-meta">{a.firstName} {a.lastName}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {blockedAccounts.length > 0 && (
                <div className="field-hint">{blockedAccounts.length} account{blockedAccounts.length === 1 ? '' : 's'} excluded — no password stored. Create them via Add account or complete their registration.</div>
              )}
            </div>

            <div className="ms-summary">
              <div className="ms-summary-title">Claim summary</div>
              <div className="ms-summary-row">
                <span className="ms-summary-label">Promo codes ({selectedPromos.length})</span>
                <span className="ms-summary-chips">
                  {selectedPromos.length === 0 ? <span className="chip-none">None selected</span> : selectedPromos.map(c => <span key={c} className="chip">{c}</span>)}
                </span>
              </div>
              <div className="ms-summary-row">
                <span className="ms-summary-label">Accounts ({selectedAccounts.length})</span>
                <span className="ms-summary-chips">
                  {selectedAccounts.length === 0 ? <span className="chip-none">None selected</span> : selectedAccounts.map(id => {
                    const acc = accounts.find(a => a._id === id);
                    return <span key={id} className="chip">{acc ? acc.mobile : id}</span>;
                  })}
                </span>
              </div>
              <div className="ms-summary-row">
                <span className="ms-summary-label">Total claims</span>
                <span className="ms-summary-chips"><span className="chip">{selectedPromos.length * selectedAccounts.length}</span></span>
              </div>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}

function ClaimResults({ results, onDone }) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  return (
    <div>
      <div className="results-stats">
        <span className={`result-stat ${successCount > 0 ? 'ok' : ''}`}>Success: {successCount}</span>
        <span className={`result-stat ${failCount > 0 ? 'bad' : ''}`}>Failed: {failCount}</span>
      </div>
      <div className="results-list">
        {results.length === 0 ? (
          <div className="ms-empty">No claims were processed.</div>
        ) : results.map((res, i) => (
          <div key={`${res.mobile}-${res.promoCode}-${i}`} className={`result-row ${res.success ? 'ok' : 'bad'}`}>
            <span className="result-label">{res.mobile} · {res.promoCode}</span>
            <span className="result-value">{res.success ? `Success (₱${res.balance})` : `Failed: ${res.error}`}</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={onDone}>Done</button>
    </div>
  );
}

export default App;