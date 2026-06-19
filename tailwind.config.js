/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan all source files for class names
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./app/(app)/**/*.{js,jsx,ts,tsx}",
    "./app/(auth)/**/*.{js,jsx,ts,tsx}",
    "./app/manage/**/*.{js,jsx,ts,tsx}",
    "./app/management-v4-core/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ── Brand Colors ──────────────────────────────────────────────
      colors: {
        // Primary blue (buttons, links, active states)
        primary: {
          DEFAULT: "#0056D2",
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#0056D2",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        // Success green
        success: {
          DEFAULT: "#107C10",
          light:   "#DCFCE7",
          50:  "#F0FDF4",
          100: "#DCFCE7",
          500: "#22C55E",
          600: "#107C10",
          700: "#15803D",
        },
        // Warning orange
        warning: {
          DEFAULT: "#F37021",
          light:   "#FFF7ED",
          50:  "#FFF7ED",
          100: "#FFEDD5",
          500: "#F97316",
          600: "#F37021",
          700: "#C2410C",
        },
        // Danger/error red
        danger: {
          DEFAULT: "#DC2626",
          50:  "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        // Slate (dark text / headings)
        slate: {
          DEFAULT: "#2C3E50",
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        // App background
        background: {
          DEFAULT: "#F2F2F2",
          dark:    "#0F172A",
          card:    "#FFFFFF",
          input:   "#F8FAFC",
        },
        // Gold / premium accent
        gold: {
          DEFAULT: "#C5A059",
          light:   "#F5E8D0",
          50:  "#FFFBEB",
          100: "#FEF3C7",
          400: "#FBBF24",
          500: "#C5A059",
          600: "#8A6E36",
          700: "#92400E",
        },
        // Aijalon brand (identity verification screens)
        aijalon: {
          DEFAULT: "#8B5E3C",
          light:   "#F5EDE4",
          dark:    "#5C3D24",
        },
        // Muted / neutral
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#9CA3AF",
        },
      },

      // ── Border Radius ──────────────────────────────────────────────
      borderRadius: {
        "2xl":  "16px",
        "3xl":  "24px",
        "4xl":  "32px",
        "5xl":  "40px",
        "full": "9999px",
      },

      // ── Box Shadow ──────────────────────────────────────────────────
      boxShadow: {
        card:     "0 2px 8px rgba(0,0,0,0.08)",
        elevated: "0 8px 24px rgba(0,0,0,0.12)",
        primary:  "0 4px 14px rgba(0,86,210,0.35)",
        success:  "0 4px 14px rgba(16,124,16,0.30)",
        gold:     "0 4px 14px rgba(197,160,89,0.35)",
      },

      // ── Font Size ─────────────────────────────────────────────────
      fontSize: {
        "2xs": "10px",
        xs:    "12px",
        sm:    "14px",
        base:  "16px",
        lg:    "18px",
        xl:    "20px",
        "2xl": "24px",
        "3xl": "30px",
        "4xl": "36px",
        "5xl": "48px",
        "6xl": "60px",
      },

      // ── Spacing ───────────────────────────────────────────────────
      spacing: {
        "0.5": "2px",
        "1":   "4px",
        "1.5": "6px",
        "2":   "8px",
        "2.5": "10px",
        "3":   "12px",
        "3.5": "14px",
        "4":   "16px",
        "5":   "20px",
        "6":   "24px",
        "7":   "28px",
        "8":   "32px",
        "9":   "36px",
        "10":  "40px",
        "11":  "44px",
        "12":  "48px",
        "14":  "56px",
        "16":  "64px",
        "18":  "72px",
        "20":  "80px",
        "24":  "96px",
        "28":  "112px",
        "32":  "128px",
        "36":  "144px",
        "40":  "160px",
        "44":  "176px",
        "48":  "192px",
        "52":  "208px",
        "56":  "224px",
        "60":  "240px",
        "64":  "256px",
        "72":  "288px",
        "80":  "320px",
        "96":  "384px",
      },

      // ── Opacity ────────────────────────────────────────────────────
      opacity: {
        "0":   "0",
        "5":   "0.05",
        "10":  "0.10",
        "15":  "0.15",
        "20":  "0.20",
        "25":  "0.25",
        "30":  "0.30",
        "40":  "0.40",
        "50":  "0.50",
        "60":  "0.60",
        "70":  "0.70",
        "75":  "0.75",
        "80":  "0.80",
        "90":  "0.90",
        "95":  "0.95",
        "100": "1",
      },
    },
  },
  plugins: [],
};
