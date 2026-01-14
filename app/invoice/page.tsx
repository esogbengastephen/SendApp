"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserFromStorage } from "@/lib/session";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainLogo, getTokenLogo } from "@/lib/logos";
import dynamic from "next/dynamic";

// Lazy load QRCode component to reduce initial bundle
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), {
  ssr: false,
  loading: () => <div className="w-32 h-32 flex items-center justify-center">Loading QR...</div>,
});

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  crypto_chain_id: string | null;
  crypto_address: string | null;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: "pending" | "paid" | "expired" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  invoice_type?: "personal" | "business";
  metadata?: {
    marked_paid_by?: string;
    marked_paid_at?: string;
  } | null;
}

interface WalletBalance {
  balance: string;
  usdValue: number;
  symbol: string;
}

export default function InvoicePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, WalletBalance>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // Delete state
  const [deletingInvoice, setDeletingInvoice] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  
  // Dropdown state
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isEditChainDropdownOpen, setIsEditChainDropdownOpen] = useState(false);
  const [isEditTokenDropdownOpen, setIsEditTokenDropdownOpen] = useState(false);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const editChainDropdownRef = useRef<HTMLDivElement>(null);
  const editTokenDropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "expired" | "cancelled">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    amount: "",
    currency: "NGN",
    cryptoChainId: "",
    cryptoToken: "",
    cryptoAddress: "",
    description: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    dueDate: "",
    invoiceType: "personal" as "personal" | "business",
  });
  
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([
    { id: Date.now().toString(), description: "", amount: "" }
  ]);
  const [editActiveTab, setEditActiveTab] = useState<"NGN" | "Crypto">("NGN");

  // Tab state
  const [activeTab, setActiveTab] = useState<"NGN" | "Crypto">("NGN");

  // Line items state
  interface LineItem {
    id: string;
    description: string;
    amount: string;
  }

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    currency: "NGN",
    cryptoChainId: "",
    cryptoToken: "", // USDC, USDT, or SEND
    cryptoAddress: "",
    description: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    dueDate: "",
    invoiceType: "personal" as "personal" | "business",
  });
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Date.now().toString(), description: "", amount: "" }
  ]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
    fetchInvoices(currentUser.email);
    fetchWalletBalances(currentUser.id);
  }, [router]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false);
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false);
      }
      if (editChainDropdownRef.current && !editChainDropdownRef.current.contains(event.target as Node)) {
        setIsEditChainDropdownOpen(false);
      }
      if (editTokenDropdownRef.current && !editTokenDropdownRef.current.contains(event.target as Node)) {
        setIsEditTokenDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchWalletBalances = async (userId: string) => {
    setLoadingBalances(true);
    try {
      const response = await fetch(`/api/wallet/balances?userId=${userId}`);
      const data = await response.json();

      if (data.success && data.balances) {
        setWalletBalances(data.balances);
      }
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const fetchInvoices = async (email: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/list?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.success) {
        const invoicesList = data.invoices || [];
        setInvoices(invoicesList);
        setFilteredInvoices(invoicesList);
      } else {
        setToast({
          message: data.error || "Failed to fetch invoices",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setToast({
        message: "Failed to fetch invoices",
        type: "error",
        isVisible: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Line items helper functions
  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now().toString(), description: "", amount: "" }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: "description" | "amount", value: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = (items: LineItem[]): number => {
    return items.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate line items
    const validItems = lineItems.filter(item => 
      item.description.trim() && item.amount && parseFloat(item.amount) > 0
    );
    
    if (validItems.length === 0) {
      setToast({
        message: "Please add at least one item with description and amount",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Calculate total from line items
    const totalAmount = calculateTotal(validItems);
    
    if (totalAmount <= 0) {
      setToast({
        message: "Total amount must be greater than zero",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Validate crypto fields if crypto tab is active
    if (activeTab === "Crypto") {
      if (!formData.cryptoChainId) {
        setToast({
          message: "Please select a network/chain",
          type: "error",
          isVisible: true,
        });
        return;
      }
      if (!formData.cryptoToken) {
        setToast({
          message: "Please select a token",
          type: "error",
          isVisible: true,
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      // Determine currency based on active tab
      const currency = activeTab === "NGN" ? "NGN" : formData.cryptoToken;
      const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
      
      // Use custom address if provided, otherwise use wallet address from user's dashboard
      const finalCryptoAddress = activeTab === "Crypto" 
        ? (formData.cryptoAddress?.trim() || walletAddresses[formData.cryptoChainId] || "")
        : null;
      
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: totalAmount.toString(),
          currency: currency,
          cryptoChainId: activeTab === "Crypto" ? formData.cryptoChainId : null,
          cryptoAddress: finalCryptoAddress,
          description: formData.description || null,
          customerName: formData.customerName || null,
          customerEmail: formData.customerEmail || null,
          customerPhone: formData.customerPhone || null,
          dueDate: formData.dueDate || null,
          invoiceType: formData.invoiceType,
          lineItems: validItems.map(item => ({
            description: item.description.trim(),
            amount: parseFloat(item.amount)
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice created successfully!",
          type: "success",
          isVisible: true,
        });
        setShowCreateForm(false);
        setFormData({
          amount: "",
          currency: "NGN",
          cryptoChainId: "",
          cryptoToken: "",
          cryptoAddress: "",
          description: "",
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          dueDate: "",
          invoiceType: "personal",
        });
        setLineItems([{ id: Date.now().toString(), description: "", amount: "" }]);
        setActiveTab("NGN");
        fetchInvoices(user.email);
      } else {
        setToast({
          message: data.error || "Failed to create invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      setToast({
        message: "Failed to create invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePayInvoice = async (invoiceNumber: string) => {
    setIsPaying(invoiceNumber);
    try {
      const response = await fetch(`/api/invoices/${invoiceNumber}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.success && data.authorization_url) {
        // Redirect to Paystack payment page
        window.location.href = data.authorization_url;
      } else {
        setToast({
          message: data.error || "Failed to initialize payment",
          type: "error",
          isVisible: true,
        });
        setIsPaying(null);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setToast({
        message: "Failed to process payment",
        type: "error",
        isVisible: true,
      });
      setIsPaying(null);
    }
  };

  const handleShareInvoice = async (invoiceNumber: string) => {
    const shareUrl = `${window.location.origin}/invoice/${invoiceNumber}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast({
        message: "Invoice link copied to clipboard!",
        type: "success",
        isVisible: true,
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      setToast({
        message: shareUrl,
        type: "info",
        isVisible: true,
      });
    }
  };

  // Edit line items helper functions
  const addEditLineItem = () => {
    setEditLineItems([...editLineItems, { id: Date.now().toString(), description: "", amount: "" }]);
  };

  const removeEditLineItem = (id: string) => {
    if (editLineItems.length > 1) {
      setEditLineItems(editLineItems.filter(item => item.id !== id));
    }
  };

  const updateEditLineItem = (id: string, field: "description" | "amount", value: string) => {
    setEditLineItems(editLineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    const isCrypto = invoice.currency !== "NGN";
    setEditActiveTab(isCrypto ? "Crypto" : "NGN");
    
    // Load line items from metadata if they exist
    const lineItemsFromMetadata = (invoice.metadata as any)?.lineItems || [];
    if (lineItemsFromMetadata.length > 0) {
      setEditLineItems(lineItemsFromMetadata.map((item: any, index: number) => ({
        id: `edit-${index}-${Date.now()}`,
        description: item.description || "",
        amount: item.amount?.toString() || "",
      })));
    } else {
      // Fallback: create one item from description
      setEditLineItems([{
        id: Date.now().toString(),
        description: invoice.description || "",
        amount: invoice.amount.toString(),
      }]);
    }
    
    setEditFormData({
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      cryptoChainId: invoice.crypto_chain_id || "",
      cryptoToken: isCrypto ? invoice.currency : "",
      cryptoAddress: invoice.crypto_address || "",
      description: invoice.description || "",
      customerName: invoice.customer_name || "",
      customerEmail: invoice.customer_email || "",
      customerPhone: invoice.customer_phone || "",
      dueDate: invoice.due_date ? invoice.due_date.split('T')[0] : "",
      invoiceType: invoice.invoice_type || "personal",
    });
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    // Validate line items
    const validItems = editLineItems.filter(item => 
      item.description.trim() && item.amount && parseFloat(item.amount) > 0
    );
    
    if (validItems.length === 0) {
      setToast({
        message: "Please add at least one item with description and amount",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Calculate total from line items
    const totalAmount = calculateTotal(validItems);
    
    if (totalAmount <= 0) {
      setToast({
        message: "Total amount must be greater than zero",
        type: "error",
        isVisible: true,
      });
      return;
    }

    if (editActiveTab === "Crypto") {
      if (!editFormData.cryptoChainId || !editFormData.cryptoToken) {
        setToast({
          message: "Please select network and token",
          type: "error",
          isVisible: true,
        });
        return;
      }
    }

    setIsUpdating(true);
    try {
      const currency = editActiveTab === "NGN" ? "NGN" : editFormData.cryptoToken;
      const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
      
      // Use custom address if provided, otherwise use wallet address from user's dashboard
      const finalCryptoAddress = editActiveTab === "Crypto"
        ? (editFormData.cryptoAddress?.trim() || walletAddresses[editFormData.cryptoChainId] || "")
        : null;
      
      const response = await fetch(`/api/invoices/${encodeURIComponent(editingInvoice.invoice_number)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: totalAmount.toString(),
          currency: currency,
          cryptoChainId: editActiveTab === "Crypto" ? editFormData.cryptoChainId : null,
          cryptoAddress: finalCryptoAddress,
          description: editFormData.description || null,
          customerName: editFormData.customerName || null,
          customerEmail: editFormData.customerEmail || null,
          customerPhone: editFormData.customerPhone || null,
          dueDate: editFormData.dueDate || null,
          invoiceType: editFormData.invoiceType,
          lineItems: validItems.map(item => ({
            description: item.description.trim(),
            amount: parseFloat(item.amount)
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice updated successfully!",
          type: "success",
          isVisible: true,
        });
        setEditingInvoice(null);
        fetchInvoices(user.email);
      } else {
        console.error("Update failed:", data);
        console.error("Invoice number used:", editingInvoice.invoice_number);
        setToast({
          message: data.error || "Failed to update invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      console.error("Invoice number used:", editingInvoice.invoice_number);
      setToast({
        message: "Failed to update invoice. Please try again.",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPDF = async (invoiceNumber: string) => {
    try {
      // Navigate to invoice page to download
      const invoiceUrl = `${window.location.origin}/invoice/${encodeURIComponent(invoiceNumber)}`;
      window.open(invoiceUrl, '_blank');
      
      setToast({
        message: "Opening invoice page. Click 'Download Invoice' button to download PDF.",
        type: "info",
        isVisible: true,
      });
    } catch (error) {
      console.error("Error opening invoice:", error);
      setToast({
        message: "Failed to open invoice page",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete || !user) return;

    setDeletingInvoice(invoiceToDelete.invoice_number);
    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoiceToDelete.invoice_number)}?email=${encodeURIComponent(user.email)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice deleted successfully",
          type: "success",
          isVisible: true,
        });
        setInvoiceToDelete(null);
        fetchInvoices(user.email);
      } else {
        setToast({
          message: data.error || "Failed to delete invoice",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
      setToast({
        message: "Failed to delete invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setDeletingInvoice(null);
    }
  };

  const handleCancelDelete = () => {
    setInvoiceToDelete(null);
  };

  // Calculate statistics
  const calculateStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalRevenue = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);
    
    const pendingAmount = invoices
      .filter(inv => inv.status === "pending")
      .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);
    
    const paidThisMonth = invoices
      .filter(inv => inv.status === "paid" && new Date(inv.paid_at || inv.created_at) >= startOfMonth)
      .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);
    
    const overdueCount = invoices.filter(inv => {
      if (inv.status !== "pending" || !inv.due_date) return false;
      return new Date(inv.due_date) < now;
    }).length;
    
    return { totalRevenue, pendingAmount, paidThisMonth, overdueCount };
  };

  // Filter and sort invoices
  useEffect(() => {
    let filtered = [...invoices];
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.customer_name?.toLowerCase().includes(query) ||
        inv.customer_email?.toLowerCase().includes(query) ||
        inv.description?.toLowerCase().includes(query) ||
        inv.amount.toString().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "date":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "amount":
          comparison = parseFloat(a.amount.toString()) - parseFloat(b.amount.toString());
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    setFilteredInvoices(filtered);
  }, [invoices, statusFilter, searchQuery, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "expired":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-2 text-primary hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Generate and manage your invoices</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-icons-outlined">add</span>
            Create Invoice
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₦{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <span className="material-icons-outlined text-green-600 dark:text-green-400">trending_up</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₦{stats.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg">
                <span className="material-icons-outlined text-yellow-600 dark:text-yellow-400">schedule</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Paid This Month</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₦{stats.paidThisMonth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <span className="material-icons-outlined text-blue-600 dark:text-blue-400">calendar_today</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Overdue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.overdueCount}
                </p>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                <span className="material-icons-outlined text-red-600 dark:text-red-400">warning</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <span className="material-icons-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search invoices, customers, amounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            
            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto">
              {(["all", "pending", "paid", "expired", "cancelled"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === status
                      ? "bg-primary text-secondary"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Sort */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "amount" | "status")}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
                <option value="status">Sort by Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title={sortOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
              >
                <span className="material-icons-outlined text-sm">
                  {sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
                </span>
              </button>
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </div>
        </div>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-md text-center">
            <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
              receipt_long
            </span>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {invoices.length === 0 
                ? "No invoices yet" 
                : searchQuery || statusFilter !== "all"
                ? "No invoices match your filters"
                : "No invoices yet"}
            </p>
            {invoices.length === 0 && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
              >
                Create Your First Invoice
              </button>
            )}
            {(searchQuery || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => {
              const isOverdue = invoice.status === "pending" && invoice.due_date && new Date(invoice.due_date) < new Date();
              
              return (
              <div
                key={invoice.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {invoice.invoice_number}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          invoice.status
                        )}`}
                      >
                        {invoice.status.toUpperCase()}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <span className="material-icons-outlined text-sm">calendar_today</span>
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </div>
                      {invoice.due_date && (
                        <div className="flex items-center gap-1">
                          <span className="material-icons-outlined text-sm">event</span>
                          Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </div>
                      )}
                      {invoice.customer_name && (
                        <div className="flex items-center gap-1">
                          <span className="material-icons-outlined text-sm">person</span>
                          {invoice.customer_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {invoice.currency === "NGN" 
                        ? `₦${parseFloat(invoice.amount.toString()).toLocaleString()}`
                        : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                      }
                    </p>
                    {invoice.crypto_chain_id && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {invoice.crypto_chain_id.toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>

                {invoice.description && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{invoice.description}</p>
                  </div>
                )}

                {/* QR Code and Wallet Address for Crypto Invoices */}
                {invoice.status === "pending" && invoice.crypto_address && invoice.crypto_chain_id && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-400 mb-2">
                      Payment Wallet Address
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* QR Code */}
                      <div className="bg-white dark:bg-white p-3 rounded-lg border-2 border-blue-200 dark:border-blue-700 flex-shrink-0">
                        <QRCodeSVG
                          value={invoice.crypto_address}
                          size={120}
                          level="H"
                          includeMargin={true}
                          fgColor="#1a1a1a"
                          bgColor="#ffffff"
                        />
                      </div>
                      {/* Wallet Address */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Address:
                        </p>
                        <p className="text-xs font-mono text-gray-900 dark:text-white break-all">
                          {invoice.crypto_address}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Network: <span className="font-semibold">{invoice.crypto_chain_id}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href={`/invoice/${invoice.invoice_number}`}
                    className="flex items-center gap-2 bg-primary/10 text-primary font-semibold py-2 px-4 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-icons-outlined text-sm">visibility</span>
                    View
                  </Link>
                  {invoice.status === "pending" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEditInvoice(invoice);
                      }}
                      className="flex items-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold py-2 px-4 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      <span className="material-icons-outlined text-sm">edit</span>
                      Edit
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareInvoice(invoice.invoice_number);
                    }}
                    className="flex items-center gap-2 bg-secondary/10 text-secondary font-semibold py-2 px-4 rounded-lg hover:bg-secondary/20 transition-colors"
                  >
                    <span className="material-icons-outlined text-sm">share</span>
                    Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownloadPDF(invoice.invoice_number);
                    }}
                    className="flex items-center gap-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold py-2 px-4 rounded-lg hover:bg-purple-500/20 transition-colors"
                  >
                    <span className="material-icons-outlined text-sm">download</span>
                    PDF
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(invoice);
                    }}
                    className="flex items-center gap-2 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold py-2 px-4 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                    Delete
                  </button>
                  {invoice.status === "paid" && invoice.metadata?.marked_paid_by && (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full ml-auto">
                      <span className="material-icons-outlined text-sm">check_circle</span>
                      Marked paid by receiver
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {/* Create Invoice Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowCreateForm(false);
              setActiveTab("NGN");
            }}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border-2 border-primary/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Invoice</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
                </div>

              <form onSubmit={handleCreateInvoice} className="space-y-4">
                {/* Invoice Type Toggle */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Invoice Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, invoiceType: "personal" })}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        formData.invoiceType === "personal"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, invoiceType: "business" })}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        formData.invoiceType === "business"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {formData.invoiceType === "personal" 
                      ? "Invoice will show your personal name and email"
                      : "Invoice will show your business information and logo"}
                  </p>
                </div>

                {/* Tab Selection */}
                <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("NGN");
                      setFormData({ 
                        ...formData, 
                        currency: "NGN", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      activeTab === "NGN"
                        ? "border-b-2 border-primary text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    NGN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("Crypto");
                      setFormData({ 
                        ...formData, 
                        currency: "", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      activeTab === "Crypto"
                        ? "border-b-2 border-primary text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Crypto
                  </button>
                </div>

                {activeTab === "NGN" ? (
                  /* NGN Tab Content */
                  <div>
                    {/* Amount will be calculated from line items */}
                  </div>
                ) : (
                  /* Crypto Tab Content */
                  <div className="space-y-4">
                    {/* Step 1: Select Chain/Network */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Network/Chain *
                      </label>
                      <div className="relative" ref={chainDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 pl-10 pr-10 focus:ring-2 focus:ring-primary focus:border-primary flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {formData.cryptoChainId && getChainLogo(formData.cryptoChainId) ? (
                              <img
                                src={getChainLogo(formData.cryptoChainId)}
                                alt={SUPPORTED_CHAINS[formData.cryptoChainId]?.name || formData.cryptoChainId}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                            )}
                            <span className="text-sm truncate">
                              {formData.cryptoChainId 
                                ? SUPPORTED_CHAINS[formData.cryptoChainId]?.name 
                                : "Select a network"}
                            </span>
                          </div>
                          <span className="material-icons-outlined text-gray-400 text-sm flex-shrink-0">
                            {isChainDropdownOpen ? "expand_less" : "expand_more"}
                          </span>
                        </button>

                        {isChainDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-lg max-h-64 overflow-y-auto">
                            {Object.values(SUPPORTED_CHAINS).map((chain) => {
                              const logoUrl = getChainLogo(chain.id);
                              const isSelected = formData.cryptoChainId === chain.id;
                              return (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() => {
                                    const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                                    setFormData({
                                      ...formData,
                                      cryptoChainId: chain.id,
                                      cryptoToken: "",
                                      cryptoAddress: walletAddresses[chain.id] || "",
                                      amount: "",
                                    });
                                    setIsChainDropdownOpen(false);
                                  }}
                                  className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                      : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                  }`}
                                >
                                  {logoUrl ? (
                                    <img
                                      src={logoUrl}
                                      alt={chain.name}
                                      className="w-5 h-5 rounded-full flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                  )}
                                  <span className={`text-sm font-medium flex-1 text-left ${
                                    isSelected
                                      ? "text-primary dark:text-primary"
                                      : "text-gray-900 dark:text-white"
                                  }`}>
                                    {chain.name}
                                  </span>
                                  {isSelected && (
                                    <span className="material-icons-outlined text-primary text-sm">
                                      check
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Select Token (only shown if chain is selected) */}
                    {formData.cryptoChainId && (() => {
                      // Build available tokens list
                      const availableTokens: Array<{ symbol: string; label: string }> = [];
                      
                      // Add native token
                      if (SUPPORTED_CHAINS[formData.cryptoChainId]?.nativeCurrency?.symbol) {
                        const nativeSymbol = SUPPORTED_CHAINS[formData.cryptoChainId].nativeCurrency!.symbol;
                        availableTokens.push({
                          symbol: nativeSymbol,
                          label: `${nativeSymbol} (Native)`
                        });
                      }
                      
                      // Add stablecoins
                      availableTokens.push({ symbol: "USDC", label: "USDC" });
                      availableTokens.push({ symbol: "USDT", label: "USDT" });
                      
                      // Add SEND token only for Base
                      if (formData.cryptoChainId === "base") {
                        availableTokens.push({ symbol: "SEND", label: "SEND Token" });
                      }
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Select Token *
                          </label>
                          <div className="relative" ref={tokenDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 pl-10 pr-10 focus:ring-2 focus:ring-primary focus:border-primary flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {formData.cryptoToken && getTokenLogo(formData.cryptoToken) ? (
                                  <img
                                    src={getTokenLogo(formData.cryptoToken)}
                                    alt={formData.cryptoToken}
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                )}
                                <span className="text-sm truncate">
                                  {formData.cryptoToken 
                                    ? availableTokens.find(t => t.symbol === formData.cryptoToken)?.label
                                    : "Select a token"}
                                </span>
                              </div>
                              <span className="material-icons-outlined text-gray-400 text-sm flex-shrink-0">
                                {isTokenDropdownOpen ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {isTokenDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-lg max-h-64 overflow-y-auto">
                                {availableTokens.map((token) => {
                                  const logoUrl = getTokenLogo(token.symbol);
                                  const isSelected = formData.cryptoToken === token.symbol;
                                  return (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ 
                                          ...formData, 
                                          cryptoToken: token.symbol,
                                          amount: "",
                                        });
                                        setIsTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                        isSelected
                                          ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                      }`}
                                    >
                                      {logoUrl ? (
                                        <img
                                          src={logoUrl}
                                          alt={token.symbol}
                                          className="w-5 h-5 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                      )}
                                      <span className={`text-sm font-medium flex-1 text-left ${
                                        isSelected
                                          ? "text-primary dark:text-primary"
                                          : "text-gray-900 dark:text-white"
                                      }`}>
                                        {token.label}
                                      </span>
                                      {isSelected && (
                                        <span className="material-icons-outlined text-primary text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {formData.cryptoChainId === "base" && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              💡 SEND token is only available on Base network
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Amount will be calculated from line items */}

                    {/* Wallet Address Input */}
                    {formData.cryptoChainId && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Wallet Address (Optional)
                          </label>
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[formData.cryptoChainId] || "";
                            const isUsingDefault = formData.cryptoAddress === defaultAddress;
                            
                            if (defaultAddress && !isUsingDefault) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, cryptoAddress: defaultAddress });
                                  }}
                                  className="text-xs text-primary hover:underline font-semibold"
                                >
                                  Use my wallet address
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <input
                          type="text"
                          value={formData.cryptoAddress}
                          onChange={(e) => setFormData({ ...formData, cryptoAddress: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                          placeholder="Enter custom wallet address (optional)"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[formData.cryptoChainId] || "";
                            if (defaultAddress) {
                              return `If left empty, will use your ${formData.cryptoChainId} wallet: ${defaultAddress.slice(0, 6)}...${defaultAddress.slice(-4)}`;
                            }
                            return "Enter a custom wallet address (optional). If empty, you'll need to add a wallet address in your crypto dashboard first.";
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Line Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Items
                    </label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-sm">add</span>
                      Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="Item description"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateLineItem(item.id, "amount", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="Amount"
                          />
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="mt-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                            title="Remove item"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Display */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total:
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {activeTab === "NGN" 
                          ? `₦${calculateTotal(lineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${calculateTotal(lineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${formData.cryptoToken || ""}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Optional Description Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    rows={2}
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="+234..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setActiveTab("NGN");
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {editingInvoice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setEditingInvoice(null);
              setEditActiveTab("NGN");
            }}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border-2 border-primary/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Invoice</h2>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setEditActiveTab("NGN");
                  }}
                  className="text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateInvoice} className="space-y-4">
                {/* Invoice Type Toggle */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Invoice Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, invoiceType: "personal" })}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        editFormData.invoiceType === "personal"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, invoiceType: "business" })}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        editFormData.invoiceType === "business"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {editFormData.invoiceType === "personal" 
                      ? "Invoice will show your personal name and email"
                      : "Invoice will show your business information and logo"}
                  </p>
                </div>

                {/* Tab Selection */}
                <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setEditActiveTab("NGN");
                      setEditFormData({ 
                        ...editFormData, 
                        currency: "NGN", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      editActiveTab === "NGN"
                        ? "border-b-2 border-primary text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    NGN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditActiveTab("Crypto");
                      setEditFormData({ 
                        ...editFormData, 
                        currency: "", 
                        cryptoChainId: "", 
                        cryptoToken: "", 
                        cryptoAddress: "",
                        amount: "",
                      });
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${
                      editActiveTab === "Crypto"
                        ? "border-b-2 border-primary text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Crypto
                  </button>
                </div>

                {editActiveTab === "NGN" ? (
                  <div>
                    {/* Amount will be calculated from line items */}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Network/Chain *
                      </label>
                      <div className="relative" ref={editChainDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsEditChainDropdownOpen(!isEditChainDropdownOpen)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 pl-10 pr-10 focus:ring-2 focus:ring-primary focus:border-primary flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {editFormData.cryptoChainId && getChainLogo(editFormData.cryptoChainId) ? (
                              <img
                                src={getChainLogo(editFormData.cryptoChainId)}
                                alt={SUPPORTED_CHAINS[editFormData.cryptoChainId]?.name || editFormData.cryptoChainId}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                            )}
                            <span className="text-sm truncate">
                              {editFormData.cryptoChainId 
                                ? SUPPORTED_CHAINS[editFormData.cryptoChainId]?.name 
                                : "Select a network"}
                            </span>
                          </div>
                          <span className="material-icons-outlined text-gray-400 text-sm flex-shrink-0">
                            {isEditChainDropdownOpen ? "expand_less" : "expand_more"}
                          </span>
                        </button>

                        {isEditChainDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-lg max-h-64 overflow-y-auto">
                            {Object.values(SUPPORTED_CHAINS).map((chain) => {
                              const logoUrl = getChainLogo(chain.id);
                              const isSelected = editFormData.cryptoChainId === chain.id;
                              return (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() => {
                                    const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                                    setEditFormData({
                                      ...editFormData,
                                      cryptoChainId: chain.id,
                                      cryptoToken: "",
                                      cryptoAddress: walletAddresses[chain.id] || "",
                                      amount: "",
                                    });
                                    setIsEditChainDropdownOpen(false);
                                  }}
                                  className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                      : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                  }`}
                                >
                                  {logoUrl ? (
                                    <img
                                      src={logoUrl}
                                      alt={chain.name}
                                      className="w-5 h-5 rounded-full flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                  )}
                                  <span className={`text-sm font-medium flex-1 text-left ${
                                    isSelected
                                      ? "text-primary dark:text-primary"
                                      : "text-gray-900 dark:text-white"
                                  }`}>
                                    {chain.name}
                                  </span>
                                  {isSelected && (
                                    <span className="material-icons-outlined text-primary text-sm">
                                      check
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {editFormData.cryptoChainId && (() => {
                      // Build available tokens list
                      const availableTokens: Array<{ symbol: string; label: string }> = [];
                      
                      // Add native token
                      if (SUPPORTED_CHAINS[editFormData.cryptoChainId]?.nativeCurrency?.symbol) {
                        const nativeSymbol = SUPPORTED_CHAINS[editFormData.cryptoChainId].nativeCurrency!.symbol;
                        availableTokens.push({
                          symbol: nativeSymbol,
                          label: `${nativeSymbol} (Native)`
                        });
                      }
                      
                      // Add stablecoins
                      availableTokens.push({ symbol: "USDC", label: "USDC" });
                      availableTokens.push({ symbol: "USDT", label: "USDT" });
                      
                      // Add SEND token only for Base
                      if (editFormData.cryptoChainId === "base") {
                        availableTokens.push({ symbol: "SEND", label: "SEND Token" });
                      }
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Select Token *
                          </label>
                          <div className="relative" ref={editTokenDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsEditTokenDropdownOpen(!isEditTokenDropdownOpen)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 pl-10 pr-10 focus:ring-2 focus:ring-primary focus:border-primary flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {editFormData.cryptoToken && getTokenLogo(editFormData.cryptoToken) ? (
                                  <img
                                    src={getTokenLogo(editFormData.cryptoToken)}
                                    alt={editFormData.cryptoToken}
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                )}
                                <span className="text-sm truncate">
                                  {editFormData.cryptoToken 
                                    ? availableTokens.find(t => t.symbol === editFormData.cryptoToken)?.label
                                    : "Select a token"}
                                </span>
                              </div>
                              <span className="material-icons-outlined text-gray-400 text-sm flex-shrink-0">
                                {isEditTokenDropdownOpen ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {isEditTokenDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-gray-600 shadow-lg max-h-64 overflow-y-auto">
                                {availableTokens.map((token) => {
                                  const logoUrl = getTokenLogo(token.symbol);
                                  const isSelected = editFormData.cryptoToken === token.symbol;
                                  return (
                                    <button
                                      key={token.symbol}
                                      type="button"
                                      onClick={() => {
                                        setEditFormData({ 
                                          ...editFormData, 
                                          cryptoToken: token.symbol,
                                          amount: "",
                                        });
                                        setIsEditTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                        isSelected
                                          ? "bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                      }`}
                                    >
                                      {logoUrl ? (
                                        <img
                                          src={logoUrl}
                                          alt={token.symbol}
                                          className="w-5 h-5 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0"></div>
                                      )}
                                      <span className={`text-sm font-medium flex-1 text-left ${
                                        isSelected
                                          ? "text-primary dark:text-primary"
                                          : "text-gray-900 dark:text-white"
                                      }`}>
                                        {token.label}
                                      </span>
                                      {isSelected && (
                                        <span className="material-icons-outlined text-primary text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {editFormData.cryptoChainId === "base" && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              💡 SEND token is only available on Base network
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Amount will be calculated from line items */}

                    {/* Wallet Address Input */}
                    {editFormData.cryptoChainId && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Wallet Address (Optional)
                          </label>
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[editFormData.cryptoChainId] || "";
                            const isUsingDefault = editFormData.cryptoAddress === defaultAddress;
                            
                            if (defaultAddress && !isUsingDefault) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditFormData({ ...editFormData, cryptoAddress: defaultAddress });
                                  }}
                                  className="text-xs text-primary hover:underline font-semibold"
                                >
                                  Use my wallet address
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <input
                          type="text"
                          value={editFormData.cryptoAddress}
                          onChange={(e) => setEditFormData({ ...editFormData, cryptoAddress: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                          placeholder="Enter custom wallet address (optional)"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {(() => {
                            const walletAddresses = user?.wallet_addresses as Record<string, string> || {};
                            const defaultAddress = walletAddresses[editFormData.cryptoChainId] || "";
                            if (defaultAddress) {
                              return `If left empty, will use your ${editFormData.cryptoChainId} wallet: ${defaultAddress.slice(0, 6)}...${defaultAddress.slice(-4)}`;
                            }
                            return "Enter a custom wallet address (optional). If empty, you'll need to add a wallet address in your crypto dashboard first.";
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Line Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Items
                    </label>
                    <button
                      type="button"
                      onClick={addEditLineItem}
                      className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-sm">add</span>
                      Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {editLineItems.map((item, index) => (
                      <div key={item.id} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateEditLineItem(item.id, "description", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="Item description"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateEditLineItem(item.id, "amount", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="Amount"
                          />
                        </div>
                        {editLineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEditLineItem(item.id)}
                            className="mt-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                            title="Remove item"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Display */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total:
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {editActiveTab === "NGN" 
                          ? `₦${calculateTotal(editLineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${calculateTotal(editLineItems).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${editFormData.cryptoToken || ""}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Optional Description Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    rows={2}
                    placeholder="Additional notes or terms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.customerEmail}
                    onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="+234..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.dueDate}
                    onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingInvoice(null);
                      setEditActiveTab("NGN");
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isUpdating ? "Updating..." : "Update Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleCancelDelete}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border-2 border-red-200 dark:border-red-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <span className="material-icons-outlined text-red-600 dark:text-red-400 text-2xl">
                  warning
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Invoice</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-gray-900 dark:text-white mb-2">
                Are you sure you want to delete invoice <span className="font-semibold">{invoiceToDelete.invoice_number}</span>?
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Amount: {invoiceToDelete.currency === "NGN" 
                  ? `₦${parseFloat(invoiceToDelete.amount.toString()).toLocaleString()}`
                  : `${parseFloat(invoiceToDelete.amount.toString()).toLocaleString()} ${invoiceToDelete.currency}`
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={deletingInvoice !== null}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingInvoice !== null}
                className="flex-1 bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingInvoice === invoiceToDelete.invoice_number ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-sm">delete</span>
                    Delete Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
