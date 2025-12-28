"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface ReferralUser {
  id: string;
  email: string;
  referral_code: string;
  referral_count: number;
  referred_by: string | null;
  created_at: string;
  referredUsers?: any[];
  activeReferralsCount?: number;
  totalReferralSpending?: number;
  totalReferralTransactions?: number;
  userOwnTransactionCount?: number;
  userOwnSpending?: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function ReferralsPage() {
  const { address } = useAccount();
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalReferrals: 0,
    activeReferrers: 0,
    totalReferralRevenue: 0,
    avgReferralsPerUser: "0",
    topReferrer: null as any,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
  });
  
  // Search
  const [search, setSearch] = useState("");
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minReferrals: "",
    maxReferrals: "",
    minActiveReferrals: "",
    minReferralSpending: "",
    accountDateFrom: "",
    accountDateTo: "",
    referralStatus: "all",
    hasTransactingReferrals: "all",
    hasOwnTransactions: "all",
  });
  
  // Export
  const [exporting, setExporting] = useState(false);
  
  // Email
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // UI states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (address) {
      fetchReferrals();
    }
  }, [address, pagination.page, pagination.pageSize, search, filters]);

  const fetchReferrals = async () => {
    if (!address) return;
    
    setLoading(true);
    setSelectedUsers([]);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        ...filters,
      });
      
      const response = await fetch(`/api/admin/referrals?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setStats(data.stats || { 
          totalUsers: 0, 
          totalReferrals: 0, 
          activeReferrers: 0,
          totalReferralRevenue: 0,
          avgReferralsPerUser: "0",
          topReferrer: null 
        });
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to fetch referral data");
      }
    } catch (err: any) {
      console.error("Failed to fetch referrals:", err);
      setError("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.email));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (email: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, email]);
    } else {
      setSelectedUsers(selectedUsers.filter(e => e !== email));
    }
  };

  const isAllSelected = users.length > 0 && selectedUsers.length === users.length;
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < users.length;

  const handleSendEmailToUser = async (userEmail: string) => {
    if (!emailSubject || !emailMessage) {
      setError("Please fill in email subject and message");
      return;
    }

    setSendingBulkEmail(true);
    setError(null);
    
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailList: [userEmail],
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error("Failed to send email:", err);
      setError(err.message || "Failed to send email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  const handleBulkEmail = async () => {
    if (!emailSubject || !emailMessage) {
      setError("Please fill in email subject and message");
      return;
    }

    if (selectedUsers.length === 0) {
      setError("Please select at least one user to send email to");
      return;
    }

    setSendingBulkEmail(true);
    setError(null);
    
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailList: selectedUsers,
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setError(null);
        setEmailSubject("");
        setEmailMessage("");
        setSelectedUsers([]);
        setTimeout(() => setSuccess(false), 5000);
        fetchReferrals();
      } else {
        setError(data.error || "Failed to send bulk email");
      }
    } catch (err: any) {
      console.error("Failed to send bulk email:", err);
      setError(err.message || "Failed to send bulk email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      minReferrals: "",
      maxReferrals: "",
      minActiveReferrals: "",
      minReferralSpending: "",
      accountDateFrom: "",
      accountDateTo: "",
      referralStatus: "all",
      hasTransactingReferrals: "all",
      hasOwnTransactions: "all",
    });
    setSearch("");
  };

  // Check if any filters are active
  const hasActiveFilters = search !== "" || Object.entries(filters).some(([key, value]) => 
    key !== "referralStatus" && key !== "hasTransactingReferrals" && key !== "hasOwnTransactions" ? value !== "" : value !== "all"
  );

  // Handle export
  const handleExport = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one user to export");
      return;
    }

    setExporting(true);
    try {
      const response = await fetch("/api/admin/referrals/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmails: selectedUsers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export referrals");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referrals-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Failed to export referrals:", error);
      setError(error.message || "Failed to export referrals");
      setTimeout(() => setError(null), 5000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Referral Program
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Manage user referrals and send bulk emails
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Email sent successfully!
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total Users</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.totalUsers.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Total Referrals</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.totalReferrals.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Active Referrers</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.activeReferrers.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Referral Revenue</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            ₦{stats.totalReferralRevenue.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Avg. Referrals/User</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.avgReferralsPerUser}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Top Referrer</div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 sm:mt-2">
            {stats.topReferrer?.referral_count || 0} referrals
          </div>
          {stats.topReferrer?.email && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {stats.topReferrer.email}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div>
            <input
              type="text"
              placeholder="Search by email or referral code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Basic Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Minimum Referrals
                </label>
                <input
                  type="number"
                  min="0"
                  value={filters.minReferrals}
                  onChange={(e) => handleFilterChange("minReferrals", e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Maximum Referrals
                </label>
                <input
                  type="number"
                  min="0"
                  value={filters.maxReferrals}
                  onChange={(e) => handleFilterChange("maxReferrals", e.target.value)}
                  placeholder="No limit"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-end">
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
          
          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <span>🔍</span>
              <span>Advanced Filters</span>
              {hasActiveFilters && (
                <span className="bg-primary text-slate-900 text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
              )}
              <span>{showFilters ? "▲" : "▼"}</span>
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Clear All Filters
              </button>
            )}
          </div>
          
          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Advanced Filters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Transaction Metrics */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Active Referrals
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minActiveReferrals}
                    onChange={(e) => handleFilterChange("minActiveReferrals", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Referrals who made transactions
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Referral Spending (₦)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minReferralSpending}
                    onChange={(e) => handleFilterChange("minReferralSpending", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Total spent by all referrals
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Referral Status
                  </label>
                  <select
                    value={filters.referralStatus}
                    onChange={(e) => handleFilterChange("referralStatus", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All Users</option>
                    <option value="has_referrals">Has Referrals</option>
                    <option value="no_referrals">No Referrals</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Has Transacting Referrals
                  </label>
                  <select
                    value={filters.hasTransactingReferrals}
                    onChange={(e) => handleFilterChange("hasTransactingReferrals", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Their referrals made purchases
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    User Made Transactions
                  </label>
                  <select
                    value={filters.hasOwnTransactions}
                    onChange={(e) => handleFilterChange("hasOwnTransactions", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    User themselves made purchases
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Account Created From
                  </label>
                  <input
                    type="date"
                    value={filters.accountDateFrom}
                    onChange={(e) => handleFilterChange("accountDateFrom", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Account Created To
                  </label>
                  <input
                    type="date"
                    value={filters.accountDateTo}
                    onChange={(e) => handleFilterChange("accountDateTo", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Section */}
      {selectedUsers.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl flex items-center justify-between">
          <div className="text-sm text-green-700 dark:text-green-300">
            <span className="font-semibold">{selectedUsers.length}</span> user(s) selected
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Exporting...
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Export Selected</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Referral Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Total Referrals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Active Referrals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Referral Revenue
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  User's Transactions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  User's Spending
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Loading referrals...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No users found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.email)}
                        onChange={(e) => handleSelectUser(user.email, e.target.checked)}
                        className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-primary">
                      {user.referral_code}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {user.referral_count || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-1">
                        {user.activeReferralsCount || 0}
                        {user.activeReferralsCount && user.activeReferralsCount > 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ₦{(user.totalReferralSpending || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-1">
                        {user.userOwnTransactionCount || 0}
                        {user.userOwnTransactionCount && user.userOwnTransactionCount > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      ₦{(user.userOwnSpending || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSendEmailToUser(user.email)}
                        disabled={!emailSubject || !emailMessage || sendingBulkEmail}
                        className="text-xs bg-primary text-slate-900 px-3 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send Email
                      </button>
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

      {/* Bulk Email Section */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Send Bulk Email
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              placeholder="Enter email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Message
            </label>
            <textarea
              placeholder="Enter email message"
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={handleBulkEmail}
            disabled={!emailSubject || !emailMessage || sendingBulkEmail || selectedUsers.length === 0}
            className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sendingBulkEmail ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                Sending...
              </>
            ) : (
              `Send to Selected Users (${selectedUsers.length})`
            )}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedUsers.length > 0 
              ? `Emails will be sent to ${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'}`
              : `Select users from the table above to send emails. ${users.length} user${users.length === 1 ? '' : 's'} on this page.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}

