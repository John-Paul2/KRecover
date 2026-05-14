// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import { db, auth} from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, getDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import emailjs from '@emailjs/browser';
import './App.css';

// ─────────────────────────────────────────────────────────────────────────────
// EMAILJS CONFIG  ← paste your credentials from emailjs.com dashboard
// ─────────────────────────────────────────────────────────────────────────────
const EJS_SERVICE_ID  = 'service_h1l73xs';   // e.g. 'service_abc123'
const EJS_TEMPLATE_ID = 'template_5a5gkw6';  // e.g. 'template_xyz789'
const EJS_PUBLIC_KEY  = 'En7jeDPuK6ac4gNWO';   // e.g. 'user_XXXXXXXXXXXXXX'

const ADMIN_EMAIL = 'admin@karunya.edu.in';
const CATEGORIES  = ['Electronics','Documents','Keys','Clothing','Bags','Books','Accessories','Other'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const generate6 = () => String(Math.floor(100000 + Math.random() * 900000));

function SearchSVG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  // view: 'landing' | 'auth' | 'otp' | 'profile' | 'dashboard'
  const [view, setView]               = useState('landing');
  const [user, setUser]               = useState(null);
  const [userData, setUserData]       = useState(null);
  const [isLoginView, setIsLoginView] = useState(true);

  // Auth form
  const [authForm, setAuthForm]       = useState({ email: '', password: '' });
  const [profileForm, setProfileForm] = useState({ name: '', regNo: '' });
  const [authError, setAuthError]     = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  // OTP
  const [otpCode, setOtpCode]         = useState('');         // what we generated
  const [otpInput, setOtpInput]       = useState(['','','','','','']); // user input digits
  const [otpSending, setOtpSending]   = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry]     = useState(null);       // Date object
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Dashboard
  const [items, setItems]             = useState([]);
  const [activeTab, setActiveTab]     = useState('Lost');
  const [showModal, setShowModal]     = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [postForm, setPostForm]       = useState({ type:'Lost', objectName:'', location:'', phone:'', category:'Electronics', description:'' });
  const [postPhoto, setPostPhoto]     = useState(null);   // File object
  const [photoPreview, setPhotoPreview] = useState(null); // blob URL
  const [postSuccess, setPostSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [lightbox, setLightbox]       = useState(null); // URL string

  // Stats & AI
  const [showStats, setShowStats]     = useState(false);
  const [toast, setToast]             = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiMatches, setAiMatches]     = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const fileInputRef = useRef();

  // ── AUTH LISTENER ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) { setUserData(userDoc.data()); setView('dashboard'); }
        else { setView('profile'); }
      } else { setUserData(null); }
    });
    return () => unsub();
  }, []);

  // ── ITEMS LISTENER ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'dashboard') return;
    const q = query(collection(db, 'items'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [view]);

  // ── OTP COUNTDOWN ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!otpExpiry) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
      setOtpTimeLeft(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpExpiry]);

  useEffect(() => {
    if (otpCooldown > 0) {
      const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCooldown]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── SEND OTP VIA EMAILJS ──────────────────────────────────────────────────────
  const sendOtp = async (email) => {
    const code = generate6();
    setOtpCode(code);
    setOtpSending(true);
    setAuthError('');
    try {
      await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, {
        to_email:   email,
        otp_code:   code,
        to_name:    email.split('@')[0],
        expiry_min: '10',
      }, EJS_PUBLIC_KEY);
      setOtpExpiry(new Date(Date.now() + 10 * 60 * 1000));
      setOtpCooldown(60);
      setOtpInput(['','','','','','']);
      return true;
    } catch (err) {
      console.error('EmailJS error:', err);
      setAuthError('Failed to send OTP. Check your EmailJS credentials.');
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  // ── REGISTER → send OTP first ─────────────────────────────────────────────────
  const handleAuth = async (e) => {
    e.preventDefault();
    const { email, password } = authForm;
    setAuthError('');

    if (isLoginView) {
      // LOGIN — no OTP needed
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setAuthError(err.message.replace('Firebase: ','').replace(/\(auth\/.*\)\.?/,'').trim());
      } finally { setIsLoading(false); }
      return;
    }

    // REGISTER — validate domain then send OTP
    if (!email.toLowerCase().endsWith('@karunya.edu.in')) {
      setAuthError('Only @karunya.edu.in email addresses are permitted.'); return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.'); return;
    }

    setIsLoading(true);
    const sent = await sendOtp(email);
    setIsLoading(false);
    if (sent) setView('otp');
  };

  // ── VERIFY OTP & CREATE ACCOUNT ───────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const entered = otpInput.join('');
    setAuthError('');

    if (entered.length < 6) { setAuthError('Please enter all 6 digits.'); return; }
    if (otpTimeLeft === 0)   { setAuthError('OTP expired. Please request a new one.'); return; }
    if (entered !== otpCode) { setAuthError('Incorrect OTP. Please try again.'); return; }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      // onAuthStateChanged will redirect to profile
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ','').replace(/\(auth\/.*\)\.?/,'').trim());
    } finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    await sendOtp(authForm.email);
  };

  // OTP digit input handler
  const handleOtpDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpInput];
    next[index] = value;
    setOtpInput(next);
    if (value && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otpInput];
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setOtpInput(next);
    if (text.length < 6) otpRefs[text.length]?.current?.focus();
    else otpRefs[5].current?.focus();
  };

  // ── PROFILE SETUP ────────────────────────────────────────────────────────────
  const handleProfileSetup = async (e) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const data = { name: profileForm.name, regNo: profileForm.regNo, email: user.email };
      await setDoc(doc(db, 'users', user.uid), data);
      setUserData(data); setView('dashboard');
    } catch { setAuthError('Error saving profile.'); }
    finally { setIsLoading(false); }
  };

  // ── PHOTO HANDLING ───────────────────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'error'); return; }
    setPostPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPostPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadPhoto = async (file) => {
    const cloudName = 'dwqxfheum'; // From Cloudinary Dashboard
    const uploadPreset = 'entrepre'; // From Cloudinary Settings

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.secure_url; // This URL goes into your Firestore document
  };

  // ── POST HANDLERS ────────────────────────────────────────────────────────────
  const openNewPost = () => {
    setEditItem(null);
    setPostForm({ type:'Lost', objectName:'', location:'', phone:'', category:'Electronics', description:'' });
    setPostPhoto(null); setPhotoPreview(null);
    setShowModal(true);
  };

  const openEditPost = (item) => {
    setEditItem(item);
    setPostForm({ type:item.type, objectName:item.objectName, location:item.location,
      phone:item.phone||'', category:item.category||'Other', description:item.description||'' });
    setPostPhoto(null);
    setPhotoPreview(item.photoUrl || null);
    setShowModal(true);
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault(); setIsLoading(true);
    try {
      let photoUrl = editItem?.photoUrl || null;

      if (postPhoto) {
        setUploadProgress(true);
        photoUrl = await uploadPhoto(postPhoto);
        setUploadProgress(false);
      }

      if (editItem) {
        await updateDoc(doc(db, 'items', editItem.id), { ...postForm, photoUrl, editedAt: new Date() });
        showToast('Post updated!');
      } else {
        await addDoc(collection(db, 'items'), {
          ...postForm, photoUrl,
          reportedBy: userData.name, reporterEmail: user.email,
          reporterUid: user.uid, timestamp: new Date(), resolved: false
        });
        showToast('Item reported to the board!');
      }
      setPostSuccess(true);
      setTimeout(() => { setShowModal(false); setPostSuccess(false); removePhoto(); }, 1400);
    } catch (err) { console.error(err); showToast('Error submitting. Try again.', 'error'); }
    finally { setIsLoading(false); setUploadProgress(false); }
  };

  const handleResolve = async (item) => {
    try { await updateDoc(doc(db,'items',item.id), { resolved:true, resolvedAt:new Date() }); showToast('Marked as resolved! 🎉'); }
    catch { showToast('Error updating item.','error'); }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try { await deleteDoc(doc(db,'items',itemId)); showToast('Post deleted.'); }
    catch { showToast('Error deleting.','error'); }
  };

  // ── AI MATCHING ───────────────────────────────────────────────────────────────
  const handleAiMatch = async () => {
    setAiLoading(true); setShowAiPanel(true); setAiMatches(null);
    const lost  = items.filter(i => !i.resolved && i.type==='Lost');
    const found = items.filter(i => !i.resolved && i.type==='Found');
    if (!lost.length || !found.length) { setAiMatches([]); setAiLoading(false); return; }

    const prompt = `You are an AI for a campus lost & found system. Find PROBABLE MATCHES between lost and found items using semantic similarity — not just keywords. Consider: object type, category, location proximity, descriptions.

LOST:
${lost.map((i,n)=>`${n+1}. [ID:${i.id}] "${i.objectName}" Cat:${i.category||'?'} Loc:${i.location} Desc:${i.description||'none'} By:${i.reportedBy} Email:${i.reporterEmail}`).join('\n')}

FOUND:
${found.map((i,n)=>`${n+1}. [ID:${i.id}] "${i.objectName}" Cat:${i.category||'?'} Loc:${i.location} Desc:${i.description||'none'} By:${i.reportedBy} Email:${i.reporterEmail}`).join('\n')}

Return ONLY JSON array: [{"lostId":"...","foundId":"...","lostName":"...","foundName":"...","lostBy":"...","foundBy":"...","lostEmail":"...","foundEmail":"...","confidence":"High|Medium|Low","reason":"..."}]
No matches → []. No markdown.`;

    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{ role:'user', content:prompt }] })
      });
      const data = await res.json();
      const text = (data.content||[]).map(c=>c.text||'').join('');
      setAiMatches(JSON.parse(text.replace(/```json|```/g,'').trim()));
    } catch { setAiMatches([]); }
    finally { setAiLoading(false); }
  };

  // ── DERIVED ───────────────────────────────────────────────────────────────────
  const isAdmin        = user?.email === ADMIN_EMAIL;
  const lostCount      = items.filter(i=>!i.resolved&&i.type==='Lost').length;
  const foundCount     = items.filter(i=>!i.resolved&&i.type==='Found').length;
  const resolvedCount  = items.filter(i=>i.resolved).length;
  const resolutionRate = items.length>0?Math.round((resolvedCount/items.length)*100):0;
  const canManage      = (item) => user && (item.reporterUid===user.uid||isAdmin);

  const getFiltered = (type) => items.filter(item => {
    if (item.resolved || item.type!==type) return false;
    if (categoryFilter!=='All' && item.category!==categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (item.objectName||'').toLowerCase().includes(q) ||
             (item.location||'').toLowerCase().includes(q) ||
             (item.reportedBy||'').toLowerCase().includes(q) ||
             (item.description||'').toLowerCase().includes(q) ||
             (item.category||'').toLowerCase().includes(q);
    }
    return true;
  });

  const tableItems = activeTab==='Resolved' ? items.filter(i=>i.resolved)
                   : activeTab==='Admin'    ? items
                   : getFiltered(activeTab);

  // ════════════════════════════════════════════════════════════════════════════
  // LANDING
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'landing') return (
    <div className="landing">
      <div className="land-orb orb-a"/><div className="land-orb orb-b"/>
      <nav className="land-nav">
        <div className="land-brand">
          <div className="brand-icon"><SearchSVG size={18}/></div>
          <span>KarunyaRecover</span>
        </div>
        <button className="land-nav-btn" onClick={()=>setView('auth')}>Get Started →</button>
      </nav>
      <section className="hero">
        <div className="hero-badge">🏫 Built for Karunya University</div>
        <h1 className="hero-title">Lost something<br/>on campus?<br/><span className="hero-accent">We'll find it.</span></h1>
        <p className="hero-sub">AI-powered campus lost &amp; found — with photo uploads, smart matching, and verified-only access.</p>
        <div className="hero-btns">
          <button className="hero-btn-primary" onClick={()=>setView('auth')}>Start Recovering →</button>
          <button className="hero-btn-ghost" onClick={()=>setView('auth')}>Report a Found Item</button>
        </div>
      </section>
      <section className="land-how">
        <h2>How it works</h2>
        <div className="how-grid">
          {[
            {n:'01',t:'Verify with OTP',d:'Enter your @karunya.edu.in email — we send a 6-digit OTP to confirm your identity before account creation.'},
            {n:'02',t:'Post with Photo',d:'Describe your lost or found item, pick a category, add a location, and attach a photo for faster identification.'},
            {n:'03',t:'AI Smart Match',d:'Claude AI scans all posts semantically — matching "wireless earbuds" with "audio device near library".'},
            {n:'04',t:'Connect & Resolve',d:'Contact the reporter directly. Once reunited, mark your post as Resolved to keep the board clean.'},
          ].map((s,i)=>(
            <div className="how-card" key={i}>
              <div className="how-num">{s.n}</div>
              <h3>{s.t}</h3><p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="land-cta">
        <div className="land-cta-inner">
          <h2>Ready to recover what's yours?</h2>
          <p>Join the Karunya campus community. It's free forever.</p>
          <button className="hero-btn-primary" onClick={()=>setView('auth')}>Create Your Account →</button>
        </div>
      </section>
      <footer className="land-footer">© 2025 KarunyaRecover · Karunya University</footer>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'auth') return (
    <div className="auth-container">
      <div className="auth-bg-orb orb-1"/><div className="auth-bg-orb orb-2"/>
      <button className="back-link" onClick={()=>setView('landing')}>← Back</button>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon"><SearchSVG size={18}/></div>
          <span className="brand-name">KarunyaRecover</span>
        </div>
        <div className="auth-header">
          <h1>{isLoginView?'Welcome back':'Join the community'}</h1>
          <p>{isLoginView?'Sign in to your campus account':'Register with your Karunya email'}</p>
        </div>
        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <label>Email address</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input type="email" placeholder="you@karunya.edu.in" required
                onChange={e=>{setAuthForm({...authForm,email:e.target.value});setAuthError('');}}/>
            </div>
          </div>
          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input type="password" placeholder="••••••••" required
                onChange={e=>{setAuthForm({...authForm,password:e.target.value});setAuthError('');}}/>
            </div>
          </div>
          {authError && <div className="error-banner">{authError}</div>}
          {!isLoginView && (
            <div className="otp-info-box">
              <span>📧</span>
              <p>A 6-digit OTP will be sent to your email to verify your identity before account creation.</p>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={isLoading||otpSending}>
            {isLoading||otpSending ? <span className="spinner"/> : (isLoginView?'Sign In':'Send OTP →')}
          </button>
        </form>
        <p className="toggle-auth" onClick={()=>{setIsLoginView(!isLoginView);setAuthError('');}}>
          {isLoginView?"Don't have an account? ":"Already have an account? "}
          <span>{isLoginView?'Sign up':'Sign in'}</span>
        </p>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // OTP VERIFICATION
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'otp') return (
    <div className="auth-container">
      <div className="auth-bg-orb orb-1"/><div className="auth-bg-orb orb-2"/>
      <div className="auth-card otp-card">
        <div className="otp-header-icon">📬</div>
        <div className="auth-header">
          <h1>Check your inbox</h1>
          <p>We sent a 6-digit code to<br/><strong>{authForm.email}</strong></p>
        </div>

        {/* Timer */}
        {otpTimeLeft > 0 ? (
          <div className="otp-timer">
            Code expires in <span className={otpTimeLeft < 60 ? 'timer-urgent' : ''}>{Math.floor(otpTimeLeft/60)}:{String(otpTimeLeft%60).padStart(2,'0')}</span>
          </div>
        ) : (
          <div className="otp-timer expired">Code has expired — please request a new one.</div>
        )}

        {/* 6-box OTP input */}
        <div className="otp-boxes">
          {otpInput.map((digit, i) => (
            <input key={i} ref={otpRefs[i]} className="otp-box" type="text"
              inputMode="numeric" maxLength={1} value={digit}
              onChange={e=>handleOtpDigit(i,e.target.value)}
              onKeyDown={e=>handleOtpKeyDown(i,e)}
              onPaste={i===0?handleOtpPaste:undefined}
              autoFocus={i===0}
            />
          ))}
        </div>

        {authError && <div className="error-banner" style={{marginBottom:12}}>{authError}</div>}

        <button className="btn-primary" onClick={handleVerifyOtp} disabled={isLoading||otpTimeLeft===0}>
          {isLoading ? <span className="spinner"/> : 'Verify & Create Account →'}
        </button>

        <button className="resend-btn" onClick={handleResendOtp} disabled={otpCooldown>0}>
          {otpCooldown>0 ? `Resend in ${otpCooldown}s` : 'Resend OTP'}
        </button>

        <button className="ghost-link" onClick={()=>{setView('auth');setAuthError('');}}>
          ← Use a different email
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PROFILE SETUP
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'profile') return (
    <div className="auth-container">
      <div className="auth-bg-orb orb-1"/><div className="auth-bg-orb orb-2"/>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon"><SearchSVG size={18}/></div>
          <span className="brand-name">KarunyaRecover</span>
        </div>
        <div className="auth-header">
          <h1>One last step ✓</h1>
          <p>Your email is verified! Set up your campus profile.</p>
        </div>
        <form onSubmit={handleProfileSetup} className="auth-form">
          <div className="input-group">
            <label>Full Name</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
              <input type="text" placeholder="Your full name" required
                onChange={e=>setProfileForm({...profileForm,name:e.target.value})}/>
            </div>
          </div>
          <div className="input-group">
            <label>Register Number</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h4"/>
              </svg>
              <input type="text" placeholder="e.g. URK20CS100" required
                onChange={e=>setProfileForm({...profileForm,regNo:e.target.value})}/>
            </div>
          </div>
          {authError && <div className="error-banner">{authError}</div>}
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading?<span className="spinner"/>:'Save & Enter Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox" onClick={()=>setLightbox(null)}>
          <button className="lightbox-close">✕</button>
          <img src={lightbox} alt="Item" onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="brand-icon small"><SearchSVG size={14}/></div>
          <span className="nav-logo">KarunyaRecover</span>
          {isAdmin && <span className="admin-badge">Admin</span>}
        </div>
        <div className="nav-actions">
          <button className="icon-btn" onClick={()=>setShowStats(s=>!s)} title="Analytics">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
          <button className="icon-btn ai-btn" onClick={handleAiMatch} disabled={aiLoading} title="AI Smart Match">
            {aiLoading?<span className="spinner-sm"/>:'✦ AI'}
          </button>
          <div className="user-chip">
            <div className="avatar">{userData?.name?.charAt(0).toUpperCase()}</div>
            <span>{userData?.name}</span>
          </div>
          <button onClick={openNewPost} className="btn-post">+ Report Item</button>
          <button onClick={()=>signOut(auth)} className="btn-logout">Logout</button>
        </div>
      </nav>

      <main className="main-content">

        {/* SEARCH BAR — PROMINENT */}
        <div className="search-hero">
          <div className="search-hero-inner">
            <SearchSVG size={20}/>
            <input
              type="text"
              className="search-hero-input"
              placeholder="Search by item name, location, category, reporter..."
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={()=>setSearchQuery('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="search-result-count">
              {getFiltered('Lost').length + getFiltered('Found').length} result{getFiltered('Lost').length+getFiltered('Found').length!==1?'s':''} for "{searchQuery}"
            </div>
          )}
        </div>

        {/* CATEGORY FILTER */}
        <div className="cat-chips">
          {['All',...CATEGORIES].map(cat=>(
            <button key={cat} className={`cat-chip ${categoryFilter===cat?'cat-active':''}`}
              onClick={()=>setCategoryFilter(cat)}>{cat}</button>
          ))}
        </div>

        {/* STATS PANEL */}
        {showStats && (
          <div className="stats-panel">
            <div className="sp-header">
              <h3>📊 Analytics Dashboard</h3>
              <button className="sp-close" onClick={()=>setShowStats(false)}>✕</button>
            </div>
            <div className="sp-grid">
              {[
                {v:lostCount,      l:'Active Lost',    cls:'s-lost'},
                {v:foundCount,     l:'Active Found',   cls:'s-found'},
                {v:resolvedCount,  l:'Resolved',       cls:'s-resolved'},
                {v:`${resolutionRate}%`,l:'Resolution Rate',cls:'s-accent'},
                {v:items.length,   l:'Total Posts',    cls:''},
                {v:items.filter(i=>i.photoUrl).length, l:'With Photos', cls:'s-accent'},
              ].map((s,i)=>(
                <div className="sp-card" key={i}>
                  <div className={`sp-num ${s.cls}`}>{s.v}</div>
                  <div className="sp-label">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="sp-cats">
              <h4>Posts by Category</h4>
              {CATEGORIES.map(cat=>{
                const count=items.filter(i=>i.category===cat).length;
                if(!count)return null;
                const pct=Math.round((count/items.length)*100);
                return(
                  <div className="cat-row" key={cat}>
                    <span className="cat-row-name">{cat}</span>
                    <div className="cat-row-track"><div className="cat-row-fill" style={{width:`${pct}%`}}/></div>
                    <span className="cat-row-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI PANEL */}
        {showAiPanel && (
          <div className="ai-panel">
            <div className="sp-header">
              <div>
                <h3>✦ AI Smart Matching</h3>
                <p className="ai-sub">Claude AI analyses all items semantically to find probable matches</p>
              </div>
              <button className="sp-close" onClick={()=>setShowAiPanel(false)}>✕</button>
            </div>
            {aiLoading?(
              <div className="ai-loading"><div className="ai-pulse">✦</div><p>Analysing items with AI...</p></div>
            ):aiMatches===null?null:aiMatches.length===0?(
              <div className="ai-empty">No probable matches found. More items needed for accurate matching.</div>
            ):(
              <div className="ai-matches">
                {aiMatches.map((m,i)=>(
                  <div className={`ai-card conf-${(m.confidence||'').toLowerCase()}`} key={i}>
                    <span className={`conf-badge ${(m.confidence||'').toLowerCase()}`}>{m.confidence} Match</span>
                    <div className="ai-match-row">
                      <div className="ai-side lost-side"><div className="side-type">Lost</div><strong>{m.lostName}</strong><small>by {m.lostBy}</small></div>
                      <div className="ai-arrow">↔</div>
                      <div className="ai-side found-side"><div className="side-type">Found</div><strong>{m.foundName}</strong><small>by {m.foundBy}</small></div>
                    </div>
                    <p className="ai-reason">💡 {m.reason}</p>
                    <div className="ai-actions">
                      {m.lostEmail  && <a href={`mailto:${m.lostEmail}?subject=Match found on KarunyaRecover`}  className="ai-email-btn lost-ebtn">Email Lost Reporter</a>}
                      {m.foundEmail && <a href={`mailto:${m.foundEmail}?subject=Match found on KarunyaRecover`} className="ai-email-btn found-ebtn">Email Found Reporter</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TABS */}
        <div className="tabs">
          {['Lost','Found','Resolved',...(isAdmin?['Admin']:[])].map(tab=>(
            <button key={tab}
              className={`tab ${activeTab===tab?`active tab-${tab.toLowerCase()}`:''}`}
              onClick={()=>setActiveTab(tab)}>
              {tab==='Lost'&&'⚠ '}{tab==='Found'&&'✓ '}{tab==='Resolved'&&'🎉 '}{tab==='Admin'&&'🛡 '}
              {tab}
              <span className="tab-count">
                {tab==='Lost'&&lostCount}{tab==='Found'&&foundCount}
                {tab==='Resolved'&&resolvedCount}{tab==='Admin'&&items.length}
              </span>
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="table-container">
          {tableItems.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Reported By</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  {activeTab!=='Resolved'&&<th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tableItems.map(item=>(
                  <tr key={item.id} className={item.resolved?'row-resolved':''}>
                    <td>
                      {item.photoUrl ? (
                        <div className="thumb-wrap" onClick={()=>setLightbox(item.photoUrl)}>
                          <img src={item.photoUrl} alt="item" className="thumb"/>
                          <div className="thumb-overlay">🔍</div>
                        </div>
                      ) : <div className="no-photo">—</div>}
                    </td>
                    <td>
                      <div className="object-cell">
                        <div className={`type-dot dot-${(item.type||'').toLowerCase()}`}/>
                        <div>
                          <strong>{item.objectName}</strong>
                          {item.description&&<div className="item-desc">{item.description}</div>}
                          {item.resolved&&<span className="resolved-badge">Resolved ✓</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="cat-badge">{item.category||'—'}</span></td>
                    <td>
                      <div className="location-cell">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        {item.location}
                      </div>
                    </td>
                    <td>
                      <div className="reporter-cell">
                        <div className="mini-avatar">{item.reportedBy?.charAt(0).toUpperCase()}</div>
                        {item.reportedBy}
                      </div>
                    </td>
                    <td><a href={`mailto:${item.reporterEmail}`}>{item.reporterEmail}</a></td>
                    <td>{item.phone?<span className="phone-tag">{item.phone}</span>:<span className="na-tag">—</span>}</td>
                    {activeTab!=='Resolved'&&(
                      <td>
                        <div className="action-group">
                          {canManage(item)&&!item.resolved&&(
                            <>
                              <button className="act resolve-act" onClick={()=>handleResolve(item)} title="Mark Resolved">✓</button>
                              <button className="act edit-act"    onClick={()=>openEditPost(item)}   title="Edit">✎</button>
                            </>
                          )}
                          {(canManage(item)||isAdmin)&&(
                            <button className="act delete-act" onClick={()=>handleDelete(item.id)} title="Delete">✕</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">{activeTab==='Lost'?'🔍':activeTab==='Found'?'📦':activeTab==='Resolved'?'🎉':'🛡'}</div>
              <h3>{searchQuery||categoryFilter!=='All'?'No results found':`No ${activeTab.toLowerCase()} items yet`}</h3>
              <p>{searchQuery?`No items match "${searchQuery}"`:categoryFilter!=='All'?`No ${activeTab.toLowerCase()} items in ${categoryFilter}`:`Be the first to post a ${activeTab.toLowerCase()} item.`}</p>
              {activeTab!=='Resolved'&&!searchQuery&&categoryFilter==='All'&&(
                <button className="btn-post" onClick={openNewPost}>Report an Item</button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* POST / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            {postSuccess ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h3>{editItem?'Updated!':'Posted!'}</h3>
                <p>Your report has been submitted to the board.</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <div><h3>{editItem?'Edit Report':'Report an Item'}</h3><p>Fill in the details below</p></div>
                  <button className="modal-close" onClick={()=>setShowModal(false)}>✕</button>
                </div>
                <form onSubmit={handlePostSubmit} className="modal-form">
                  {/* Type toggle */}
                  <div className="type-toggle">
                    {['Lost','Found'].map(t=>(
                      <button key={t} type="button"
                        className={`toggle-btn ${postForm.type===t?(t==='Lost'?'tog-lost':'tog-found'):''}`}
                        onClick={()=>setPostForm({...postForm,type:t})}>
                        {t==='Lost'?'⚠ I Lost Something':'✓ I Found Something'}
                      </button>
                    ))}
                  </div>

                  {/* Category */}
                  <div className="input-group">
                    <label>Category</label>
                    <select className="modal-select" value={postForm.category}
                      onChange={e=>setPostForm({...postForm,category:e.target.value})}>
                      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Object Name</label>
                    <input className="modal-input" type="text" placeholder="e.g. Blue AirPods Case" required
                      value={postForm.objectName} onChange={e=>setPostForm({...postForm,objectName:e.target.value})}/>
                  </div>

                  <div className="input-group">
                    <label>Location</label>
                    <input className="modal-input" type="text" placeholder="e.g. Main Library, Ground Floor" required
                      value={postForm.location} onChange={e=>setPostForm({...postForm,location:e.target.value})}/>
                  </div>

                  <div className="input-group">
                    <label>Description <span className="opt-tag">Optional</span></label>
                    <textarea className="modal-textarea" rows={2}
                      placeholder="Colour, brand, distinguishing features..."
                      value={postForm.description}
                      onChange={e=>setPostForm({...postForm,description:e.target.value})}/>
                  </div>

                  {/* PHOTO UPLOAD */}
                  <div className="input-group">
                    <label>Photo <span className="opt-tag">Optional · max 5MB</span></label>
                    {photoPreview ? (
                      <div className="photo-preview-wrap">
                        <img src={photoPreview} alt="preview" className="photo-preview"/>
                        <button type="button" className="photo-remove" onClick={removePhoto}>✕ Remove</button>
                      </div>
                    ) : (
                      <div className="photo-upload-zone" onClick={()=>fileInputRef.current?.click()}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Click to upload a photo</span>
                        <small>JPG, PNG, WEBP</small>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="file-input-hidden"
                      onChange={handlePhotoChange}/>
                  </div>

                  <div className="input-group">
                    <label>Phone Number <span className="opt-tag">Optional</span></label>
                    <input className="modal-input" type="text" placeholder="Your contact number"
                      value={postForm.phone} onChange={e=>setPostForm({...postForm,phone:e.target.value})}/>
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={()=>setShowModal(false)} className="btn-cancel">Cancel</button>
                    <button type="submit" className="btn-primary modal-submit-btn" disabled={isLoading||uploadProgress}>
                      {uploadProgress?<><span className="spinner"/>  Uploading photo...</>
                       :isLoading?<span className="spinner"/>
                       :(editItem?'Save Changes':'Submit Report')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
