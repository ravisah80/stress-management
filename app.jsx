// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './index.css';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with actual key

const STRESS_QUESTIONS = [
  { id: 'sleep', emoji: '😴', label: 'How many hours did you sleep last night?', type: 'mcq', options: ['Less than 4h','4–6h','6–8h','8h+'] },
  { id: 'workload', emoji: '💼', label: 'How would you rate your current workload?', type: 'slider', min: 0, max: 10 },
  { id: 'mood', emoji: '😊', label: 'How is your overall mood today?', type: 'mcq', options: ['Very Low','Low','Neutral','Good','Excellent'] },
  { id: 'social', emoji: '👥', label: 'How satisfied are you with your social interactions?', type: 'mcq', options: ['Very Unsatisfied','Unsatisfied','Neutral','Satisfied','Very Satisfied'] },
  { id: 'anxiety', emoji: '🧠', label: 'Rate your anxiety level right now (0 = none, 10 = extreme)', type: 'slider', min: 0, max: 10 },
  { id: 'energy', emoji: '⚡', label: 'How is your energy level today?', type: 'mcq', options: ['Exhausted','Tired','Okay','Energized','Very Energized'] },
];

const RECS = {
  music: [
    { emoji:'🎵', title:'Ocean Waves Meditation', desc:'60-min gentle ocean sounds for deep relaxation', tag:'music' },
    { emoji:'🎹', title:'Piano for Calm', desc:'Soothing instrumental piano pieces', tag:'music' },
    { emoji:'🌿', title:'Forest Sounds ASMR', desc:'Natural ambience to ease anxiety', tag:'music' },
  ],
  meme: [
    { emoji:'😂', title:'Work From Home Fails', desc:'Hilarious relatable remote work compilation', tag:'meme' },
    { emoji:'🐶', title:'Funny Dogs Compilation', desc:'Adorable dog moments to brighten your day', tag:'meme' },
    { emoji:'🤣', title:'Best Reddit Memes 2024', desc:'Top upvoted humor for instant mood lift', tag:'meme' },
  ],
  relax: [
    { emoji:'🧘', title:'5-Min Breathing Exercise', desc:'Box breathing technique for instant calm', tag:'relax' },
    { emoji:'🌅', title:'Sunrise Yoga Flow', desc:'Gentle morning movement to reset your mind', tag:'relax' },
    { emoji:'💧', title:'Rain on Window', desc:'2-hour lo-fi rain ambience for focus', tag:'relax' },
  ],
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function calcStressScore(answers) {
  let score = 0;
  const sleep = answers.sleep;
  if (sleep === 'Less than 4h') score += 30;
  else if (sleep === '4–6h') score += 20;
  else if (sleep === '6–8h') score += 8;
  else score += 0;
  score += (answers.workload || 0) * 3;
  const moods = ['Very Low','Low','Neutral','Good','Excellent'];
  const moodIdx = moods.indexOf(answers.mood);
  if (moodIdx >= 0) score += (4 - moodIdx) * 5;
  const socials = ['Very Unsatisfied','Unsatisfied','Neutral','Satisfied','Very Satisfied'];
  const socialIdx = socials.indexOf(answers.social);
  if (socialIdx >= 0) score += (4 - socialIdx) * 4;
  score += (answers.anxiety || 0) * 2.5;
  const energies = ['Exhausted','Tired','Okay','Energized','Very Energized'];
  const energyIdx = energies.indexOf(answers.energy);
  if (energyIdx >= 0) score += (4 - energyIdx) * 3;
  return Math.min(100, Math.round(score));
}

function scoreColor(s) {
  if (s >= 70) return '#ef4444';
  if (s >= 40) return '#f97316';
  return '#22c55e';
}

function scoreLabel(s) {
  if (s >= 70) return { label: 'High Stress', desc: 'Your stress levels are elevated. Let\'s work together to bring them down.' };
  if (s >= 40) return { label: 'Moderate Stress', desc: 'Some stress detected. A few calming activities should help.' };
  return { label: 'Low Stress', desc: 'You\'re doing great! Minimal stress detected today.' };
}

function now() {
  return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function callGemini(messages, lang = 'en') {
  const langNote = lang === 'ne' ? 'Reply ONLY in Nepali language.' : 'Reply in English.';
  const systemPrompt = `You are Serenity, a compassionate AI mental wellness companion. ${langNote}
Rules:
- Reply in 2-3 SHORT sentences maximum
- Be motivational, warm, and supportive
- Focus ONLY on mental wellness, stress, emotions, and wellbeing topics
- If user asks about anything unrelated to mental wellness, stress, or emotions, reply: "${lang === 'ne' ? 'तपाईं विषयबाट बाहिर जान हुँदैछ।' : 'You are going out of the topic.'}"
- Never give medical diagnoses`;

  try {
    const body = {
      model: "gemini-1.5-flash",
      max_tokens: 150,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))
    };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: "claude-sonnet-4-20250514" })
    });
    const data = await res.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    return text || fallbackReply(lang);
  } catch (e) {
    return fallbackReply(lang);
  }
}

