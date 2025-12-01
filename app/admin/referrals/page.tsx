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
    topReferrer: null as any,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
  });
  
  // Filters
  const [minReferrals, setMinReferrals] = useState("");
  const [maxReferrals, setMaxReferrals] = useState("");
  
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
  }, [address, pagination.page, pagination.pageSize, minReferrals, maxReferrals]);

  const fetchReferrals = async () => {
    if (!address) return;
    
    setLoading(true);
    setSelectedUsers([]);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      
      if (minReferrals) params.append("minReferrals", minReferrals);
      if (maxReferrals) params.append("maxReferrals", maxReferrals);
      
      const response = await fetch(`/api/admin/referrals?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setStats(data.stats || { totalUsers: 0, totalReferrals: 0, topReferrer: null });
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Referrals
              </label>
              <input
                type="number"
                min="0"
                value={minReferrals}
                onChange={(e) => {
                  setMinReferrals(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
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
                value={maxReferrals}
                onChange={(e) => {
                  setMaxReferrals(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
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
      </div>

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
                  Referrals
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Loading referrals...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
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

