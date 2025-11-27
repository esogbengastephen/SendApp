"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface User {
  id: string;
  email: string | null;
  walletAddress: string | null;
  referralCode: string | null;
  referralCount: number;
  referredBy: string | null;
  sendtag?: string | null;
  totalTransactions: number;
  totalSpentNGN: number;
  totalReceivedSEND: string;
  firstTransactionAt: string | null;
  lastTransactionAt: string | null;
  createdAt: string;
  userType: "email" | "wallet";
  isBlocked?: boolean;
  requiresReset?: boolean;
  blockedAt?: string | null;
  blockedReason?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersToday: 0,
    totalTransactions: 0,
    totalRevenue: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        sortBy,
        sortOrder,
      });

      const [usersResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/users?${params}`),
        fetch("/api/admin/users?stats=true"),
      ]);

      const usersData = await usersResponse.json();
      const statsData = await statsResponse.json();

      if (usersData.success) {
        setUsers(usersData.users);
        setPagination(usersData.pagination);
      }

      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.pageSize, search, sortBy, sortOrder]);

  const handlePageSizeChange = (newSize: number) => {
    setPagination({ ...pagination, pageSize: newSize, page: 1 });
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      setPagination({ ...pagination, page: pagination.page - 1 });
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      setPagination({ ...pagination, page: pagination.page + 1 });
    }
  };

  const handleUserAction = async (userId: string, action: "block" | "unblock" | "reset" | "clear_reset", userEmail: string) => {
    const actionMessages = {
      block: `block ${userEmail}`,
      unblock: `unblock ${userEmail}`,
      reset: `reset account for ${userEmail}`,
      clear_reset: `clear reset flag for ${userEmail}`,
    };

    if (!confirm(`Are you sure you want to ${actionMessages[action]}?`)) {
      return;
    }

    setActionLoading(userId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action,
          reason: action === "block" ? "Blocked by administrator" : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setActionSuccess(data.message);
        setTimeout(() => setActionSuccess(null), 5000);
        // Refresh users list
        fetchUsers();
      } else {
        setActionError(data.error || "Failed to perform action");
      }
    } catch (err: any) {
      console.error("Failed to perform user action:", err);
      setActionError(err.message || "Failed to perform action");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Users
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          All registered users
        </p>
      </div>

      {/* Success Message */}
      {actionSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ {actionSuccess}
          </p>
        </div>
      )}

      {/* Error Message */}
      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total Users</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.totalUsers.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">New Today</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.newUsersToday.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total Transactions</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.totalTransactions.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total Revenue</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            ₦{stats.totalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by email or referral code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Sort By and Page Size Container */}
          <div className="flex flex-col sm:flex-row gap-4 lg:flex-shrink-0">
            {/* Sort By */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
              >
                <option value="created_at">Date Joined</option>
                <option value="email">Email</option>
                <option value="referral_count">Referrals</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>

            {/* Page Size */}
            <select
              value={pagination.pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Wallet
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Referrals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Transactions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Total Spent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Total Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {user.email || <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" title={user.blockedReason || "Blocked"}>
                          🔴 Blocked
                        </span>
                      ) : user.requiresReset ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                          🟡 Reset Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          🟢 Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-mono text-slate-900 dark:text-slate-100">
                        {user.walletAddress ? (
                          <span>{user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {user.referralCount || 0}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {user.totalTransactions}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold text-green-600 dark:text-green-400">
                        ₦{user.totalSpentNGN.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold text-primary">
                        {parseFloat(user.totalReceivedSEND).toLocaleString()} SEND
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        {user.isBlocked ? (
                          <button
                            onClick={() => handleUserAction(user.id, "unblock", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === user.id ? "..." : "Unblock"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, "block", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === user.id ? "..." : "Block"}
                          </button>
                        )}
                        {user.requiresReset ? (
                          <button
                            onClick={() => handleUserAction(user.id, "clear_reset", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="text-xs bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === user.id ? "..." : "Clear Reset"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, "reset", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading === user.id ? "..." : "Reset Account"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of{" "}
            {pagination.totalCount} users
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={pagination.page === 1}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Previous
            </button>
            
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            
            <button
              onClick={handleNextPage}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
