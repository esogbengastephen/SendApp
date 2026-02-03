"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data: any;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadCountRef = useRef(0);

  // Create notification sound (using Web Audio API as fallback)
  useEffect(() => {
    const createNotificationSound = () => {
      try {
        // Try to load audio file first
        const audio = new Audio("/notification-sound.mp3");
        audio.volume = 0.5;
        audioRef.current = audio;
      } catch (e) {
        // Fallback: Create sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        // Store a function to play the sound
        audioRef.current = {
          play: () => {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.value = 800;
            osc.type = "sine";
            
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
            
            return Promise.resolve();
          }
        } as any;
      }
    };
    
    createNotificationSound();
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const user = await getUserFromStorage();
      if (!user?.id) return;

      const response = await fetch("/api/notifications?limit=20");
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
        const newUnreadCount = data.unreadCount || 0;
        
        // Play sound if new notification arrived
        if (newUnreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
          try {
            await audioRef.current?.play();
          } catch (e) {
            // Auto-play blocked, user interaction required
            console.log("Notification sound requires user interaction");
          }
        }
        
        setUnreadCount(newUnreadCount);
        previousUnreadCountRef.current = newUnreadCount;
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription with WebSocket error handling
  useEffect(() => {
    fetchNotifications().catch(() => {});

    const user = getUserFromStorage();
    if (!user?.id) {
      // Poll for updates every 30 seconds as fallback; .catch() prevents unhandled rejection on "Failed to fetch"
      const interval = setInterval(() => fetchNotifications().catch(() => {}), 30000);
      return () => clearInterval(interval);
    }

    let channel: any = null;
    let interval: NodeJS.Timeout | null = null;
    let realtimeEnabled = false;

    // Check if WebSocket is available and secure
    const isWebSocketAvailable = () => {
      try {
        if (typeof window === "undefined") return false;
        if (typeof WebSocket === "undefined") return false;
        
        // Check if we're on HTTPS or localhost (secure contexts)
        const isSecure = window.location.protocol === "https:" || 
                        window.location.hostname === "localhost" ||
                        window.location.hostname === "127.0.0.1";
        
        return isSecure;
      } catch (e) {
        console.warn("WebSocket availability check failed:", e);
        return false;
      }
    };

    // Try to set up realtime subscription
    const setupRealtimeSubscription = () => {
      try {
        if (!isWebSocketAvailable()) {
          console.log("[Notifications] WebSocket not available, using polling fallback");
          return false;
        }

        channel = supabase
          .channel(`notifications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              // New notification received
              fetchNotifications().catch(() => {});
              
              // Play sound
              if (audioRef.current) {
                audioRef.current.play().catch(() => {
                  // Auto-play blocked
                });
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              fetchNotifications().catch(() => {});
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              console.log("[Notifications] Realtime subscription active");
              realtimeEnabled = true;
            } else if (status === "CHANNEL_ERROR") {
              console.warn("[Notifications] Realtime subscription error, falling back to polling");
              realtimeEnabled = false;
            } else if (status === "TIMED_OUT") {
              console.warn("[Notifications] Realtime subscription timed out, falling back to polling");
              realtimeEnabled = false;
            } else if (status === "CLOSED") {
              console.warn("[Notifications] Realtime subscription closed, falling back to polling");
              realtimeEnabled = false;
            }
          });

        return true;
      } catch (error: any) {
        console.error("[Notifications] Error setting up realtime subscription:", error);
        
        // Check if it's a WebSocket security error
        if (error?.message?.includes("insecure") || 
            error?.message?.includes("WebSocket") ||
            error?.name === "SecurityError") {
          console.warn("[Notifications] WebSocket security error, using polling fallback");
        }
        
        return false;
      }
    };

    // Try to set up realtime, fall back to polling if it fails
    const subscriptionSuccess = setupRealtimeSubscription();
    
    // Always set up polling as fallback (or primary if realtime fails)
    // Use shorter interval if realtime is not available; .catch() prevents unhandled rejection on "Failed to fetch"
    const pollInterval = subscriptionSuccess && realtimeEnabled ? 60000 : 30000; // 60s if realtime works, 30s if not
    interval = setInterval(() => fetchNotifications().catch(() => {}), pollInterval);
    
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing channel:", e);
        }
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment":
        return "account_balance_wallet";
      case "transaction":
        return "swap_horiz";
      case "utility":
        return "flash_on";
      case "referral":
        return "people";
      case "invoice":
        return "receipt";
      default:
        return "notifications";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition backdrop-blur-sm relative"
        aria-label="Notifications"
      >
        <span className="material-icons-outlined text-secondary text-xl">
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border border-primary animate-pulse"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 text-center text-slate-500">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <span className="material-icons-outlined text-4xl mb-2 opacity-50">
                    notifications_none
                  </span>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) markAsRead(notification.id);
                      }}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition ${
                        !notification.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-icons-outlined text-primary">
                              {getNotificationIcon(notification.type)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
