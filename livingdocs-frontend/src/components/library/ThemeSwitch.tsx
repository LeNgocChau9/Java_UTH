"use client";

import React, { useState, useRef } from "react";
import { flushSync } from "react-dom";

export interface ThemeSwitchProps {
  theme: "light" | "dark";
  onChange: (next: "light" | "dark") => void;
  className?: string;
}

interface SplashEffect {
  id: number;
  x: number;
  y: number;
  targetDark: boolean;
}

export default function ThemeSwitch({
  theme,
  onChange,
  className = "",
}: ThemeSwitchProps) {
  const isDark = theme === "dark";
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dipping, setDipping] = useState(false);
  const [splash, setSplash] = useState<SplashEffect | null>(null);

  const handleToggle = () => {
    const nextTheme: "light" | "dark" = isDark ? "light" : "dark";
    const rect = btnRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth - 60;
    const cy = rect ? rect.top + rect.height / 2 : 36;

    // 1. Trigger droplet splash & concentric ripples
    const effectId = Date.now();
    setSplash({ id: effectId, x: cx, y: cy, targetDark: nextTheme === "dark" });

    // Impact spring dip right when droplet hits
    setTimeout(() => {
      setDipping(true);
      setTimeout(() => setDipping(false), 320);

      // 2. Smooth expanding circular flood reveal across the full page
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      };

      const maxRadius = Math.hypot(
        Math.max(cx, window.innerWidth - cx),
        Math.max(cy, window.innerHeight - cy)
      );

      if (typeof doc.startViewTransition === "function") {
        const transition = doc.startViewTransition(() => {
          flushSync(() => {
            onChange(nextTheme);
          });
        });

        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${cx}px ${cy}px)`,
                  `circle(${maxRadius}px at ${cx}px ${cy}px)`,
                ],
              },
              {
                duration: 620,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              }
            );
          })
          .catch(() => {});
      } else {
        onChange(nextTheme);
      }
    }, 150);

    // Clear overlay after animation settles
    setTimeout(() => {
      setSplash((prev) => (prev?.id === effectId ? null : prev));
    }, 820);
  };

  return (
    <>
      {/* Scoped View-Transition & PinUI Droplet Keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          ::view-transition-old(root),
          ::view-transition-new(root) {
            animation: none;
            mix-blend-mode: normal;
          }
          ::view-transition-new(root) {
            z-index: 9999;
          }
          @keyframes pin-droplet-fall {
            0% { transform: translate(-50%, -44px) scale(0.75, 1.35); opacity: 0.95; }
            72% { transform: translate(-50%, 0px) scale(0.85, 1.2); opacity: 1; }
            100% { transform: translate(-50%, 2px) scale(1.6, 0.35); opacity: 0; }
          }
          @keyframes pin-ripple-out {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(4.2); opacity: 0; }
          }
        `,
        }}
      />

      {/* Droplet + Concentric Ripples Overlay */}
      {splash && (
        <div className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden">
          {/* Falling Tear Droplet */}
          <div
            style={{
              left: splash.x,
              top: splash.y,
              width: 14,
              height: 18,
              borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
              backgroundColor: splash.targetDark ? "#141416" : "#FFFCF5",
              border: `1.5px solid ${splash.targetDark ? "#E8523B" : "#211D16"}`,
              animation: "pin-droplet-fall 210ms cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards",
            }}
            className="absolute shadow-md"
          />
          {/* Concentric Ripple 1 */}
          <div
            style={{
              left: splash.x,
              top: splash.y,
              width: 36,
              height: 36,
              borderRadius: "9999px",
              border: `2px solid ${splash.targetDark ? "#E8523B" : "#F59E0B"}`,
              animation: "pin-ripple-out 560ms cubic-bezier(0.22, 1, 0.36, 1) 140ms forwards",
              opacity: 0,
            }}
            className="absolute"
          />
          {/* Concentric Ripple 2 */}
          <div
            style={{
              left: splash.x,
              top: splash.y,
              width: 36,
              height: 36,
              borderRadius: "9999px",
              border: `1.5px solid ${splash.targetDark ? "rgba(255,255,255,0.45)" : "rgba(33,29,22,0.45)"}`,
              animation: "pin-ripple-out 660ms cubic-bezier(0.22, 1, 0.36, 1) 210ms forwards",
              opacity: 0,
            }}
            className="absolute"
          />
        </div>
      )}

      {/* Tactile Theme Toggle Button with Hover-to-White Icon */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        aria-label={
          isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
        }
        title={isDark ? "Chuyển sang sáng" : "Chuyển sang tối"}
        className={`group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ${
          isDark
            ? "text-[#A1A1AA] hover:bg-white/15 hover:text-white"
            : "text-[#211D16] hover:bg-[#211D16] hover:text-white"
        } ${className}`}
        style={{
          transform: dipping ? "translateY(3px) scale(0.9)" : undefined,
        }}
      >
        {/* Sun Icon (shown in Dark mode to switch to Light) */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute transition-all duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(-90deg) scale(0.6)",
          }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>

        {/* Crescent / Half-Contrast Moon Icon (shown in Light mode to switch to Dark) */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute transition-all duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark
              ? "rotate(90deg) scale(0.6)"
              : "rotate(0deg) scale(1)",
          }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
        </svg>
      </button>
    </>
  );
}