function fallbackReply(lang) {
  const replies = lang === 'ne'
    ? ["तपाईंको भावनाहरू सुन्न मलाई खुसी लाग्छ। तपाईं एक्लै हुनुहुन्न। 💙", "श्वास लिनुहोस् — यो पनि बित्नेछ। तपाईं बलियो हुनुहुन्छ। 🌟", "तपाईंको बारेमा सोच्नु राम्रो कुरा हो। आफ्नो ख्याल राख्नुस्। 💙"]
    : ["I hear you, and your feelings are completely valid. You're not alone in this. 💙", "Take a deep breath — this moment will pass. You are stronger than you know. 🌟", "Reaching out is a sign of strength. Let's work through this together. 💙"];
  return replies[Math.floor(Math.random() * replies.length)];
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
// Keep BrainCanvas, Gauge, StepIndicator, StressQuiz, ScoreScreen, 
// ScenarioInput, Chatbot, Recommendations, ComparisonView, Dashboard, 
// AboutPage, ProfilePage, and Toast exactly as they were in the HTML

function BrainCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 80 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0005,
      vy: (Math.random() - 0.5) * 0.0005,
      r: Math.random() * 2.5 + 0.5,
      a: Math.random(),
    }));

    function drawBrain(cx, cy, r, t) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 0.4) * 0.06);
      const s = r / 100;
      ctx.scale(s, s);

      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 130);
      grd.addColorStop(0, 'rgba(30,94,255,0.18)');
      grd.addColorStop(0.6, 'rgba(30,94,255,0.08)');
      grd.addColorStop(1, 'rgba(30,94,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-10, -60);
      ctx.bezierCurveTo(-80, -90, -120, -50, -110, 10);
      ctx.bezierCurveTo(-120, 60, -70, 80, -10, 60);
      ctx.bezierCurveTo(-40, 30, -40, -20, -10, -60);
      ctx.strokeStyle = 'rgba(91,154,255,0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, -60);
      ctx.bezierCurveTo(80, -90, 120, -50, 110, 10);
      ctx.bezierCurveTo(120, 60, 70, 80, 10, 60);
      ctx.bezierCurveTo(40, 30, 40, -20, 10, -60);
      ctx.stroke();

      for (let i = 0; i < 5; i++) {
        const y = -40 + i * 22;
        const amp = 18 + Math.sin(t * 0.8 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(-100 + i * 4, y);
        ctx.quadraticCurveTo(-60 + amp, y + 10, -20, y + (i % 2 === 0 ? 8 : -4));
        ctx.strokeStyle = `rgba(91,154,255,${0.25 + i * 0.06})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const y = -40 + i * 22;
        const amp = 18 + Math.cos(t * 0.8 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(100 - i * 4, y);
        ctx.quadraticCurveTo(60 - amp, y + 10, 20, y + (i % 2 === 0 ? 8 : -4));
        ctx.strokeStyle = `rgba(91,154,255,${0.25 + i * 0.06})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(0, -65); ctx.lineTo(0, 65);
      ctx.strokeStyle = 'rgba(168,200,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

      for (let i = 0; i < 6; i++) {
        const px = Math.sin(t * 1.2 + i * 1.05) * 60;
        const py = Math.cos(t * 0.9 + i * 0.7) * 40;
        const pr = 2.5 + Math.sin(t * 2 + i) * 1;
        ctx.beginPath(); ctx.arc(px + (i > 2 ? 20 : -20), py, pr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(91,154,255,${0.5 + Math.sin(t * 2 + i) * 0.3})`;
        ctx.fill();
      }

      ctx.restore();
    }

    function draw() {
      tRef.current += 0.012;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);

      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        const alpha = (Math.sin(t + p.a * 10) + 1) / 2 * 0.5;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(91,154,255,${alpha * 0.6})`;
        ctx.fill();
      });

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = (pts[i].x - pts[j].x) * W;
          const dy = (pts[i].y - pts[j].y) * H;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x * W, pts[i].y * H);
            ctx.lineTo(pts[j].x * W, pts[j].y * H);
            ctx.strokeStyle = `rgba(91,154,255,${(1 - d / 100) * 0.08})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      const floatY = Math.sin(t * 0.7) * 10;
      drawBrain(W / 2, H / 2 + floatY, Math.min(W, H) * 0.38, t);

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="brain-canvas" style={{ width:'100%', height:'100%' }} />;
}

// (Include ALL other components verbatim here: Gauge, StepIndicator, StressQuiz, ScoreScreen, ScenarioInput, Chatbot, Recommendations, ComparisonView, Dashboard, AboutPage, ProfilePage, Toast)

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('landing');
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [step, setStep] = useState(0);
  const [beforeScore, setBeforeScore] = useState(null);
  const [afterScore, setAfterScore] = useState(null);
  const [situation, setSituation] = useState('');
  const [reason, setReason] = useState('');
  const [sessions, setSessions] = useState([
    { date: Date.now() - 7*86400000, before: 72, after: 48, duration: 12 },
    { date: Date.now() - 4*86400000, before: 65, after: 40, duration: 15 },
    { date: Date.now() - 86400000, before: 58, after: 35, duration: 10 },
  ]);
  const [toast, setToast] = useState(null);
  const [authForm, setAuthForm] = useState({ name:'', email:'', password:'', error:'' });
  const sessionStart = useRef(Date.now());

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleAuth = (mode) => {
    const { name, email, password } = authForm;
    if (!email || !password) { setAuthForm(p => ({ ...p, error: 'Please fill all fields.' })); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setAuthForm(p => ({ ...p, error: 'Invalid email address.' })); return; }
    if (password.length < 6) { setAuthForm(p => ({ ...p, error: 'Password must be at least 6 characters.' })); return; }
    if (mode === 'signup' && !name) { setAuthForm(p => ({ ...p, error: 'Please enter your name.' })); return; }

    const u = { name: name || email.split('@')[0], email, joinedAt: Date.now() };
    setUser(u); setAuthMode(null); setView('app');
    showToast(`Welcome${mode === 'signup' ? '' : ' back'}, ${u.name}! 👋`);
  };

  const handleQuizComplete = (score, answers) => { setBeforeScore(score); setStep(1); };
  const handleScenarioSubmit = (sit, reas) => { setSituation(sit); setReason(reas); setStep(3); };
  const handleChatComplete = () => setStep(4);
  const handleStartPostQuiz = () => setStep(5);
  const handlePostQuizComplete = (score) => { setAfterScore(score); setStep(6); };
  const handleShowComparison = () => setStep(7);
  const handleSessionDone = () => {
    const duration = Math.round((Date.now() - sessionStart.current) / 60000);
    setSessions(p => [...p, { date: Date.now(), before: beforeScore, after: afterScore, duration: Math.max(5, duration) }]);
    setPage('dashboard'); setStep(0);
    showToast('Session saved! Great work today. 🌟');
  };

  const startNewSession = () => {
    setBeforeScore(null); setAfterScore(null);
    setSituation(''); setReason(''); setStep(0);
    sessionStart.current = Date.now();
    setPage('home');
  };

  if (view === 'landing') {
    return (
      <div>
        {/* Paste the entire landing JSX here directly from your original code */}
      </div>
    );
  }

  // APP SHELL
  const renderHome = () => {
    if (step === 0) return <StressQuiz onComplete={handleQuizComplete} />;
    if (step === 1) return (
      <div>
        <div className="page-title">🎯 Your Stress Score</div>
        <div className="page-sub">Based on your responses, here's your current stress level.</div>
        <ScoreScreen score={beforeScore} onNext={() => setStep(2)} />
      </div>
    );
    if (step === 2) return <ScenarioInput onNext={handleScenarioSubmit} />;
    if (step === 3) return <Chatbot situation={situation} reason={reason} stressScore={beforeScore} onComplete={handleChatComplete} />;
    if (step === 4) return <Recommendations score={beforeScore} onNext={handleStartPostQuiz} />;
    if (step === 5) return <StressQuiz onComplete={handlePostQuizComplete} isPost />;
    if (step === 6) return (
      <div>
        <div className="page-title">📊 Post-Session Score</div>
        <div className="page-sub">Let's see how you're feeling now.</div>
        <ScoreScreen score={afterScore} onNext={handleShowComparison} label="See Your Progress" />
      </div>
    );
    if (step === 7) return <ComparisonView before={beforeScore} after={afterScore} onDone={handleSessionDone} />;
  };

  return (
    <div className="app-shell">
        {/* Paste the entire shell JSX here directly from your original code */}
    </div>
  );
}
