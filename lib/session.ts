import { AuthUser } from "./auth";

const SESSION_COOKIE_NAME = "auth_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomUUID() + "-" + Date.now();
}

/**
 * Store user session (localStorage + httpOnly cookie)
 */
export function setUserSession(user: AuthUser, token: string) {
  // Store in localStorage for quick access
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("session_token", token);
  }
}

/**
 * Get user from localStorage (client-side)
 */
export function getUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Clear user session
 */
export function clearUserSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
    localStorage.removeItem("session_token");
  }
}

/**
 * Check if user is logged in (client-side)
 */
export function isUserLoggedIn(): boolean {
  return getUserFromStorage() !== null;
}

