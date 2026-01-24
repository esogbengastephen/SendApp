"use client";

import { useEffect, useState } from "react";
import { KYC_TIERS, getKYCTierInfo, type KYCTier } from "@/lib/kyc-tiers";

interface User {
  id: string;
  email: string;
  display_name?: string;
  flutterwave_kyc_tier: number | null;
  flutterwave_nin?: string;
  created_at: string;
  kycTierInfo?: any;
  hasBVN?: boolean;
  canUpgrade?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const COLORS = {
  primary: "#00BFFF",
  backgroundDark: "#011931",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

export default function KYCManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [selectedTier, searchTerm, pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (selectedTier !== "all") {
        params.append("tier", selectedTier);
      }

      if (searchTerm) {
        params.append("search", searchTerm);
      }

      const response = await fetch(`/api/admin/kyc?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTierUpdate = async (userId: string, newTier: number) => {
    if (!confirm(`Are you sure you want to update this user's KYC tier to Tier ${newTier}?`)) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh users list
        fetchUsers();
        alert(`KYC tier updated successfully to ${data.user.kycTierInfo.name}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error updating tier:", error);
      alert("Failed to update KYC tier");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getTierBadgeColor = (tier: number | null) => {
    const tierValue = tier || 1;
    switch (tierValue) {
      case 1:
        return "bg-warning text-white";
      case 2:
        return "bg-info text-white";
      case 3:
        return "bg-success text-white";
      default:
        return "bg-medium-grey text-white";
    }
  };

  const tierStats = {
    tier1: users.filter((u) => (u.flutterwave_kyc_tier || 1) === 1).length,
    tier2: users.filter((u) => u.flutterwave_kyc_tier === 2).length,
    tier3: users.filter((u) => u.flutterwave_kyc_tier === 3).length,
    total: pagination.total,
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <style jsx global>{`
        :root {
          --background-light: #FFFFFF;
          --background-dark: #011931;
        }
        .dark {
          --background-light: #011931;
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary dark:text-text-primary-dark">
          KYC Management
        </h1>
        <p className="text-sm sm:text-base text-medium-grey dark:text-light-grey mt-1 sm:mt-2">
          View and manage user KYC verification status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-medium-grey dark:text-light-grey">Tier 1</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getTierBadgeColor(1)}`}>
              Basic
            </span>
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {loading ? "..." : tierStats.tier1.toLocaleString()}
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-medium-grey dark:text-light-grey">Tier 2</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getTierBadgeColor(2)}`}>
              BVN Verified
            </span>
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {loading ? "..." : tierStats.tier2.toLocaleString()}
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-medium-grey dark:text-light-grey">Tier 3</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getTierBadgeColor(3)}`}>
              Enhanced
            </span>
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {loading ? "..." : tierStats.tier3.toLocaleString()}
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-medium-grey dark:text-light-grey">Total Users</span>
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {loading ? "..." : tierStats.total.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Search by Email or Name
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              placeholder="Search users..."
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ "--focus-ring-color": COLORS.primary } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Filter by Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => {
                setSelectedTier(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ "--focus-ring-color": COLORS.primary } as React.CSSProperties}
              aria-label="Filter by KYC tier"
            >
              <option value="all">All Tiers</option>
              <option value="1">Tier 1 - Basic</option>
              <option value="2">Tier 2 - BVN Verified</option>
              <option value="3">Tier 3 - Enhanced</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-lg border border-light-grey dark:border-medium-grey overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-blue dark:bg-background-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  KYC Tier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  BVN Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Limits
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-grey dark:divide-medium-grey">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-medium-grey dark:text-light-grey">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-medium-grey dark:text-light-grey">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const tier = (user.flutterwave_kyc_tier || 1) as KYCTier;
                  const tierInfo = user.kycTierInfo || getKYCTierInfo(tier);
                  return (
                    <tr key={user.id} className="hover:bg-light-blue dark:hover:bg-background-dark transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                            {user.display_name || user.email}
                          </p>
                          <p className="text-xs text-medium-grey dark:text-light-grey">
                            {user.email}
                          </p>
                          {user.flutterwave_nin && (
                            <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                              NIN: {user.flutterwave_nin}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTierBadgeColor(tier)}`}>
                          {tierInfo.name}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {user.hasBVN ? (
                          <span className="text-xs text-success font-semibold">✓ Verified</span>
                        ) : (
                          <span className="text-xs text-warning font-semibold">Not Verified</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-medium-grey dark:text-light-grey">
                          <p>Daily: ₦{tierInfo.dailyLimit.toLocaleString()}</p>
                          <p>Monthly: ₦{tierInfo.monthlyLimit.toLocaleString()}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {tier < 2 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, 2)}
                              disabled={updatingUserId === user.id}
                              className="px-3 py-1 text-xs rounded-lg text-white transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: COLORS.info }}
                            >
                              {updatingUserId === user.id ? "Updating..." : "Upgrade to Tier 2"}
                            </button>
                          )}
                          {tier < 3 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, 3)}
                              disabled={updatingUserId === user.id}
                              className="px-3 py-1 text-xs rounded-lg text-white transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: COLORS.success }}
                            >
                              {updatingUserId === user.id ? "Updating..." : "Upgrade to Tier 3"}
                            </button>
                          )}
                          {tier > 1 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, tier - 1)}
                              disabled={updatingUserId === user.id}
                              className="px-3 py-1 text-xs rounded-lg text-white transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: COLORS.warning }}
                            >
                              {updatingUserId === user.id ? "Updating..." : "Downgrade"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-4 border-t border-light-grey dark:border-medium-grey flex items-center justify-between">
            <div className="text-sm text-medium-grey dark:text-light-grey">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey text-text-primary dark:text-text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey text-text-primary dark:text-text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
