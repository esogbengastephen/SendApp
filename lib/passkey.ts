/**
 * Passkey (WebAuthn) management library
 * Handles passkey creation, authentication, and recovery
 */

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  rawId: string;
}

export interface PasskeyChallenge {
  challenge: string;
  userId: string;
}

/**
 * Generate a random challenge for passkey operations
 */
export function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Convert base64url to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64url
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Create a new passkey for the user
 * This will trigger wallet creation automatically
 */
export async function createPasskey(
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; credential?: PasskeyCredential; error?: string }> {
  try {
    // Get challenge from server
    const challengeResponse = await fetch("/api/passkey/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: userEmail }),
    });

    const challengeData = await challengeResponse.json();
    if (!challengeData.success || !challengeData.challenge) {
      return { success: false, error: "Failed to get challenge" };
    }

    const challenge = base64UrlToArrayBuffer(challengeData.challenge);

    // Create credential
    const publicKeyCredential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "SendApp",
          id: window.location.hostname,
        },
        user: {
          id: base64UrlToArrayBuffer(userId),
          name: userEmail,
          displayName: userName || userEmail,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Platform authenticator (device)
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "direct",
      },
    }) as PublicKeyCredential;

    if (!publicKeyCredential) {
      return { success: false, error: "Failed to create passkey" };
    }

    const response = publicKeyCredential.response as AuthenticatorAttestationResponse;
    const credentialId = arrayBufferToBase64Url(publicKeyCredential.rawId);
    const publicKey = arrayBufferToBase64Url(response.getPublicKey()!);

    return {
      success: true,
      credential: {
        id: publicKeyCredential.id,
        publicKey,
        rawId: credentialId,
      },
    };
  } catch (error: any) {
    console.error("Error creating passkey:", error);
    return {
      success: false,
      error: error.message || "Failed to create passkey",
    };
  }
}

/**
 * Authenticate with passkey
 */
export async function authenticateWithPasskey(
  userId: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  try {
    // Get challenge from server
    console.log("[Passkey] Requesting challenge for userId:", userId);
    const challengeResponse = await fetch("/api/passkey/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!challengeResponse.ok) {
      const errorData = await challengeResponse.json().catch(() => ({}));
      console.error("[Passkey] Challenge API error:", challengeResponse.status, errorData);
      return { 
        success: false, 
        error: errorData.error || `Failed to get challenge (${challengeResponse.status})` 
      };
    }

    const challengeData = await challengeResponse.json();
    if (!challengeData.success || !challengeData.challenge) {
      console.error("[Passkey] Invalid challenge response:", challengeData);
      return { 
        success: false, 
        error: challengeData.error || "Failed to get challenge" 
      };
    }
    
    console.log("[Passkey] Challenge received successfully");

    const challenge = base64UrlToArrayBuffer(challengeData.challenge);

    // Get credential ID from server
    const credentialResponse = await fetch(`/api/passkey/credential/${userId}`);
    
    if (!credentialResponse.ok) {
      console.error("[Passkey] Credential API error:", credentialResponse.status);
      const errorData = await credentialResponse.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || `Failed to get passkey credential (${credentialResponse.status})` 
      };
    }
    
    const credentialData = await credentialResponse.json();
    if (!credentialData.success || !credentialData.credentialId) {
      console.error("[Passkey] No credential found:", credentialData);
      return { 
        success: false, 
        error: credentialData.error || "No passkey found for user. Please set up a passkey first." 
      };
    }

    const credentialId = base64UrlToArrayBuffer(credentialData.credentialId);

    // Authenticate
    console.log("[Passkey] Requesting authentication from browser...");
    let assertion: PublicKeyCredential;
    
    try {
      assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
            },
          ],
          timeout: 60000,
          userVerification: "preferred", // Changed from "required" to "preferred" for better compatibility
        },
      }) as PublicKeyCredential;
    } catch (authError: any) {
      console.error("[Passkey] Browser authentication error:", authError);
      throw authError; // Re-throw to be caught by outer catch
    }

    if (!assertion) {
      return { success: false, error: "Authentication was cancelled" };
    }
    
    console.log("[Passkey] Browser authentication successful, verifying with server...");

    const response = assertion.response as AuthenticatorAssertionResponse;
    const signature = arrayBufferToBase64Url(response.signature);
    const clientDataJSON = arrayBufferToBase64Url(response.clientDataJSON);
    const authenticatorData = arrayBufferToBase64Url(response.authenticatorData);

    // Verify with server
    const verifyResponse = await fetch("/api/passkey/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        credentialId: arrayBufferToBase64Url(credentialId),
        signature,
        clientDataJSON,
        authenticatorData,
      }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.error("[Passkey] Verify API error:", verifyResponse.status, errorData);
      return { 
        success: false, 
        error: errorData.error || `Verification failed (${verifyResponse.status})` 
      };
    }

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      console.error("[Passkey] Verification failed:", verifyData);
      return { success: false, error: verifyData.error || "Verification failed" };
    }
    
    console.log("[Passkey] Verification successful");

    return {
      success: true,
      credentialId: arrayBufferToBase64Url(credentialId),
    };
  } catch (error: any) {
    console.error("[Passkey] Authentication error:", error);
    console.error("[Passkey] Error name:", error.name);
    console.error("[Passkey] Error message:", error.message);
    
    // Provide more specific error messages
    if (error.name === "NotAllowedError") {
      return {
        success: false,
        error: "Authentication was cancelled or not allowed. Please try again and complete the passkey prompt.",
      };
    } else if (error.name === "InvalidStateError") {
      return {
        success: false,
        error: "Passkey is not available or has been removed. Please set up a new passkey.",
      };
    } else if (error.name === "NotSupportedError") {
      return {
        success: false,
        error: "Passkey authentication is not supported on this device or browser.",
      };
    } else if (error.name === "SecurityError") {
      return {
        success: false,
        error: "Security error. Please ensure you're using HTTPS or localhost.",
      };
    }
    
    return {
      success: false,
      error: error.message || "Failed to authenticate with passkey. Please try again.",
    };
  }
}

/**
 * Check if passkey is supported
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== undefined
  );
}

/**
 * Check if platform authenticator is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

