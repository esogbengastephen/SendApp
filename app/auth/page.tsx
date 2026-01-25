"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DarkModeToggle from "@/components/DarkModeToggle";
import PoweredBySEND from "@/components/PoweredBySEND";
import { authenticateWithPasskey, isPasskeySupported } from "@/lib/passkey";

type AuthMode = "login" | "signup" | "verify";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState<string | null>(null);
  const [passkeyUser, setPasskeyUser] = useState<any>(null);
  const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);

  // Load last used email on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastEmail = localStorage.getItem("last_email");
      if (lastEmail && mode === "login") {
        setEmail(lastEmail);
        // Auto-check for passkey if email exists
        checkPasskeyForEmail(lastEmail);
      }
    }
  }, [mode]);

  // Check for passkey when email changes (debounced)
  useEffect(() => {
    if (!email || mode !== "login") return;

    const timeoutId = setTimeout(() => {
      if (email.includes("@")) {
        checkPasskeyForEmail(email);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [email, mode]);

  // Function to check if user has passkey
  const checkPasskeyForEmail = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return;

    setCheckingPasskey(true);
    try {
      const passkeyCheckResponse = await fetch("/api/auth/passkey-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });

      const passkeyData = await passkeyCheckResponse.json();

      if (passkeyData.success && passkeyData.hasPasskey) {
        setHasPasskey(true);
        setPasskeyUserId(passkeyData.userId);
        setPasskeyUser(passkeyData.user);
      } else {
        setHasPasskey(false);
        setPasskeyUserId(null);
        setPasskeyUser(null);
      }
    } catch (err) {
      // Silently fail - user can still login with email
      setHasPasskey(false);
      setPasskeyUserId(null);
      setPasskeyUser(null);
    } finally {
      setCheckingPasskey(false);
    }
  };

  const handleSendCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    setHasPasskey(false);
    setPasskeyUserId(null);
    setPasskeyUser(null);

    try {
      if (mode === "login") {
        // First check if user has passkey
        const passkeyCheckResponse = await fetch("/api/auth/passkey-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const passkeyData = await passkeyCheckResponse.json();

        if (passkeyData.success && passkeyData.hasPasskey) {
          // User has passkey - show passkey option
          setHasPasskey(true);
          setPasskeyUserId(passkeyData.userId);
          setPasskeyUser(passkeyData.user);
          setMessage("Passkey detected! You can sign in with passkey or continue with email.");
          setLoading(false);
          return;
        }

        // User doesn't have passkey - proceed with email login
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

        // User exists - store session and redirect to passkey setup
        setMessage("Login successful! Redirecting...");
        localStorage.setItem("user", JSON.stringify(data.user));
        // Store email for next time
        localStorage.setItem("last_email", email);
        setTimeout(() => router.push("/passkey-setup"), 1500);
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
        // Set initial cooldown when code is first sent
        setResendCooldown(60);
      }
    } catch (err: any) {
      setError("Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return; // Prevent spam during cooldown
    
    setError("");
    setMessage("");
    setResending(true);

    try {
      // Use recovery endpoint if in recovery mode, otherwise use regular send-code
      const endpoint = recoveryMode ? "/api/auth/recover-passkey" : "/api/auth/send-code";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to resend code");
        return;
      }

      setMessage(recoveryMode ? "Recovery code resent to your email" : "Confirmation code resent to your email");
      
      // Set 60 second cooldown
      setResendCooldown(60);
    } catch (err: any) {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleVerifyCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      // Sign up flow only (login doesn't need code verification)
      // Phone number is required for signup
      if (mode === "signup" && !phoneNumber) {
        setError("Phone number is required");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          referralCode: referralCode || undefined,
          phoneNumber: mode === "signup" ? phoneNumber : undefined,
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
      // Store email for next time
      localStorage.setItem("last_email", email);
      
      // New users must set up passkey before accessing dashboard
      setTimeout(() => router.push("/passkey-setup"), 1500);
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!passkeyUserId || !isPasskeySupported()) {
      setError("Passkey authentication is not available");
      return;
    }

    setAuthenticatingPasskey(true);
    setError("");
    setMessage("");

    try {
      const authResult = await authenticateWithPasskey(passkeyUserId);

      if (!authResult.success) {
        // Check if passkey needs to be recreated (domain mismatch)
        if ((authResult as any).requiresRecreate) {
          setError(
            authResult.error || 
            "Your passkey was created on a different domain. Please recreate it on flippay.app by going to Settings → Security."
          );
          // Optionally redirect to passkey setup
          setTimeout(() => {
            if (confirm("Would you like to recreate your passkey now?")) {
              router.push("/passkey-setup");
            }
          }, 2000);
        } else {
          setError(authResult.error || "Passkey authentication failed");
        }
        return;
      }

      // Authentication successful
      setMessage("Passkey authentication successful! Redirecting...");
      localStorage.setItem("user", JSON.stringify(passkeyUser));
      // Store email for next time
      if (passkeyUser?.email) {
        localStorage.setItem("last_email", passkeyUser.email);
      }
      
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      console.error("Passkey login error:", err);
      setError(err.message || "Failed to authenticate with passkey");
    } finally {
      setAuthenticatingPasskey(false);
    }
  };

  const handleRecoverPasskey = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to send recovery code");
        return;
      }

      setMessage(data.message || "Recovery code sent to your email");
      setRecoveryCodeSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError("Failed to send recovery code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover-passkey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Invalid recovery code");
        return;
      }

      // Store user and redirect to passkey setup with recovery flag
      setMessage("Recovery verified! Redirecting to create new passkey...");
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("last_email", email);
      
      setTimeout(() => router.push("/passkey-setup?recovery=true"), 1500);
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Don't reset passkey state immediately - let debounced check handle it
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                  disabled={loading || authenticatingPasskey}
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

              {/* Passkey Login Button (only for login mode when passkey detected) */}
              {mode === "login" && hasPasskey && isPasskeySupported() && !recoveryMode && (
                <button
                  onClick={handlePasskeyLogin}
                  disabled={authenticatingPasskey || checkingPasskey}
                  className="w-full bg-secondary text-primary font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-primary"
                >
                  {authenticatingPasskey ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined">fingerprint</span>
                      <span>Sign in with Passkey</span>
                    </>
                  )}
                </button>
              )}

              {/* Forgot Passkey Link - only show in login mode when passkey is detected */}
              {mode === "login" && hasPasskey && !recoveryMode && (
                <button
                  onClick={() => {
                    setRecoveryMode(true);
                    setError("");
                    setMessage("");
                    setHasPasskey(false);
                  }}
                  className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors underline mt-2"
                >
                  Forgot Passkey? Recover Account
                </button>
              )}

              {/* Show checking indicator when verifying passkey */}
              {mode === "login" && checkingPasskey && email && !recoveryMode && (
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  Checking for passkey...
                </div>
              )}

              {/* Recovery Mode UI */}
              {recoveryMode && !recoveryCodeSent && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Enter your email to receive a recovery code. After verification, you can create a new passkey.
                  </p>
                </div>
              )}

              {recoveryMode && recoveryCodeSent && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Recovery Code
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
                    <div className="mt-3 text-center">
                      <button
                        type="button"
                        onClick={handleRecoverPasskey}
                        disabled={resending || resendCooldown > 0 || loading}
                        className="text-sm text-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity underline"
                      >
                        {resending 
                          ? "Resending..." 
                          : resendCooldown > 0 
                            ? `Resend code in ${resendCooldown}s` 
                            : "Resend Code"}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyRecoveryCode}
                    disabled={loading || code.length !== 6}
                    className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Verifying..." : "Verify & Recover Account"}
                  </button>

                  <button
                    onClick={() => {
                      setRecoveryMode(false);
                      setRecoveryCodeSent(false);
                      setCode("");
                      setError("");
                      setMessage("");
                      setResendCooldown(0);
                    }}
                    className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Cancel Recovery
                  </button>
                </div>
              )}

              {/* Divider */}
              {mode === "login" && hasPasskey && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-slate-300 dark:border-slate-600"></div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">OR</span>
                  <div className="flex-1 border-t border-slate-300 dark:border-slate-600"></div>
                </div>
              )}

              {!recoveryMode && !recoveryCodeSent && (
                <button
                  onClick={handleSendCode}
                  disabled={loading || !email || authenticatingPasskey}
                  className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading 
                    ? "Processing..." 
                    : mode === "login" 
                      ? hasPasskey 
                        ? "Continue with Email"
                        : "Login"
                      : "Send Confirmation Code"}
                </button>
              )}

              {recoveryMode && !recoveryCodeSent && (
                <button
                  onClick={handleRecoverPasskey}
                  disabled={loading || !email}
                  className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Recovery Code"}
                </button>
              )}
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
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending || resendCooldown > 0 || loading}
                    className="text-sm text-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity underline"
                  >
                    {resending 
                      ? "Resending..." 
                      : resendCooldown > 0 
                        ? `Resend code in ${resendCooldown}s` 
                        : "Resend Code"}
                  </button>
                </div>
              </div>

              {/* Phone Number Input - Only for Signup */}
              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setPhoneNumber(value);
                    }}
                    placeholder="08012345678"
                    maxLength={11}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Enter your 11-digit Nigerian phone number (e.g., 08012345678)
                  </p>
                  {phoneNumber && phoneNumber.length < 11 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      Phone number must be 11 digits
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6 || (mode === "signup" && (!phoneNumber || phoneNumber.length < 11))}
                className="w-full bg-primary text-slate-900 font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : mode === "login" ? "Login" : "Sign Up"}
              </button>

              <button
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setPhoneNumber("");
                  setError("");
                  setMessage("");
                  setResendCooldown(0); // Reset cooldown when changing email
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

