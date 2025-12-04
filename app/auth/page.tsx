"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DarkModeToggle from "@/components/DarkModeToggle";
import PoweredBySEND from "@/components/PoweredBySEND";

type AuthMode = "login" | "signup" | "verify";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        // For login: check if user exists and redirect immediately
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "User doesn't exist. Please sign up.");
          return;
        }

        // User exists - store session and redirect
        setMessage("Login successful! Redirecting...");
        localStorage.setItem("user", JSON.stringify(data.user));
        setTimeout(() => router.push("/"), 1500);
      } else {
        // For signup: send confirmation code
        const response = await fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!data.success) {
          // If user already exists, switch to login mode
          if (data.userExists || data.error?.includes("already exists")) {
            setError("User already exists. Please login.");
            // Switch to login mode after a short delay
            setTimeout(() => {
              setMode("login");
              setError("");
              setMessage("Please login with your email.");
            }, 2000);
          } else {
            setError(data.error || "Failed to send code");
          }
          return;
        }

        setMessage(data.message || "Confirmation code sent to your email");
        setCodeSent(true);
      }
    } catch (err: any) {
      setError("Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      // Sign up flow only (login doesn't need code verification)
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          referralCode: referralCode || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to create account");
        return;
      }

      setMessage("Account created successfully! Redirecting...");
      // Store user in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-4 relative">
      {/* Header with Dark Mode Toggle */}
      <div className="absolute top-4 left-4 flex items-center gap-4 z-10">
        <DarkModeToggle fixed={false} />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              {/* White logo for light mode */}
              <img 
                src="/whitelogo.png" 
                alt="FlipPay" 
                className="h-16 w-auto dark:hidden"
              />
              {/* Regular logo for dark mode */}
              <img 
                src="/logo.png" 
                alt="FlipPay" 
                className="h-16 w-auto hidden dark:block"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {mode === "login"
                ? "Enter your email to login"
                : "Sign up with your email and optional referral code"}
            </p>
          </div>

          {/* Error/Message Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
            </div>
          )}

          {/* Email Input */}
          {!codeSent && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                  disabled={loading}
                />
              </div>

              {/* Referral Code (only for signup) */}
              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Referral Code <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter referral code"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={loading}
                  />
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading 
                  ? "Processing..." 
                  : mode === "login" 
                    ? "Login" 
                    : "Send Confirmation Code"}
              </button>
            </div>
          )}

          {/* Code Verification */}
          {codeSent && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Confirmation Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 text-center text-2xl tracking-widest focus:ring-2 focus:ring-primary focus:border-primary"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                  Enter the 6-digit code sent to {email}
                </p>
              </div>

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : mode === "login" ? "Login" : "Sign Up"}
              </button>

              <button
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setError("");
                  setMessage("");
                }}
                className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Change Email
              </button>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setCodeSent(false);
                  setCode("");
                  setEmail("");
                  setReferralCode("");
                  setError("");
                  setMessage("");
                }}
                className="text-primary font-medium hover:opacity-80"
              >
                {mode === "login" ? "Sign Up" : "Login"}
              </button>
            </p>
          </div>
          
          {/* Powered by SEND */}
          <PoweredBySEND />
        </div>
      </div>
    </div>
  );
}

