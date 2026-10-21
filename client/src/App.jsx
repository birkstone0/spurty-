import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileText, Eye, EyeOff, ChevronDown, ChevronUp, LogOut, CheckCircle, XCircle, Clock, Database, Shield, Plus, Search, User as UserIcon, Ticket, Loader2 } from 'lucide-react';
import { apiUrl } from './config';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('dashboard');
  
  // Auth State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Custom Toast State
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Registration State
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [fileId, setFileId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState({ firstName: '', lastName: '', dob: '', age: 0 });
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [otpValue, setOtpValue] = useState('');

  // Bulk Promo State
  const [promos, setPromos] = useState([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [newPromoInput, setNewPromoInput] = useState('');
  const [selectedPromos, setSelectedPromos] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [isPromoProcessing, setIsPromoProcessing] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [singlePromo, setSinglePromo] = useState('');
  const [singleAccount, setSingleAccount] = useState('');
  const [singleProcessing, setSingleProcessing] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [promoSearch, setPromoSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  // UI State for Promo Modal
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [claimMode, setClaimMode] = useState('pick'); // pick | single | bulk

  // Manual Account State
  const [manualMobile, setManualMobile] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [manualKyc, setManualKyc] = useState('No');

  // Dashboard State
  const [accounts, setAccounts] = useState([]);

  const fetchPromos = async () => {
    setPromosLoading(true);
    try {
      const res = await fetch(apiUrl('/api/promos'), { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load promo codes');
      setPromos(data);
    } catch (err) {
      console.error("Failed to fetch promos:", err);
      setPromoError(err.message);
    } finally {
      setPromosLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch(apiUrl('/api/accounts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        setToken(null);
        setRole(null);
        setUsername(null);
        return;
      }
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || cancelled) return;
      const res = await fetch(apiUrl('/api/accounts'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (cancelled) return;
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        setToken(null);
        setRole(null);
        setUsername(null);
        return;
      }
      const data = await res.json();
      setAccounts(data);
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const handleAuthLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('username', data.username);
      setToken(data.token);
      setRole(data.role);
      setUsername(data.username);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    setToken(null);
    setRole(null);
    setUsername(null);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!fileId) { setError('Please upload the ID image.'); return; }
    setLoading(true); setError('');
    
    const formData = new FormData();
    formData.append('idImage', fileId);

    try {
      const response = await fetch(apiUrl('/api/scan'), { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData 
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.rawText) {
          setRawText(data.rawText);
          setExtractedData({ firstName: '', lastName: '', dob: '', age: 0 });
          setStep(2); setShowRaw(true); 
        }
        throw new Error(data.error || 'Scanning failed');
      }
      setExtractedData(data.extracted);
      setRawText(data.rawText);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true); setError('');

    try {
      const response = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...extractedData, mobile: cleanMobile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      
      setPendingData({ password: data.password }); 
      setStep(3); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpValue) { setError('Please enter the OTP.'); return; }
    setLoading(true); setError('');

    try {
      const response = await fetch(apiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ otpValue, mobile, ...extractedData, password: pendingData.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');
      setStep(4); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!manualMobile || !manualPassword) { setError("Mobile and Password are required."); return; }
    setLoading(true); setError('');

    try {
      const res = await fetch(apiUrl('/api/accounts/add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mobile: manualMobile, password: manualPassword, kycVerified: manualKyc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add account');
      
      setIsAddAccountModalOpen(false);
      setManualMobile('');
      setManualPassword('');
      setManualKyc('No');
      fetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewPromo = async () => {
    const trimmed = newPromoInput.trim();
    if (!trimmed) { setPromoError('Enter a promo code.'); return; }
    if (promos.some(p => p.code.toUpperCase() === trimmed.toUpperCase())) {
      setPromoError('This promo code already exists.');
      return;
    }
    setPromoError('');
    try {
      const res = await fetch(apiUrl('/api/promos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add promo code');
      setPromos(prev => [data.promo, ...prev]);
      setSelectedPromos(prev => prev.includes(data.promo.code) ? prev : [...prev, data.promo.code]);
      setNewPromoInput('');
    } catch (err) {
      setPromoError(err.message);
    }
  };

  const togglePromo = (code) => {
    if (selectedPromos.includes(code)) setSelectedPromos(selectedPromos.filter(c => c !== code));
    else setSelectedPromos([...selectedPromos, code]);
  };

  const toggleAccount = (id) => {
    if (selectedAccounts.includes(id)) setSelectedAccounts(selectedAccounts.filter(a => a !== id));
    else setSelectedAccounts([...selectedAccounts, id]);
  };

  const toggleVisibleAccounts = (visibleIds) => {
    const visibleSelected = visibleIds.filter(id => selectedAccounts.includes(id));
    if (visibleSelected.length === visibleIds.length && visibleIds.length > 0) {
      setSelectedAccounts(selectedAccounts.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedAccounts([...new Set([...selectedAccounts, ...visibleIds])]);
    }
  };

  const handleBulkClaim = async (e) => {
    e.preventDefault();
    setPromoError('');
    if (selectedAccounts.length === 0) { setPromoError("Please select at least one account."); return; }
    if (selectedPromos.length === 0) { setPromoError("Please select at least one promo code."); return; }

    setIsPromoProcessing(true); setPromoResult(null);

    const accountsToClaim = accounts.filter(a => selectedAccounts.includes(a._id));

    try {
      const res = await fetch(apiUrl('/api/claim-promo-bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          accounts: accountsToClaim.map(a => ({ mobile: a.mobile, password: a.plainPassword })), 
          promoCodes: selectedPromos 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk claim failed');
      
      setPromoResult(data.results);
      fetchAccounts();
      fetchPromos();
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setIsPromoProcessing(false);
    }
  };

  const handleSingleClaim = async (e) => {
    e.preventDefault();
    setPromoError('');
    if (!singlePromo) { setPromoError("Please select a promo code."); return; }
    if (!singleAccount) { setPromoError("Please select an account."); return; }

    setSingleProcessing(true); setSingleResult(null);
    const acc = accounts.find(a => a._id === singleAccount);
    if (!acc || !acc.plainPassword) { setSingleProcessing(false); setPromoError("No plaintext password on record for this account."); return; }

    try {
      const res = await fetch(apiUrl('/api/claim-promo-bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          accounts: [{ mobile: acc.mobile, password: acc.plainPassword }], 
          promoCodes: [singlePromo] 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');
      setSingleResult(data.results[0]);
      fetchAccounts();
      fetchPromos();
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setSingleProcessing(false);
    }
  };

  const openRegisterModal = () => {
    if (username === 'kyvia') {
      setToastMessage("Di pa yan tapos pero cge");
      setTimeout(() => setToastMessage(''), 3000);
    }
    resetRegisterForm(); 
    setIsRegisterModalOpen(true); 
    setShowActionMenu(false);
  };

  const openClaimModal = () => {
    setClaimMode('pick');
    setPromoError('');
    setPromoResult(null);
    setSingleResult(null);
    setSelectedAccounts([]);
    setSelectedPromos([]);
    setSinglePromo('');
    setSingleAccount('');
    setPromoSearch('');
    setAccountSearch('');
    setShowPromoDropdown(false);
    setShowAccountDropdown(false);
    setIsClaimModalOpen(true);
    setShowActionMenu(false);
    fetchPromos();
  };

  const resetRegisterForm = () => {
    setStep(1); setMobile(''); setFileId(null); setError(''); setExtractedData({ firstName: '', lastName: '', dob: '', age: 0 }); setPendingData(null); setOtpValue(''); setShowRaw(false);
  };

  // --- RENDER LOGIN SCREEN ---
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div className="card" style={{ padding: '3rem', width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Shield size={48} color="var(--btn-red)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: '1.8rem' }}>SportsPlus</h2>
          </div>
          
          {authError && <div className="alert error">{authError}</div>}
          
          <form onSubmit={handleAuthLogin}>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showLoginPassword ? "text" : "password"} 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)} 
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  required 
                />
                <div onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
            </div>
            <button type="submit" className="btn-register" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled={authLoading}>
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  const totalAccounts = accounts.length;
  const successfulAccounts = accounts.filter(a => a.status === 'verified').length;
  const failedAccounts = accounts.filter(a => a.status === 'failed').length;
  const pendingAccounts = accounts.filter(a => a.status === 'otp_sent').length;

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#1E1E24', color: 'white', padding: '1rem 2rem', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'bold' }}>
          {toastMessage}
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-brand">SportsPlus</div>
        <div className="nav-menu">
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </div>
          <div className={`nav-item ${view === 'accounts' ? 'active' : ''}`} onClick={() => setView('accounts')}>
            <Users size={18} /> <span>Accounts</span>
          </div>
          {role === 'admin' && (
            <div className={`nav-item ${view === 'logs' ? 'active' : ''}`} onClick={() => setView('logs')}>
              <FileText size={18} /> <span>System Logs</span>
            </div>
          )}
          <div className="nav-item" style={{ marginTop: 'auto', color: '#EF4444' }} onClick={handleLogout}>
            <LogOut size={18} /> <span>Logout</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-header">
          <h1 className="page-title">
            {view === 'dashboard' ? 'Overview' : view === 'accounts' ? 'Accounts' : 'System Logs'}
          </h1>
          
          <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button className="btn-register" onClick={() => setShowActionMenu(!showActionMenu)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Actions <ChevronDown size={16} />
              </button>
              {showActionMenu && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: 'var(--shadow-md)', width: '200px', zIndex: 100 }}>
                  <div className="nav-item" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }} onClick={openRegisterModal}>+ Register User</div>
                  <div className="nav-item" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }} onClick={() => { setIsAddAccountModalOpen(true); setShowActionMenu(false); }}>+ Add Account</div>
                  <div className="nav-item" style={{ padding: '0.75rem 1rem' }} onClick={openClaimModal}>Claim Code</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {view === 'dashboard' && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header"><span className="kpi-title">Total Attempts</span><Database size={20} color="#64748B" /></div>
                <div className="kpi-value">{totalAccounts}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span className="kpi-title" style={{ color: 'var(--success)' }}>Success</span><CheckCircle size={20} color="var(--success)" /></div>
                <div className="kpi-value">{successfulAccounts}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span className="kpi-title" style={{ color: 'var(--danger)' }}>Failed</span><XCircle size={20} color="var(--danger)" /></div>
                <div className="kpi-value">{failedAccounts}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span className="kpi-title" style={{ color: 'var(--warning)' }}>Pending OTP</span><Clock size={20} color="var(--warning)" /></div>
                <div className="kpi-value">{pendingAccounts}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Recent Activity</div></div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Status</th><th>Information</th></tr></thead>
                  <tbody>
                    {accounts.slice(0, 10).map(acc => (
                      <tr key={acc._id}>
                        <td className="date-cell">{new Date(acc.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${acc.status === 'verified' ? 'success' : acc.status === 'otp_sent' ? 'pending' : 'failed'}`}>
                            {acc.status === 'verified' ? 'Success' : acc.status === 'otp_sent' ? 'Pending' : 'Failed'}
                          </span>
                        </td>
                        <td>
                          <div className="data-group">
                            <span className="data-label">Mobile: <strong className="data-value">{acc.mobile}</strong></span>
                            {acc.errorReason && <span className="data-label" style={{ color: 'var(--danger)' }}>Reason: {acc.errorReason}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {view === 'accounts' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Accounts</div></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Password</th>
                    <th>KYC Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc._id}>
                      <td className="date-cell">{new Date(acc.createdAt).toLocaleString()}</td>
                      <td>{acc.firstName} {acc.lastName}</td>
                      <td>{acc.mobile}</td>
                      <td>
                        <span className="badge success" style={{ fontFamily: 'monospace' }}>
                          {acc.plainPassword || acc.generatedPassword || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${acc.kycStatus === 'approved' ? 'success' : 'pending'}`}>
                          {acc.kycStatus ? acc.kycStatus.toUpperCase() : 'NONE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'logs' && role === 'admin' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Failed Attempts</div></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Name</th><th>DOB</th><th>Mobile</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {accounts.filter(a => a.status === 'failed').map(acc => (
                    <tr key={acc._id}>
                      <td className="date-cell">{new Date(acc.createdAt).toLocaleString()}</td>
                      <td>{acc.firstName} {acc.lastName}</td>
                      <td>{acc.dob}</td>
                      <td>{acc.mobile}</td>
                      <td style={{ color: 'var(--danger)' }}>{acc.errorReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ADD ACCOUNT MODAL */}
      {isAddAccountModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsAddAccountModalOpen(false)}>&times;</button>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '1.5rem' }}>Add Account Manually</h2>
            {error && <div className="alert error">{error}</div>}
            
            <form onSubmit={handleAddAccount}>
              <div className="form-group">
                <label>Mobile</label>
                <input type="text" value={manualMobile} onChange={(e) => setManualMobile(e.target.value)} placeholder="e.g., 9171234567" required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showManualPassword ? "text" : "password"} 
                    value={manualPassword} 
                    onChange={(e) => setManualPassword(e.target.value)} 
                    placeholder="Account password" 
                    required 
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <div onClick={() => setShowManualPassword(!showManualPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showManualPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>KYC Verified?</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="manualKyc" value="Yes" checked={manualKyc === 'Yes'} onChange={(e) => setManualKyc(e.target.value)} />
                    Yes
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="manualKyc" value="No" checked={manualKyc === 'No'} onChange={(e) => setManualKyc(e.target.value)} />
                    No
                  </label>
                </div>
              </div>
              <button type="submit" className="btn-register" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Adding...' : 'Add Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {isRegisterModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsRegisterModalOpen(false)}>&times;</button>
            {error && <div className="alert error">{error}</div>}
            
            {step === 1 && (
              <form onSubmit={handleScan}>
                <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '0.5rem' }}>New Registration</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Upload the front ID image.</p>
                <div className="form-group"><label>ID Front Image</label><input type="file" accept="image/*" onChange={(e) => setFileId(e.target.files[0])} /></div>
                <button type="submit" className="btn-register" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Scanning...' : 'Scan Document'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleRegister}>
                <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '1.5rem' }}>Review Details</h2>
                <div className="form-group"><label>First Name</label><input type="text" value={extractedData.firstName} onChange={(e) => setExtractedData({...extractedData, firstName: e.target.value})} /></div>
                <div className="form-group"><label>Last Name</label><input type="text" value={extractedData.lastName} onChange={(e) => setExtractedData({...extractedData, lastName: e.target.value})} /></div>
                <div className="form-group"><label>DOB (YYYY-MM-DD)</label><input type="text" value={extractedData.dob} onChange={(e) => setExtractedData({...extractedData, dob: e.target.value})} /></div>
                <div className="form-group"><label>Mobile</label><input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g., 9171234567" /></div>
                <button type="button" className="stat-pill" style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem', cursor: 'pointer', border: '1px solid var(--border)', background: '#F8FAFC' }} onClick={() => setShowRaw(!showRaw)}>
                  {showRaw ? 'Hide' : 'Show'} Raw OCR
                </button>
                {showRaw && <pre>{rawText}</pre>}
                <button type="submit" className="btn-register" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Opening Chrome...' : 'Confirm & Register'}
                </button>
              </form>
            )}

            {step === 3 && pendingData && (
              <form onSubmit={handleVerifyOtp}>
                <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '0.5rem' }}>Verification</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>SMS sent to {mobile}.</p>
                <div className="alert success" style={{ marginBottom: '1.5rem' }}>Password: <strong>{pendingData.password}</strong></div>
                <div className="form-group"><label>OTP Code</label><input type="text" value={otpValue} onChange={(e) => setOtpValue(e.target.value)} placeholder="123456" maxLength="6" style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.2rem' }} /></div>
                <button type="submit" className="btn-register" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify Account'}
                </button>
              </form>
            )}

            {step === 4 && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
                <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '1rem' }}>Account Verified!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Your account is active.</p>
                <button onClick={() => setIsRegisterModalOpen(false)} className="btn-register" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLAIM CODE MODAL */}
      {isClaimModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title">
          <div className="modal-content claim-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setIsClaimModalOpen(false)} aria-label="Close">&times;</button>
            <h2 id="claim-modal-title" style={{ fontFamily: 'Playfair Display', marginBottom: '1rem' }}>Claim Promo Code</h2>

            {claimMode === 'pick' && (
              <div className="claim-picker">
                <p className="claim-subtitle">Choose how you want to claim a promo code.</p>
                <div className="claim-pick-grid">
                  <button type="button" className="claim-pick-card" onClick={() => setClaimMode('single')}>
                    <span className="claim-pick-icon"><UserIcon size={22} /></span>
                    <span className="claim-pick-title">Single Claim</span>
                    <span className="claim-pick-desc">Apply one promo code to one account.</span>
                  </button>
                  <button type="button" className="claim-pick-card" onClick={() => setClaimMode('bulk')}>
                    <span className="claim-pick-icon"><Ticket size={22} /></span>
                    <span className="claim-pick-title">Bulk Claim</span>
                    <span className="claim-pick-desc">Apply promo codes to multiple accounts.</span>
                  </button>
                </div>
              </div>
            )}

            {claimMode === 'single' && (
              <div className="claim-tab">
                <div className="claim-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={claimMode === 'single'} className={`claim-tab-btn ${claimMode === 'single' ? 'active' : ''}`} onClick={() => setClaimMode('single')}>Single Claim</button>
                  <button type="button" role="tab" aria-selected={claimMode === 'bulk'} className={`claim-tab-btn ${claimMode === 'bulk' ? 'active' : ''}`} onClick={() => setClaimMode('bulk')}>Bulk Claim</button>
                </div>
              </div>
            )}

            {claimMode === 'bulk' && (
              <div className="claim-tab">
                <div className="claim-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={claimMode === 'single'} className={`claim-tab-btn ${claimMode === 'single' ? 'active' : ''}`} onClick={() => setClaimMode('single')}>Single Claim</button>
                  <button type="button" role="tab" aria-selected={claimMode === 'bulk'} className={`claim-tab-btn ${claimMode === 'bulk' ? 'active' : ''}`} onClick={() => setClaimMode('bulk')}>Bulk Claim</button>
                </div>
              </div>
            )}

            {claimMode !== 'pick' && (
              <>
                {claimMode === 'single' ? (
                  <div>
                    {promoError && <div className="alert error">{promoError}</div>}
                    {singleResult ? (
                      <div>
                        <div className={`alert ${singleResult.success ? 'success' : 'error'}`}>
                          {singleResult.success
                            ? `Success — ${singleResult.promoCode} claimed for ${singleResult.mobile} (₱${singleResult.balance}).`
                            : `Failed — ${singleResult.promoCode}: ${singleResult.error}`}
                        </div>
                        <button type="button" className="btn-register claim-primary-btn" onClick={() => setSingleResult(null)}>Claim Another</button>
                      </div>
                    ) : singleProcessing ? (
                      <div className="claim-processing">
                        <Loader2 className="claim-spinner" size={28} />
                        <p>Claiming promo code... Please wait.</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSingleClaim}>
                        <div className="form-group">
                          <label htmlFor="single-promo">Promo Code</label>
                          <select id="single-promo" className="claim-select" value={singlePromo} onChange={(e) => setSinglePromo(e.target.value)}>
                            <option value="">Select a promo code</option>
                            {promos.map(p => (
                              <option key={p._id} value={p.code}>{p.code} ({p.claimCount} claimed)</option>
                            ))}
                          </select>
                          {promos.length === 0 && <p className="field-hint">No promo codes available yet.</p>}
                        </div>
                        <div className="form-group">
                          <label htmlFor="single-account">Account</label>
                          <select id="single-account" className="claim-select" value={singleAccount} onChange={(e) => setSingleAccount(e.target.value)}>
                            <option value="">Select an account</option>
                            {accounts.map(a => (
                              <option key={a._id} value={a._id}>{a.mobile} — {a.firstName} {a.lastName}</option>
                            ))}
                          </select>
                          {accounts.length === 0 && <p className="field-hint">No accounts available yet.</p>}
                        </div>
                        <button type="submit" className="btn-register claim-primary-btn" disabled={singleProcessing}>
                          Claim Promo Code
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div>
                    {promoError && <div className="alert error">{promoError}</div>}
                    {isPromoProcessing ? (
                      <div className="claim-processing">
                        <Loader2 className="claim-spinner" size={28} />
                        <p>Processing claims... Please wait.</p>
                      </div>
                    ) : promoResult ? (
                      <ClaimResults results={promoResult} onClose={() => { setIsClaimModalOpen(false); setPromoResult(null); setSelectedAccounts([]); setSelectedPromos([]); }} />
                    ) : (
                      <form onSubmit={handleBulkClaim}>
                        <PromoMultiSelect
                          promos={promos}
                          promosLoading={promosLoading}
                          selectedPromos={selectedPromos}
                          search={promoSearch}
                          setSearch={setPromoSearch}
                          togglePromo={togglePromo}
                          newPromoInput={newPromoInput}
                          setNewPromoInput={setNewPromoInput}
                          handleAddNewPromo={handleAddNewPromo}
                          showDropdown={showPromoDropdown}
                          setShowDropdown={setShowPromoDropdown}
                          promoError={promoError}
                          setPromoError={setPromoError}
                        />
                        <AccountMultiSelect
                          accounts={accounts}
                          selectedAccounts={selectedAccounts}
                          search={accountSearch}
                          setSearch={setAccountSearch}
                          toggleAccount={toggleAccount}
                          toggleVisibleAccounts={toggleVisibleAccounts}
                          showDropdown={showAccountDropdown}
                          setShowDropdown={setShowAccountDropdown}
                        />
                        <ClaimSummary
                          selectedPromos={selectedPromos}
                          selectedAccounts={selectedAccounts}
                          promos={promos}
                          accounts={accounts}
                        />
                        <button type="submit" className="btn-register claim-primary-btn" disabled={selectedAccounts.length === 0 || selectedPromos.length === 0}>
                          Claim for Selected Accounts
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PromoMultiSelect({ promos, promosLoading, selectedPromos, search, setSearch, togglePromo, newPromoInput, setNewPromoInput, handleAddNewPromo, showDropdown, setShowDropdown, promoError }) {
  const filtered = promos.filter(p => p.code.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="form-group ms-field">
      <label htmlFor="promo-search">Select Promo Codes</label>
      <div
        className={`ms-trigger ${showDropdown ? 'open' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
      >
        <span className="ms-trigger-label">
          {selectedPromos.length > 0 ? `${selectedPromos.length} selected` : 'Select codes'}
        </span>
        {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {showDropdown && (
        <div className="ms-dropdown" role="listbox">
          <div className="ms-search">
            <Search size={16} />
            <input
              id="promo-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search promo codes..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="ms-options">
            {promosLoading ? (
              <div className="ms-empty">Loading promo codes...</div>
            ) : filtered.length === 0 ? (
              <div className="ms-empty">No promo codes{search ? ' matching your search' : ''} yet.</div>
            ) : (
              filtered.map(p => (
                <label key={p._id} className="ms-option">
                  <input type="checkbox" checked={selectedPromos.includes(p.code)} onChange={() => togglePromo(p.code)} />
                  <span className="ms-option-text">
                    <span className="ms-option-name">{p.code}</span>
                    <span className="ms-option-meta">{p.claimCount} claimed</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="ms-add">
            <input
              type="text"
              value={newPromoInput}
              onChange={(e) => setNewPromoInput(e.target.value)}
              placeholder="Add new code..."
              onClick={(e) => e.stopPropagation()}
            />
            <button type="button" onClick={handleAddNewPromo} aria-label="Add promo code"><Plus size={16} /></button>
          </div>
          {promoError && <div className="ms-add-error">{promoError}</div>}
        </div>
      )}
    </div>
  );
}

function AccountMultiSelect({ accounts, selectedAccounts, search, setSearch, toggleAccount, toggleVisibleAccounts, showDropdown, setShowDropdown }) {
  const filtered = accounts.filter(a =>
    a.mobile.includes(search) ||
    `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const visibleIds = filtered.map(a => a._id);
  const visibleSelected = filtered.filter(a => selectedAccounts.includes(a._id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelected === visibleIds.length;
  return (
    <div className="form-group ms-field">
      <div className="ms-header-row">
        <label htmlFor="account-search">Select Accounts</label>
        <button type="button" className="ms-select-all" onClick={() => toggleVisibleAccounts(visibleIds)}>
          {allVisibleSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div
        className={`ms-trigger ${showDropdown ? 'open' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
      >
        <span className="ms-trigger-label">
          {selectedAccounts.length > 0 ? `${selectedAccounts.length} selected` : 'Select accounts'}
        </span>
        {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {showDropdown && (
        <div className="ms-dropdown" role="listbox">
          <div className="ms-search">
            <Search size={16} />
            <input
              id="account-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by mobile or name..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="ms-options">
            {filtered.length === 0 ? (
              <div className="ms-empty">No accounts{search ? ' matching your search' : ''} yet.</div>
            ) : (
              filtered.map(a => (
                <label key={a._id} className="ms-option">
                  <input type="checkbox" checked={selectedAccounts.includes(a._id)} onChange={() => toggleAccount(a._id)} />
                  <span className="ms-option-text">
                    <span className="ms-option-name">{a.mobile}</span>
                    <span className="ms-option-meta">{a.firstName} {a.lastName}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimSummary({ selectedPromos, selectedAccounts, promos, accounts }) {
  const selectedCodeList = promos.filter(p => selectedPromos.includes(p.code));
  const selectedAccountList = accounts.filter(a => selectedAccounts.includes(a._id));
  return (
    <div className="claim-summary">
      <div className="claim-summary-title">Claim Summary</div>
      {selectedPromos.length === 0 && selectedAccounts.length === 0 ? (
        <p className="field-hint">Select at least one promo code and one account to proceed.</p>
      ) : (
        <>
          {selectedPromos.length > 0 && (
            <div className="claim-summary-row">
              <span className="claim-summary-label">Promo Codes ({selectedPromos.length})</span>
              <span className="claim-summary-chips">
                {selectedCodeList.map(p => (
                  <span key={p._id} className="claim-chip">{p.code}</span>
                ))}
              </span>
            </div>
          )}
          {selectedAccounts.length > 0 && (
            <div className="claim-summary-row">
              <span className="claim-summary-label">Accounts ({selectedAccounts.length})</span>
              <span className="claim-summary-chips">
                {selectedAccountList.map(a => (
                  <span key={a._id} className="claim-chip">{a.mobile}</span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClaimResults({ results, onClose }) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  return (
    <div className="claim-results">
      <div className="claim-results-stats">
        <span className={`claim-stat ${successCount > 0 ? 'ok' : ''}`}>Success: {successCount}</span>
        <span className={`claim-stat ${failCount > 0 ? 'bad' : ''}`}>Failed: {failCount}</span>
      </div>
      <div className="claim-results-list">
        {results.length === 0 ? (
          <div className="ms-empty">No claims were processed.</div>
        ) : (
          results.map((res, i) => (
            <div key={i} className={`claim-result-row ${res.success ? 'ok' : 'bad'}`}>
              <span className="claim-result-label">{res.mobile} · {res.promoCode}</span>
              <span className="claim-result-value">
                {res.success ? `Success (₱${res.balance})` : `Failed: ${res.error}`}
              </span>
            </div>
          ))
        )}
      </div>
      <button type="button" className="btn-register claim-primary-btn" onClick={onClose}>Done</button>
    </div>
  );
}

export default App;