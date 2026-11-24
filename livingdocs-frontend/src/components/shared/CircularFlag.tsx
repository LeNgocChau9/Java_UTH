"use client";

import React from "react";
import type { LanguageCode } from "@/context/LanguageContext";

interface CircularFlagProps {
  code: LanguageCode | "VN";
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function CircularFlag({
  code,
  size = 20,
  className = "",
  style = {},
  title,
}: CircularFlagProps) {
  const mergedStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    display: "inline-block",
    verticalAlign: "middle",
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.12)",
    ...style,
  };

  switch (code) {
    case "vi":
    case "VN":
      // Lá cờ Việt Nam Hình tròn (Nền đỏ #DA251D, ngôi sao vàng 5 cánh #FFFF00 tỉ lệ chuẩn)
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Việt Nam"}
        >
          {title && <title>{title}</title>}
          <circle cx="18" cy="18" r="18" fill="#DA251D" />
          <polygon
            points="18,8.2 20.35,15.42 27.95,15.42 21.8,19.89 24.15,27.11 18,22.64 11.85,27.11 14.2,19.89 8.05,15.42 15.65,15.42"
            fill="#FFFF00"
          />
        </svg>
      );

    case "en-US":
      // Cờ Hoa Kỳ (Tiếng Mỹ) - Hình tròn
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Hoa Kỳ"}
        >
          {title && <title>{title}</title>}
          <defs>
            <clipPath id="circle-clip-us">
              <circle cx="18" cy="18" r="18" />
            </clipPath>
          </defs>
          <g clipPath="url(#circle-clip-us)">
            <rect width="36" height="36" fill="#FFFFFF" />
            {/* 13 sọc đỏ trắng xen kẽ */}
            <rect y="0" width="36" height="2.77" fill="#B22234" />
            <rect y="5.54" width="36" height="2.77" fill="#B22234" />
            <rect y="11.08" width="36" height="2.77" fill="#B22234" />
            <rect y="16.62" width="36" height="2.77" fill="#B22234" />
            <rect y="22.15" width="36" height="2.77" fill="#B22234" />
            <rect y="27.69" width="36" height="2.77" fill="#B22234" />
            <rect y="33.23" width="36" height="2.77" fill="#B22234" />
            {/* Canton xanh và các ngôi sao */}
            <rect width="16" height="19.4" fill="#0A3161" />
            <circle cx="4" cy="4" r="1" fill="#FFFFFF" />
            <circle cx="8" cy="4" r="1" fill="#FFFFFF" />
            <circle cx="12" cy="4" r="1" fill="#FFFFFF" />
            <circle cx="6" cy="7.5" r="1" fill="#FFFFFF" />
            <circle cx="10" cy="7.5" r="1" fill="#FFFFFF" />
            <circle cx="4" cy="11" r="1" fill="#FFFFFF" />
            <circle cx="8" cy="11" r="1" fill="#FFFFFF" />
            <circle cx="12" cy="11" r="1" fill="#FFFFFF" />
            <circle cx="6" cy="14.5" r="1" fill="#FFFFFF" />
            <circle cx="10" cy="14.5" r="1" fill="#FFFFFF" />
          </g>
        </svg>
      );

    case "en-GB":
      // Cờ Vương quốc Anh (Tiếng Anh - UK) - Union Jack Hình tròn
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Vương quốc Anh"}
        >
          {title && <title>{title}</title>}
          <defs>
            <clipPath id="circle-clip-uk">
              <circle cx="18" cy="18" r="18" />
            </clipPath>
          </defs>
          <g clipPath="url(#circle-clip-uk)">
            <rect width="36" height="36" fill="#012169" />
            {/* Chữ thập chéo trắng & đỏ */}
            <line x1="0" y1="0" x2="36" y2="36" stroke="#FFFFFF" strokeWidth="6" />
            <line x1="0" y1="36" x2="36" y2="0" stroke="#FFFFFF" strokeWidth="6" />
            <line x1="0" y1="0" x2="36" y2="36" stroke="#C8102E" strokeWidth="2.5" />
            <line x1="0" y1="36" x2="36" y2="0" stroke="#C8102E" strokeWidth="2.5" />
            {/* Chữ thập thẳng trắng & đỏ */}
            <rect x="13.5" y="0" width="9" height="36" fill="#FFFFFF" />
            <rect x="0" y="13.5" width="36" height="9" fill="#FFFFFF" />
            <rect x="15" y="0" width="6" height="36" fill="#C8102E" />
            <rect x="0" y="15" width="36" height="6" fill="#C8102E" />
          </g>
        </svg>
      );

    case "zh":
      // Cờ Trung Quốc (Tiếng Trung) - Hình tròn
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Trung Quốc"}
        >
          {title && <title>{title}</title>}
          <circle cx="18" cy="18" r="18" fill="#DE2910" />
          {/* Ngôi sao lớn */}
          <polygon
            points="9,6 10.2,9.6 14,9.6 10.9,11.9 12.1,15.5 9,13.2 5.9,15.5 7.1,11.9 4,9.6 7.8,9.6"
            fill="#FFDE00"
          />
          {/* 4 ngôi sao nhỏ */}
          <polygon points="16,5 16.5,6.5 18,6.5 16.8,7.5 17.2,9 16,8 14.8,9 15.2,7.5 14,6.5 15.5,6.5" fill="#FFDE00" transform="scale(0.8) translate(5, 1)" />
          <polygon points="19,8 19.5,9.5 21,9.5 19.8,10.5 20.2,12 19,11 17.8,12 18.2,10.5 17,9.5 18.5,9.5" fill="#FFDE00" transform="scale(0.75) translate(8, 2)" />
          <polygon points="19,13 19.5,14.5 21,14.5 19.8,15.5 20.2,17 19,16 17.8,17 18.2,15.5 17,14.5 18.5,14.5" fill="#FFDE00" transform="scale(0.75) translate(8, 4)" />
          <polygon points="16,16 16.5,17.5 18,17.5 16.8,18.5 17.2,20 16,19 14.8,20 15.2,18.5 14,17.5 15.5,17.5" fill="#FFDE00" transform="scale(0.8) translate(5, 5)" />
        </svg>
      );

    case "ja":
      // Cờ Nhật Bản (Tiếng Nhật) - Hinomaru Hình tròn
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Nhật Bản"}
        >
          {title && <title>{title}</title>}
          <circle cx="18" cy="18" r="18" fill="#FFFFFF" />
          <circle cx="18" cy="18" r="7.5" fill="#BC002D" />
        </svg>
      );

    case "hi":
      // Cờ Ấn Độ (Tiếng Ấn Độ) - Ba dải màu ngang & Bánh xe Ashoka Chakra
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Ấn Độ"}
        >
          {title && <title>{title}</title>}
          <defs>
            <clipPath id="circle-clip-in">
              <circle cx="18" cy="18" r="18" />
            </clipPath>
          </defs>
          <g clipPath="url(#circle-clip-in)">
            <rect y="0" width="36" height="12" fill="#FF9933" />
            <rect y="12" width="36" height="12" fill="#FFFFFF" />
            <rect y="24" width="36" height="12" fill="#138808" />
            {/* Ashoka Chakra */}
            <circle cx="18" cy="18" r="4.2" stroke="#000080" strokeWidth="1" fill="none" />
            <circle cx="18" cy="18" r="1" fill="#000080" />
            <line x1="18" y1="14" x2="18" y2="22" stroke="#000080" strokeWidth="0.75" />
            <line x1="14" y1="18" x2="22" y2="18" stroke="#000080" strokeWidth="0.75" />
            <line x1="15.2" y1="15.2" x2="20.8" y2="20.8" stroke="#000080" strokeWidth="0.75" />
            <line x1="15.2" y1="20.8" x2="20.8" y2="15.2" stroke="#000080" strokeWidth="0.75" />
          </g>
        </svg>
      );

    case "it":
      // Cờ Ý (Tiếng Ý) - Ba dải màu dọc Xanh - Trắng - Đỏ Hình tròn
      return (
        <svg
          viewBox="0 0 36 36"
          style={mergedStyle}
          className={className}
          role="img"
          aria-label={title || "Cờ Ý"}
        >
          {title && <title>{title}</title>}
          <defs>
            <clipPath id="circle-clip-it">
              <circle cx="18" cy="18" r="18" />
            </clipPath>
          </defs>
          <g clipPath="url(#circle-clip-it)">
            <rect x="0" width="12" height="36" fill="#009246" />
            <rect x="12" width="12" height="36" fill="#FFFFFF" />
            <rect x="24" width="12" height="36" fill="#CE2B37" />
          </g>
        </svg>
      );

    default:
      return (
        <span
          style={{
            ...mergedStyle,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#DA251D",
            color: "#FFFF00",
            fontSize: size * 0.5,
            fontWeight: 800,
          }}
        >
          VN
        </span>
      );
  }
}
