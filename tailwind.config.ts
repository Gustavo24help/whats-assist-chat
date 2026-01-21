import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // 24Help Brand Colors
        brand: {
          green: "hsl(160 100% 15%)",
          red: "hsl(8 87% 54%)",
          coral: "hsl(0 100% 70%)",
          yellow: "hsl(45 89% 48%)",
        },
        highlight: {
          green: "hsl(160 100% 15%)",
          yellow: "hsl(45 89% 48%)",
          coral: "hsl(0 100% 70%)",
          red: "hsl(8 87% 54%)",
        },
        success: {
          DEFAULT: "hsl(160 100% 15%)",
          light: "hsl(160 60% 90%)",
          foreground: "hsl(0 0% 100%)",
        },
        danger: {
          DEFAULT: "hsl(8 87% 54%)",
          light: "hsl(8 87% 95%)",
          foreground: "hsl(0 0% 100%)",
        },
        neutral: {
          DEFAULT: "hsl(220 10% 50%)",
          light: "hsl(220 10% 95%)",
          foreground: "hsl(220 10% 20%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "notification-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 hsl(var(--destructive) / 0.4)",
          },
          "50%": {
            boxShadow: "0 0 20px 5px hsl(var(--destructive) / 0.4)",
          },
        },
        "notification-ring": {
          "0%, 100%": {
            transform: "rotate(0deg)",
          },
          "10%, 30%": {
            transform: "rotate(-15deg)",
          },
          "20%": {
            transform: "rotate(15deg)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "notification-glow": "notification-glow 2s ease-in-out infinite",
        "notification-ring": "notification-ring 1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
