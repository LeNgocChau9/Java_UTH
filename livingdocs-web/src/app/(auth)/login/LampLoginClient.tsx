"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { gsap } from "gsap";
import { ArrowLeft } from "lucide-react";
import { login } from "@/services/authService";
import "./lamp-login.css";

type ColorTheme = "amber" | "cyan" | "rose" | "mint" | "moonlight";

export function LampLoginClient({ initialError }: { initialError?: string }) {
  const router = useRouter();

  // State
  const [isOn, setIsOn] = useState(true);
  const [color, setColor] = useState<ColorTheme>("amber");
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [rememberMe, setRememberMe] = useState(true);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Refs for animation
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cordBeadRef = useRef<SVGGElement>(null);
  const elasticCordRef = useRef<SVGPathElement>(null);
  const shadeAssemblyRef = useRef<SVGGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formStageRef = useRef<HTMLDivElement>(null);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ANCHOR_X = 245;
  const ANCHOR_Y = 212;
  const REST_X = 245;
  const REST_Y = 300;

  // Sound helper
  const playElasticPluckSound = (pullDist: number) => {
    if (!isSoundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      if (!audioCtxRef.current) return;

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "triangle";
      const startFreq = 480 + Math.min(260, pullDist * 3);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Audio not supported or blocked
    }
  };

  const renderElasticString = (curX: number, curY: number, twangAmp: number = 0) => {
    if (!elasticCordRef.current) return;
    const midX = (ANCHOR_X + curX) / 2 + twangAmp;
    const midY = (ANCHOR_Y + curY) / 2;
    const stretchRatio = Math.max(1, (curY - ANCHOR_Y) / (REST_Y - ANCHOR_Y));
    const strokeWidth = Math.max(1.6, 2.6 / Math.sqrt(stretchRatio));

    elasticCordRef.current.setAttribute("d", `M ${ANCHOR_X} ${ANCHOR_Y} Q ${midX} ${midY} ${curX} ${curY}`);
    elasticCordRef.current.setAttribute("stroke-width", strokeWidth.toFixed(2));
  };

  // Toggle Lamp
  const toggleLamp = () => {
    setIsOn((prev) => {
      const next = !prev;
      playElasticPluckSound(50);
      return next;
    });
  };

  // Pull cord click / animation
  const handlePullCord = () => {
    if (!cordBeadRef.current || !shadeAssemblyRef.current) return;

    gsap.to(cordBeadRef.current, {
      y: REST_Y + 50,
      duration: 0.2,
      ease: "power2.in",
      onUpdate: () => {
        const by = gsap.getProperty(cordBeadRef.current, "y") as number;
        renderElasticString(REST_X, by);
      },
      onComplete: () => {
        toggleLamp();
        gsap.to(cordBeadRef.current, {
          y: REST_Y,
          duration: 1.1,
          ease: "elastic.out(2.2, 0.16)",
          onUpdate: () => {
            const by = gsap.getProperty(cordBeadRef.current, "y") as number;
            renderElasticString(REST_X, by);
          },
        });
      },
    });

    gsap.to(shadeAssemblyRef.current, {
      rotation: 1.8,
      duration: 0.2,
      ease: "power2.in",
      transformOrigin: "230px 188px",
      onComplete: () => {
        gsap.to(shadeAssemblyRef.current, {
          rotation: 0,
          duration: 0.6,
          ease: "back.out(2.2)",
          transformOrigin: "215px 175px",
        });
      },
    });
  };

  // Canvas Dust Particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particleThemes: Record<ColorTheme, { fill: string; glow: string }> = {
      amber: { fill: "255, 205, 120", glow: "255, 185, 80" },
      cyan: { fill: "140, 245, 255", glow: "0, 240, 255" },
      rose: { fill: "255, 160, 200", glow: "255, 51, 133" },
      mint: { fill: "160, 255, 200", glow: "0, 230, 118" },
      moonlight: { fill: "220, 235, 255", glow: "200, 220, 255" },
    };

    class Particle {
      x = Math.random() * width;
      y = Math.random() * height;
      radius = Math.random() * 2 + 0.6;
      vx = (Math.random() - 0.4) * 0.35;
      vy = -Math.random() * 0.4 - 0.15;
      alpha = Math.random() * 0.6 + 0.2;
      pulseSpeed = Math.random() * 0.03 + 0.01;
      pulse = Math.random() * Math.PI;

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulse += this.pulseSpeed;
        if (this.y < 0) this.y = height;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
      }

      draw() {
        if (!ctx) return;
        const currentAlpha = (Math.sin(this.pulse) * 0.3 + 0.7) * this.alpha;
        const factor = isOn ? 1 : 0.08;
        const theme = particleThemes[color] || particleThemes.amber;

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${theme.fill}, ${currentAlpha * factor})`;
        if (isOn) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${theme.glow}, 0.5)`;
        }
        ctx.fill();
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 45; i++) {
      particles.push(new Particle());
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.update();
        p.draw();
      }
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [isOn, color]);

  // Initial cord bead positioning
  useEffect(() => {
    if (cordBeadRef.current) {
      gsap.set(cordBeadRef.current, { x: REST_X, y: REST_Y });
      renderElasticString(REST_X, REST_Y);
    }
  }, []);

  // 3D Tilt on Form Stage
  useEffect(() => {
    const stage = formStageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!isOn) return;
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(card, {
        rotateX: -(y / rect.height) * 8,
        rotateY: (x / rect.width) * 8,
        duration: 0.45,
        ease: "power1.out",
        transformPerspective: 900,
      });
    };

    const onMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.6,
        ease: "power2.out",
      });
    };

    stage.addEventListener("mousemove", onMouseMove);
    stage.addEventListener("mouseleave", onMouseLeave);

    return () => {
      stage.removeEventListener("mousemove", onMouseMove);
      stage.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [isOn]);

  // Handle Form Submission
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isOn) {
      handlePullCord();
      return;
    }

    setFormError(null);
    if (!email.trim()) {
      setFormError("Vui lòng nhập email hoặc tài khoản.");
      return;
    }
    if (!password) {
      setFormError("Vui lòng nhập mật khẩu.");
      return;
    }

    setPending(true);
    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      if (axios.isAxiosError(caught)) {
        const msg = caught.response?.data?.message;
        if (typeof msg === "string" && msg.trim()) {
          setFormError(msg);
        } else if (caught.response?.status === 401) {
          setFormError("Email hoặc mật khẩu không chính xác.");
        } else {
          setFormError("Đăng nhập thất bại. Vui lòng thử lại.");
        }
      } else {
        setFormError("Đăng nhập chưa hoàn tất. Vui lòng thử lại.");
      }
    } finally {
      setPending(false);
    }
  }

  // GitHub OAuth trigger
  function handleGithubAuth() {
    const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const query = target ? `?redirect=${encodeURIComponent(target)}` : "";
    window.location.assign(`/api/auth/github${query}`);
  }

  return (
    <div
      ref={containerRef}
      className="lamp-login-container"
      data-color={color}
      data-on={isOn ? "true" : "false"}
    >
      <div className="ambient-glow" />
      <canvas ref={canvasRef} id="dustCanvas" />

      {/* Back to Home Link */}
      <Link href="/" className="back-home-link">
        <ArrowLeft size={15} />
        Quay lại trang chủ
      </Link>

      {/* Top Controls: Color Palette + Sound Toggle */}
      <div className="quick-controls">
        <div className="color-palette" title="Chọn tông màu đèn">
          {(["amber", "cyan", "rose", "mint", "moonlight"] as ColorTheme[]).map((c) => (
            <button
              key={c}
              type="button"
              className={`color-dot-btn ${color === c ? "active" : ""}`}
              onClick={() => setColor(c)}
              style={{
                ["--dot-color" as string]:
                  c === "amber"
                    ? "#ffab3d"
                    : c === "cyan"
                    ? "#00f0ff"
                    : c === "rose"
                    ? "#ff3385"
                    : c === "mint"
                    ? "#00e676"
                    : "#d8e5ff",
              }}
              aria-label={`${c} light`}
            />
          ))}
        </div>

        <button
          type="button"
          className="sound-toggle"
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          title="Bật/Tắt âm thanh tương tác"
        >
          {isSoundEnabled ? (
            <svg className="sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg className="sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>
      </div>

      {/* Main Scene: Lamp on Left, Login Form on Right */}
      <main className="scene-container">
        {/* ─── 1. Lamp Interactive Stage ─── */}
        <div className="lamp-stage">
          <div className="lamp-wrapper">
            <svg className="lamp-svg" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="metalArm" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3e434a" />
                  <stop offset="50%" stopColor="#7a828e" />
                  <stop offset="100%" stopColor="#24272c" />
                </linearGradient>

                <linearGradient id="brassJoint" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe299" />
                  <stop offset="45%" stopColor="#c99738" />
                  <stop offset="85%" stopColor="#805915" />
                  <stop offset="100%" stopColor="#f5d38a" />
                </linearGradient>

                <linearGradient id="shadeExterior" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#343840" />
                  <stop offset="40%" stopColor="#21252a" />
                  <stop offset="100%" stopColor="#121417" />
                </linearGradient>

                <linearGradient id="shadeHighlight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="42%" stopColor="#ffffff" stopOpacity="0.16" />
                  <stop offset="72%" stopColor="#ffffff" stopOpacity="0.025" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>

                <linearGradient id="shadeRim" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffd584" />
                  <stop offset="50%" stopColor="#e2ab46" />
                  <stop offset="100%" stopColor="#996a1a" />
                </linearGradient>

                <radialGradient id="reflectorOff" cx="50%" cy="40%" r="70%">
                  <stop offset="0%" stopColor="#2c3036" />
                  <stop offset="55%" stopColor="#1a1d22" />
                  <stop offset="100%" stopColor="#0e1012" />
                </radialGradient>

                <radialGradient id="reflectorOn" cx="50%" cy="40%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="var(--lamp-glow, #ffe194)" stopOpacity="0.85" />
                  <stop offset="70%" stopColor="var(--lamp-accent, #ffab3d)" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#2a2015" stopOpacity="0.85" />
                </radialGradient>

                <linearGradient id="volumetricBeam" x1="0%" y1="0%" x2="90%" y2="70%">
                  <stop offset="0%" stopColor="var(--beam-start, rgba(255, 220, 130, 0.45))" />
                  <stop offset="25%" stopColor="var(--beam-mid, rgba(255, 195, 90, 0.22))" />
                  <stop offset="65%" stopColor="var(--beam-far, rgba(255, 175, 60, 0.08))" />
                  <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
                </linearGradient>

                <filter id="bulbGlowFilter" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="beamSoftFilter" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
              </defs>

              <ellipse className="desk-shadow" cx="190" cy="460" rx="90" ry="16" fill="rgba(0, 0, 0, 0.55)" />

              {/* Volumetric Light Beam */}
              <g className="light-beam-group">
                <polygon
                  className="svg-light-beam"
                  points="182,185 308,225 820,480 340,510"
                  fill="url(#volumetricBeam)"
                  filter="url(#beamSoftFilter)"
                />
              </g>

              {/* Lamp Base */}
              <g className="lamp-base-group">
                <ellipse cx="190" cy="445" rx="72" ry="14" fill="#15171a" />
                <ellipse cx="190" cy="443" rx="70" ry="12" fill="url(#metalArm)" />
                <ellipse cx="190" cy="441" rx="66" ry="10" fill="#1c1f24" />
                <ellipse cx="190" cy="439" rx="60" ry="7" fill="none" stroke="#8e949f" strokeOpacity=".22" strokeWidth=".8" />
                <circle cx="190" cy="439" r="15" fill="url(#brassJoint)" />
                <circle cx="190" cy="439" r="7" fill="#15171a" />
                <circle cx="190" cy="439" r="3.2" fill="#747b86" />
              </g>

              {/* Lower Arm */}
              <g className="lamp-arm-lower">
                <line x1="186" y1="439" x2="156" y2="295" stroke="url(#metalArm)" strokeWidth="4.5" strokeLinecap="round" />
                <line x1="194" y1="439" x2="164" y2="295" stroke="url(#metalArm)" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 188 420 Q 175 360 163 305" stroke="#606670" strokeWidth="2" strokeDasharray="3,3" fill="none" opacity="0.6" />
              </g>

              {/* Elbow Joint */}
              <g className="lamp-elbow-joint">
                <circle cx="160" cy="295" r="13" fill="url(#brassJoint)" />
                <circle cx="160" cy="295" r="6" fill="#1c1f24" />
                <circle cx="160" cy="295" r="3.3" fill="#858b94" />
                <line x1="155" y1="295" x2="165" y2="295" stroke="url(#brassJoint)" strokeWidth="2" />
              </g>

              {/* Upper Arm */}
              <g className="lamp-arm-upper">
                <line x1="160" y1="295" x2="215" y2="175" stroke="url(#metalArm)" strokeWidth="5" strokeLinecap="round" />
                <path d="M 190 439 Q 168 360 160 295 Q 190 230 215 175" stroke="#101114" strokeWidth="3" fill="none" strokeLinecap="round" />
              </g>

              {/* Neck */}
              <g className="lamp-neck">
                <circle cx="215" cy="175" r="11" fill="url(#brassJoint)" />
                <rect x="209" y="162" width="16" height="15" rx="3" fill="url(#metalArm)" transform="rotate(25, 217, 169)" />
              </g>

              {/* Shade Assembly */}
              <g ref={shadeAssemblyRef} className="lamp-shade-assembly">
                <path
                  className="lamp-shade-body"
                  d="M 182.3 184.6 C 188 135, 220 112, 248 115 C 275 118, 298 155, 307.7 225.4 A 66 22 18 0 1 182.3 184.6 Z"
                  fill="url(#shadeExterior)"
                  stroke="#16181b"
                  strokeWidth="1.8"
                />
                <path
                  className="shade-enamel-highlight"
                  d="M 187 181 C 193 139, 221 119, 247 120 C 267 122, 286 144, 297 178 C 271 163, 224 153, 187 181 Z"
                  fill="url(#shadeHighlight)"
                />
                <ellipse className="shade-reflector-off" cx="245" cy="205" rx="66" ry="22" transform="rotate(18, 245, 205)" fill="url(#reflectorOff)" />
                <ellipse className="shade-reflector-on" cx="245" cy="205" rx="66" ry="22" transform="rotate(18, 245, 205)" fill="url(#reflectorOn)" />
                <ellipse className="reflector-detail" cx="245" cy="205" rx="49" ry="14" transform="rotate(18, 245, 205)" fill="none" stroke="#fff3ce" strokeOpacity=".16" strokeWidth=".8" />
                <path className="shade-rim-trim" d="M 182.3 184.6 A 66 22 18 0 0 307.7 225.4" stroke="url(#shadeRim)" strokeWidth="4" fill="none" strokeLinecap="round" />

                <g className="bulb-unit">
                  <ellipse className="bulb-glass" cx="245" cy="195" rx="14" ry="17" transform="rotate(18, 245, 195)" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  <path className="bulb-filament" d="M 241 189 Q 245 183 249 189" stroke="#555" strokeWidth="1.8" fill="none" />
                  <circle className="bulb-glow-core" cx="245" cy="188" r="11" fill="var(--lamp-glow, #ffe194)" filter="url(#bulbGlowFilter)" opacity="0" />
                </g>
              </g>

              {/* Pull String System */}
              <g className="pull-cord-system">
                <path ref={elasticCordRef} className="elastic-cord-path" d="M 245 212 L 245 300" stroke="#e8bb54" strokeWidth="2.6" strokeLinecap="round" />
                <g ref={cordBeadRef} className="cord-bead-group" onClick={handlePullCord}>
                  <circle className="bead-aura" cx="0" cy="0" r="16" fill="var(--lamp-accent)" opacity="0" />
                  <path className="bead-shape" d="M -4 -8 L 4 -8 L 7 6 C 7 10, -7 10, -7 6 Z" fill="url(#brassJoint)" stroke="#7a5513" strokeWidth="0.8" />
                  <ellipse cx="2" cy="0" rx="2" ry="4" fill="#fff" opacity="0.5" />
                  <circle className="cord-hit-area" cx="0" cy="0" r="32" fill="transparent" />
                </g>
              </g>
            </svg>

            {/* Tooltip to pull cord */}
            <div className="cord-tooltip" onClick={handlePullCord} style={{ cursor: "pointer" }}>
              <span>{isOn ? "Kéo dây để tắt đèn" : "Kéo dây để bật đèn"}</span>
              <div className="tooltip-arrow" />
            </div>
          </div>
        </div>

        {/* ─── 2. Login Form Stage (Light Illuminated Card) ─── */}
        <div ref={formStageRef} className="form-stage">
          <div ref={cardRef} className="login-card">
            <div className="card-header">
              <h1 className="card-title">
                {activeTab === "signin" ? "Đăng nhập LivingDocs" : "Tạo tài khoản mới"}
              </h1>
              <p className="card-subtitle">
                {activeTab === "signin"
                  ? "Cổng tài liệu kỹ thuật đồng bộ mã nguồn GitHub."
                  : "Đăng ký thành viên tham gia quy trình thẩm định code."}
              </p>
            </div>

            {/* Auth Tabs */}
            <div className="auth-tabs" data-active={activeTab}>
              <button
                type="button"
                className={`auth-tab ${activeTab === "signin" ? "active" : ""}`}
                onClick={() => setActiveTab("signin")}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`auth-tab ${activeTab === "register" ? "active" : ""}`}
                onClick={() => setActiveTab("register")}
              >
                Đăng ký
              </button>
              <div className="tab-slider" />
            </div>

            {/* Error Message */}
            {formError && <div className="auth-error-box">{formError}</div>}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="form-group">
                <label htmlFor="userField">Email doanh nghiệp</label>
                <div className="input-wrapper">
                  <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="email"
                    id="userField"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="passField">Mật khẩu</label>
                  <Link href="/quen-mat-khau" className="forgot-link">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="input-wrapper">
                  <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="passField"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    
                    required
                  />
                  <button
                    type="button"
                    className="eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="options-row">
                <label className="custom-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkbox-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="checkbox-label">Ghi nhớ phiên đăng nhập</span>
                </label>
              </div>

              <button type="submit" className="submit-btn" disabled={pending}>
                <span className="btn-glow-layer" />
                <span className="btn-content">
                  {pending ? (
                    <div className="btn-spinner" />
                  ) : (
                    <>
                      <span>{activeTab === "signin" ? "Đăng nhập" : "Đăng ký tài khoản"}</span>
                      <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </span>
              </button>



              <div className="social-row">
                <button
                  type="button"
                  className="social-btn"
                  onClick={handleGithubAuth}
                  title="Đăng nhập bằng tài khoản GitHub"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
