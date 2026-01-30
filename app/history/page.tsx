"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

function HistoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }

    setUser(currentUser);
    fetchTransactions(currentUser.id);
  }, [router]);

  // Handle URL params for transaction details (after transactions are loaded)
  useEffect(() => {
    const txId = searchParams.get("tx");
    const txType = searchParams.get("type");
    if (txId && transactions.length > 0 && user) {
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        // If type is provided in URL, use it; otherwise use transaction's type
        if (txType) {
          // Map old type names to new ones if needed
          const mappedType = txType === "crypto_purchase" ? "naira_to_crypto"
            : txType === "offramp" ? "crypto_to_naira"
            : txType === "invoice_paid" || txType === "invoice_created" ? "invoice"
            : txType;
          // Update filter to match the transaction type
          if (mappedType !== filter) {
            setFilter(mappedType);
          }
        }
        fetchTransactionDetails(tx);
      }
    }
  }, [transactions, searchParams, user]);

  const fetchTransactions = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/transactions?userId=${userId}&limit=100`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionDetails = async (tx: any) => {
    if (!user) return;

    setLoadingDetails(true);
    setSelectedTransaction(tx);
    setShowDetailsModal(true);

    try {
      // Use originalType if available, otherwise use type
      const typeForApi = tx.originalType || tx.type;
      // Handle invoice types
      const finalType = typeForApi === "invoice" 
        ? (tx.originalType === "invoice_paid" ? "invoice_paid" : "invoice_created")
        : typeForApi === "naira_to_crypto" ? "crypto_purchase"
        : typeForApi === "crypto_to_naira" ? "offramp"
        : typeForApi;

      const response = await fetch(
        `/api/user/transactions/${tx.id}?type=${finalType}&userId=${user.id}`
      );
      const data = await response.json();

      if (data.success) {
        setTransactionDetails(data.transaction);
      } else {
        setTransactionDetails(null);
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      setTransactionDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "completed" || status === "paid") return "text-green-600 dark:text-green-400";
    if (status === "failed") return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getStatusBg = (status: string) => {
    if (status === "completed" || status === "paid") return "bg-green-100 dark:bg-green-900/30";
    if (status === "failed") return "bg-red-100 dark:bg-red-900/30";
    return "bg-yellow-100 dark:bg-yellow-900/30";
  };

  const getStatusLabel = (status: string) => {
    if (status === "completed" || status === "paid") return "Successful";
    if (status === "failed") return "Failed";
    return "Pending";
  };

  const filteredTransactions = filter === "all" 
    ? transactions 
    : filter === "invoice"
    ? transactions.filter(tx => tx.type === "invoice" || tx.type === "invoice_paid" || tx.type === "invoice_created")
    : transactions.filter(tx => tx.type === filter || tx.originalType === filter);

  const transactionTypes = [
    { id: "all", label: "All", icon: "list" },
    { id: "naira_to_crypto", label: "Naira to Crypto", icon: "currency_bitcoin" },
    { id: "crypto_to_naira", label: "Crypto to Naira", icon: "currency_exchange" },
    { id: "receive_naira", label: "Receive Naira", icon: "account_balance_wallet" },
    { id: "receive_crypto", label: "Receive Crypto", icon: "wallet" },
    { id: "utility", label: "Utility", icon: "receipt" },
    { id: "invoice", label: "Invoices", icon: "receipt_long" },
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20">
      {/* Header */}
      <div className="bg-primary rounded-b-[3rem] p-6 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-secondary/10 rounded-lg transition"
          >
            <span className="material-icons-outlined text-secondary">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold text-secondary">Transaction History</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {transactionTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setFilter(type.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors whitespace-nowrap ${
                filter === type.id
                  ? "bg-secondary text-primary"
                  : "bg-white/20 text-secondary/80 hover:bg-white/30"
              }`}
            >
              <span className="material-icons-outlined text-sm">{type.icon}</span>
              <span className="text-sm">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transactions...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white dark:bg-card-dark rounded-3xl p-12 shadow-md border border-gray-100 dark:border-white/5 text-center">
            <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">receipt</span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No transactions found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === "all" 
                ? "You haven't made any transactions yet" 
                : filter === "receive_naira" || filter === "receive_crypto"
                ? `No ${transactionTypes.find(t => t.id === filter)?.label.toLowerCase()} transactions yet. This feature will track incoming deposits.`
                : `No ${transactionTypes.find(t => t.id === filter)?.label.toLowerCase()} transactions`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => fetchTransactionDetails(tx)}
                className="bg-white dark:bg-card-dark rounded-2xl p-4 shadow-md border border-gray-100 dark:border-white/5 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-full ${getStatusBg(tx.status)} flex items-center justify-center flex-shrink-0`}>
                      <span className={`material-icons-outlined ${getStatusColor(tx.status)}`}>{tx.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {tx.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-white/60 mb-2">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-white/50">
                        <span>
                          {new Date(tx.date).toLocaleDateString()}
                        </span>
                        <span>
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {tx.reference && (
                          <span className="font-mono">Ref: {tx.reference.substring(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {tx.amountLabel}
                    </p>
                    {tx.secondaryAmountLabel && (
                      <p className="text-sm font-medium text-primary">
                        {tx.secondaryAmountLabel}
                      </p>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBg(tx.status)} ${getStatusColor(tx.status)} font-medium`}>
                      {getStatusLabel(tx.status)}
                    </span>
                    <span className="material-icons-outlined text-gray-400 dark:text-gray-500 text-sm mt-1">
                      chevron_right
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card-dark rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined">receipt_long</span>
                Transaction Details
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTransaction(null);
                  setTransactionDetails(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-gray-600 dark:text-gray-400">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading details...</span>
                </div>
              ) : transactionDetails ? (
                <div className="space-y-6">
                  {/* Transaction Type & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${getStatusBg(transactionDetails.status)} flex items-center justify-center`}>
                        <span className={`material-icons-outlined ${getStatusColor(transactionDetails.status)}`}>
                          {selectedTransaction?.icon || "receipt"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {selectedTransaction?.title || transactionDetails.serviceName || "Transaction"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedTransaction?.description}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full ${getStatusBg(transactionDetails.status)} ${getStatusColor(transactionDetails.status)} font-medium`}>
                      {getStatusLabel(transactionDetails.status)}
                    </span>
                  </div>

                  {/* Amount Section */}
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-2xl p-6 border-2 border-primary/20">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Amount</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {selectedTransaction?.amountLabel || `₦${transactionDetails.totalAmount?.toLocaleString() || transactionDetails.ngnAmount?.toLocaleString() || "0"}`}
                    </p>
                    {selectedTransaction?.secondaryAmountLabel && (
                      <p className="text-lg font-semibold text-primary mt-2">
                        {selectedTransaction.secondaryAmountLabel}
                      </p>
                    )}
                  </div>

                  {/* Transaction Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date & Time */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date & Time</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {new Date(transactionDetails.createdAt || transactionDetails.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(transactionDetails.createdAt || transactionDetails.date).toLocaleTimeString()}
                      </p>
                    </div>

                    {/* Reference */}
                    {(transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference) && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reference</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white break-all flex-1">
                            {transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference}
                          </p>
                          <button
                            onClick={() => {
                              const ref = transactionDetails.transactionId || transactionDetails.clubkonnectReference || transactionDetails.invoiceNumber || transactionDetails.reference;
                              navigator.clipboard.writeText(ref);
                              alert("Copied to clipboard!");
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                          >
                            <span className="material-icons-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Transaction Hash */}
                    {(transactionDetails.txHash || transactionDetails.swapTxHash) && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white break-all flex-1">
                            {transactionDetails.txHash || transactionDetails.swapTxHash}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(transactionDetails.txHash || transactionDetails.swapTxHash);
                              alert("Copied to clipboard!");
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          >
                            <span className="material-icons-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Type-specific fields */}
                    {transactionDetails.type === "crypto_purchase" && (
                      <>
                        {transactionDetails.walletAddress && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Wallet Address</p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white break-all flex-1">
                                {transactionDetails.walletAddress}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(transactionDetails.walletAddress);
                                  alert("Copied to clipboard!");
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                              >
                                <span className="material-icons-outlined text-sm">content_copy</span>
                              </button>
                            </div>
                          </div>
                        )}
                        {transactionDetails.exchangeRate && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Exchange Rate</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              1 SEND = ₦{transactionDetails.exchangeRate.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {transactionDetails.paystackReference && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Reference</p>
                            <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.paystackReference}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "utility" && (
                      <>
                        {transactionDetails.network && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Network</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.network}
                            </p>
                          </div>
                        )}
                        {(transactionDetails.phoneNumber || transactionDetails.meterNumber) && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {transactionDetails.serviceId === "electricity" ? "Meter Number" : "Phone Number"}
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.phoneNumber || transactionDetails.meterNumber}
                            </p>
                          </div>
                        )}
                        {transactionDetails.markupAmount > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Service Fee</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ₦{transactionDetails.markupAmount.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "offramp" && (
                      <>
                        {transactionDetails.userAccountNumber && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account Number</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.userAccountNumber}
                            </p>
                          </div>
                        )}
                        {transactionDetails.tokenSymbol && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Token</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.tokenAmount} {transactionDetails.tokenSymbol}
                            </p>
                          </div>
                        )}
                        {transactionDetails.feeNgn > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fee</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ₦{transactionDetails.feeNgn.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {transactionDetails.type === "invoice_paid" || transactionDetails.type === "invoice_created" ? (
                      <>
                        {transactionDetails.customerName && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Customer</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.customerName}
                            </p>
                          </div>
                        )}
                        {transactionDetails.description && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 md:col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {transactionDetails.description}
                            </p>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Error Message (if failed) */}
                  {transactionDetails.errorMessage && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</p>
                      <p className="text-sm text-red-700 dark:text-red-400">
                        {transactionDetails.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">error_outline</span>
                  <p className="text-gray-600 dark:text-gray-400">Failed to load transaction details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  );
}
