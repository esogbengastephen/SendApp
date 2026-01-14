"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getUserFromStorage } from "@/lib/session";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { getChainLogo } from "@/lib/logos";
import dynamic from "next/dynamic";

// Lazy load QRCode component to reduce initial bundle
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), {
  ssr: false,
  loading: () => <div className="w-48 h-48 flex items-center justify-center">Loading QR...</div>,
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
}

interface Merchant {
  name: string;
  email: string;
  photoUrl: string | null;
  invoiceType?: "personal" | "business";
  businessName?: string | null;
  businessLogoUrl?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessState?: string | null;
  businessZip?: string | null;
  businessPhone?: string | null;
}

function InvoiceDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceNumber = params.invoiceNumber as string;
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantWalletAddresses, setMerchantWalletAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  useEffect(() => {
    const currentUser = getUserFromStorage();
    setUser(currentUser);
    fetchInvoice();
    
    // Check if user returned from payment
    const paymentStatus = searchParams.get("payment");
    const reference = searchParams.get("reference");
    
    if (paymentStatus === "success" || reference) {
      // Wait a bit for webhook to process, then check invoice status
      setTimeout(() => {
        checkPaymentStatus(reference);
      }, 2000);
    }
  }, [invoiceNumber, searchParams]);
  
  const checkPaymentStatus = async (reference?: string | null) => {
    setIsCheckingPayment(true);
    try {
      // Fetch latest invoice status
      await fetchInvoice();
      
      // If reference provided, verify payment
      if (reference) {
        const response = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await response.json();
        
        if (data.success && data.data?.status === "success") {
          setToast({
            message: "Payment successful! Invoice has been marked as paid.",
            type: "success",
            isVisible: true,
          });
          // Refresh invoice after a moment
          setTimeout(() => {
            fetchInvoice();
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const user = getUserFromStorage();
      const url = user
        ? `/api/invoices/${invoiceNumber}?email=${encodeURIComponent(user.email)}`
        : `/api/invoices/${invoiceNumber}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        console.log("Invoice data:", data.invoice);
        console.log("Crypto address:", data.invoice?.crypto_address);
        console.log("Crypto chain ID:", data.invoice?.crypto_chain_id);
        console.log("Invoice status:", data.invoice?.status);
        setInvoice(data.invoice);
        if (data.merchant) {
          setMerchant(data.merchant);
        }
        
        // Check if current user is the invoice owner
        const currentUser = getUserFromStorage();
        if (currentUser && data.invoice) {
          // Check if user email matches merchant email or if user_id matches
          const userIsOwner = currentUser.email === data.merchant?.email || 
                             (currentUser.id && data.invoice.user_id === currentUser.id);
          setIsOwner(userIsOwner);
        }
        
        // Fetch merchant's wallet addresses if invoice doesn't have crypto_address
        if (data.invoice && !data.invoice.crypto_address && data.invoice.crypto_chain_id && data.invoice.user_id) {
          fetchMerchantWalletAddresses(data.invoice.user_id, data.invoice.crypto_chain_id);
        }
      } else {
        setToast({
          message: data.error || "Invoice not found",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      setToast({
        message: "Failed to fetch invoice",
        type: "error",
        isVisible: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantWalletAddresses = async (merchantUserId: string, chainId: string) => {
    try {
      const response = await fetch(`/api/user/profile?userId=${merchantUserId}`);
      const data = await response.json();
      
      if (data.success && data.profile && data.profile.addresses) {
        setMerchantWalletAddresses(data.profile.addresses);
        console.log("Fetched merchant wallet addresses:", data.profile.addresses);
      }
    } catch (error) {
      console.error("Error fetching merchant wallet addresses:", error);
    }
  };

  // Get the effective wallet address (from invoice or merchant's dashboard)
  const getEffectiveWalletAddress = () => {
    if (!invoice || !invoice.crypto_chain_id) return null;
    
    // If invoice has a wallet address, use it
    if (invoice.crypto_address && invoice.crypto_address.trim() !== "") {
      return invoice.crypto_address;
    }
    
    // Otherwise, try to use merchant's wallet address for the chain
    return merchantWalletAddresses[invoice.crypto_chain_id] || null;
  };

  const handlePayInvoice = async () => {
    if (!user) {
      setToast({
        message: "Please log in to pay this invoice",
        type: "error",
        isVisible: true,
      });
      router.push("/auth");
      return;
    }

    setIsPaying(true);
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
        setIsPaying(false);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setToast({
        message: "Failed to process payment",
        type: "error",
        isVisible: true,
      });
      setIsPaying(false);
    }
  };

  const handleCopyWalletAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setToast({
        message: "Wallet address copied to clipboard!",
        type: "success",
        isVisible: true,
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error("Error copying wallet address:", error);
      setToast({
        message: "Failed to copy wallet address",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleShareInvoice = async () => {
    const shareUrl = window.location.href;
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

  const handleSendInvoice = async () => {
    const shareUrl = window.location.href;
    try {
      // Try to use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoice?.invoice_number}`,
          text: `Please find the invoice ${invoice?.invoice_number} for ${invoice?.currency === "NGN" ? `₦${parseFloat(invoice?.amount?.toString() || "0").toLocaleString()}` : `${parseFloat(invoice?.amount?.toString() || "0").toLocaleString()} ${invoice?.currency}`}`,
          url: shareUrl,
        });
        setToast({
          message: "Invoice shared successfully!",
          type: "success",
          isVisible: true,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setToast({
          message: "Invoice link copied to clipboard! You can now send it via email or messaging app.",
          type: "success",
          isVisible: true,
        });
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== "AbortError") {
        console.error("Error sharing invoice:", error);
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          setToast({
            message: "Invoice link copied to clipboard!",
            type: "success",
            isVisible: true,
          });
        } catch (clipboardError) {
          setToast({
            message: shareUrl,
            type: "info",
            isVisible: true,
          });
        }
      }
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoice || !invoiceRef.current) {
      setToast({
        message: "Invoice data not available",
        type: "error",
        isVisible: true,
      });
      return;
    }

    try {
      setToast({
        message: "Generating PDF...",
        type: "info",
        isVisible: true,
      });

      // Dynamically import the libraries
      const [{ default: jsPDF }, html2canvas] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      // Get the invoice card element
      const invoiceElement = invoiceRef.current;
      
      if (!invoiceElement) {
        throw new Error("Invoice element not found");
      }

      // A4 dimensions in pixels (at 96 DPI)
      // A4: 210mm x 297mm = 8.27" x 11.69" = 794px x 1123px (at 96 DPI)
      const A4_WIDTH_PX = 794;
      const A4_HEIGHT_PX = 1123;
      
      // Store original styles
      const originalMaxWidth = invoiceElement.style.maxWidth;
      const originalWidth = invoiceElement.style.width;
      const originalBoxSizing = invoiceElement.style.boxSizing;
      
      // Temporarily constrain width for PDF generation
      invoiceElement.style.maxWidth = `${A4_WIDTH_PX}px`;
      invoiceElement.style.width = `${A4_WIDTH_PX}px`;
      invoiceElement.style.boxSizing = 'border-box';
      
      // Also constrain all child elements to prevent overflow
      const allChildren = invoiceElement.querySelectorAll('*');
      const originalChildStyles: Array<{ element: HTMLElement; maxWidth: string; width: string; boxSizing: string }> = [];
      
      allChildren.forEach((child) => {
        const htmlChild = child as HTMLElement;
        originalChildStyles.push({
          element: htmlChild,
          maxWidth: htmlChild.style.maxWidth,
          width: htmlChild.style.width,
          boxSizing: htmlChild.style.boxSizing,
        });
        // Ensure no child exceeds parent width
        htmlChild.style.maxWidth = '100%';
        htmlChild.style.boxSizing = 'border-box';
      });
      
      // Wait a moment for styles to apply
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Get the actual element dimensions after constraint
      const elementWidth = Math.min(invoiceElement.scrollWidth, A4_WIDTH_PX);
      const elementHeight = invoiceElement.scrollHeight;
      
      // Create canvas from the invoice element with proper scaling
      const canvas = await html2canvas.default(invoiceElement, {
        scale: 2, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: elementWidth,
        height: elementHeight,
        windowWidth: elementWidth,
        windowHeight: elementHeight,
        allowTaint: false,
        removeContainer: false,
      });
      
      // Restore original styles
      invoiceElement.style.maxWidth = originalMaxWidth;
      invoiceElement.style.width = originalWidth;
      invoiceElement.style.boxSizing = originalBoxSizing;
      
      // Restore child element styles
      originalChildStyles.forEach(({ element, maxWidth, width, boxSizing }) => {
        element.style.maxWidth = maxWidth;
        element.style.width = width;
        element.style.boxSizing = boxSizing;
      });

      // Calculate PDF dimensions (A4 size in mm)
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      
      // Calculate the aspect ratio and scale to fit width
      const canvasAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = pdfWidth / pdfHeight;
      
      let imgWidth = pdfWidth;
      let imgHeight = pdfWidth / canvasAspectRatio;
      
      // If height exceeds page, scale to fit height instead
      if (imgHeight > pdfHeight) {
        imgHeight = pdfHeight;
        imgWidth = pdfHeight * canvasAspectRatio;
      }
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // If content fits on one page
      if (imgHeight <= pdfHeight) {
        // Center horizontally if width is less than page width
        const xOffset = imgWidth < pdfWidth ? (pdfWidth - imgWidth) / 2 : 0;
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', xOffset, 0, imgWidth, imgHeight);
      } else {
        // Multi-page handling
        let heightLeft = imgHeight;
        let position = 0;
        const xOffset = imgWidth < pdfWidth ? (pdfWidth - imgWidth) / 2 : 0;

        // Add first page
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', xOffset, position, imgWidth, pdfHeight);
        heightLeft -= pdfHeight;

        // Add additional pages if needed
        while (heightLeft > 0) {
          position = -heightLeft;
          pdf.addPage();
          const pageHeight = Math.min(pdfHeight, heightLeft);
          pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', xOffset, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
      }

      // Download the PDF
      const fileName = `Invoice-${invoice.invoice_number}.pdf`;
      pdf.save(fileName);

      setToast({
        message: "Invoice downloaded successfully!",
        type: "success",
        isVisible: true,
      });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      
      // Check if it's a module not found error
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        setToast({
          message: "PDF libraries not installed. Please run 'npm install' first.",
          type: "error",
          isVisible: true,
        });
        return;
      }

      // Fallback to print dialog if libraries fail to load
      try {
        const invoiceUrl = window.location.href;
        const printWindow = window.open(invoiceUrl, '_blank');
        
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
          setToast({
            message: "Opening print dialog as fallback...",
            type: "info",
            isVisible: true,
          });
        } else {
          setToast({
            message: "Failed to generate PDF. Please use your browser's print function (Ctrl+P / Cmd+P)",
            type: "error",
            isVisible: true,
          });
        }
      } catch (fallbackError) {
        setToast({
          message: "Failed to generate PDF. Please try again or use browser print function.",
          type: "error",
          isVisible: true,
        });
      }
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    setIsMarkingPaid(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.invoice_number)}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: invoice.customer_email || user?.email,
          customerName: invoice.customer_name || user?.display_name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: "Invoice marked as paid! The sender has been notified.",
          type: "success",
          isVisible: true,
        });
        // Refresh invoice after a moment
        setTimeout(() => {
          fetchInvoice();
        }, 1000);
      } else {
        setToast({
          message: data.error || "Failed to mark invoice as paid",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      setToast({
        message: "Failed to mark invoice as paid",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

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

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
            receipt_long
          </span>
          <p className="text-gray-600 dark:text-gray-400">Invoice not found</p>
          <button
            onClick={() => router.push("/invoice")}
            className="mt-4 bg-primary text-secondary font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .invoice-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .invoice-card {
            box-shadow: none !important;
            border: 2px solid #93c5fd !important;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          button {
            display: none !important;
          }
          .no-print-button {
            display: none !important;
          }
          /* Ensure invoice fits on one page */
          @page {
            size: A4;
            margin: 0;
          }
          /* Hide dark mode styles in print */
          .dark\\:bg-white {
            background: white !important;
          }
          .dark\\:text-white {
            color: #1f2937 !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 pb-24">
        <div className="max-w-4xl mx-auto invoice-container">
        {/* Header */}
        <div className="mb-6 no-print">
          <button
            onClick={() => router.push("/invoice")}
            className="mb-2 text-primary hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            <span className="material-icons-outlined">arrow_back</span>
            Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Details</h1>
            <button
              onClick={handleShareInvoice}
              className="bg-secondary/10 text-secondary font-semibold py-2 px-3 rounded-lg hover:bg-secondary/20 transition-colors flex items-center gap-2"
            >
              <span className="material-icons-outlined text-sm">share</span>
              Share
            </button>
          </div>
        </div>

        {/* Invoice Card - Professional Invoice Layout (Single Page Design) */}
        <div ref={invoiceRef} className="bg-white dark:bg-white rounded-lg shadow-lg border-2 border-blue-200" style={{ maxWidth: '794px', width: '100%', boxSizing: 'border-box', padding: '40px', minHeight: '1123px' }}>
          {/* Header Section: Company/Logo (Left) and INVOICE Title (Right) */}
          <div className="mb-8 pb-6 border-b-2 border-blue-300">
            <div className="flex items-start justify-between">
              {/* Left: Company/Personal Info */}
              <div className="flex-1">
                {merchant && (
                  <>
                    {(invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessLogoUrl ? (
                      <div className="mb-4">
                        <img
                          src={merchant.businessLogoUrl}
                          alt={merchant.businessName || "Business Logo"}
                          className="h-16 w-auto object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <p className="text-lg font-bold text-gray-900 mb-2">
                      {(invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessName 
                        ? merchant.businessName 
                        : merchant.name}
                    </p>
                    {((invoice?.invoice_type || merchant.invoiceType) === "business" && merchant.businessAddress) ? (
                      <div className="text-sm text-gray-700 space-y-0.5">
                        {merchant.businessAddress && <p>{merchant.businessAddress}</p>}
                        {(merchant.businessCity || merchant.businessState || merchant.businessZip) && (
                          <p>
                            {[merchant.businessCity, merchant.businessState, merchant.businessZip]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {merchant.businessPhone && <p>Phone: {merchant.businessPhone}</p>}
                        <p className="text-gray-600">{merchant.email}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">{merchant.email}</p>
                    )}
                  </>
                )}
              </div>
              
              {/* Right: INVOICE Title and Details Table */}
              <div className="text-right">
                <h2 className="text-4xl font-bold text-blue-600 mb-4">INVOICE</h2>
                <table className="border-collapse border border-blue-300 text-sm">
                  <thead>
                    <tr>
                      <th className="bg-blue-100 border border-blue-300 px-3 py-2 text-left font-semibold text-gray-900">INVOICE #</th>
                      <th className="bg-blue-100 border border-blue-300 px-3 py-2 text-left font-semibold text-gray-900">DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-blue-300 px-3 py-2 text-gray-900">{invoice.invoice_number}</td>
                      <td className="border border-blue-300 px-3 py-2 text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</td>
                    </tr>
                  </tbody>
                </table>
                <span
                  className={`inline-block mt-3 px-3 py-1 rounded text-xs font-semibold ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          {(invoice.customer_name || invoice.customer_email || invoice.customer_phone) && (
            <div className="mb-6 pb-4">
              <div className="bg-blue-100 px-3 py-2 mb-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  BILL TO
                </p>
              </div>
              <div className="space-y-1 text-sm text-gray-900">
                {invoice.customer_name && (
                  <p className="font-semibold">{invoice.customer_name}</p>
                )}
                {invoice.customer_email && (
                  <p>{invoice.customer_email}</p>
                )}
                {invoice.customer_phone && (
                  <p>{invoice.customer_phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-blue-300 text-sm">
              <thead>
                <tr>
                  <th className="bg-blue-100 border border-blue-300 px-4 py-3 text-left font-semibold text-gray-900">DESCRIPTION</th>
                  <th className="bg-blue-100 border border-blue-300 px-4 py-3 text-right font-semibold text-gray-900">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Check if invoice has line items in metadata
                  const lineItems = (invoice as any).metadata?.lineItems || [];
                  
                  if (lineItems.length > 0) {
                    // Display line items
                    return (
                      <>
                        {lineItems.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="border border-blue-300 px-4 py-3 text-gray-900">
                              <p className="font-semibold">{item.description}</p>
                              {invoice.crypto_chain_id && index === 0 && (
                                <p className="text-xs text-gray-600 mt-1">Network: {invoice.crypto_chain_id.toUpperCase()}</p>
                              )}
                            </td>
                            <td className="border border-blue-300 px-4 py-3 text-right text-gray-900 font-semibold">
                              {invoice.currency === "NGN" 
                                ? `₦${parseFloat(item.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `${parseFloat(item.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                              }
                            </td>
                          </tr>
                        ))}
                        {/* Empty rows for spacing if needed */}
                        {lineItems.length < 5 && Array.from({ length: Math.max(0, 5 - lineItems.length) }).map((_, i) => (
                          <tr key={`empty-${i}`}>
                            <td className="border border-blue-300 px-4 py-3"></td>
                            <td className="border border-blue-300 px-4 py-3"></td>
                          </tr>
                        ))}
                      </>
                    );
                  } else {
                    // Fallback to single description (backward compatibility)
                    return (
                      <>
                        <tr>
                          <td className="border border-blue-300 px-4 py-3 text-gray-900">
                            <p className="font-semibold">{invoice.description || "Service Payment"}</p>
                            {invoice.crypto_chain_id && (
                              <p className="text-xs text-gray-600 mt-1">Network: {invoice.crypto_chain_id.toUpperCase()}</p>
                            )}
                          </td>
                          <td className="border border-blue-300 px-4 py-3 text-right text-gray-900 font-semibold">
                            {invoice.currency === "NGN" 
                              ? `₦${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                            }
                          </td>
                        </tr>
                        {/* Empty rows for spacing */}
                        {Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="border border-blue-300 px-4 py-3"></td>
                            <td className="border border-blue-300 px-4 py-3"></td>
                          </tr>
                        ))}
                      </>
                    );
                  }
                })()}
                {/* Total Row */}
                <tr>
                  <td className="border border-blue-300 px-4 py-3 italic text-gray-700">
                    Thank you for your business!
                  </td>
                  <td className="border border-blue-300 px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-gray-900">TOTAL</span>
                      <span className="font-bold text-lg text-gray-900">
                        {invoice.currency === "NGN" 
                          ? `₦${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${invoice.currency}`
                        }
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            {invoice.due_date && (
              <p className="text-xs text-gray-600 mt-2">
                Due Date: {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Crypto Payment Instructions - Compact for single page */}
          {invoice.crypto_chain_id && invoice.currency !== "NGN" && invoice.status === "pending" && (() => {
            const effectiveAddress = getEffectiveWalletAddress();
            if (!effectiveAddress || effectiveAddress.trim() === "") return null;
            
            return (
              <div className="mb-6 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-2">Payment Instructions</p>
                <p className="text-xs text-blue-800 mb-2">
                  Send <span className="font-bold">{parseFloat(invoice.amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} {invoice.currency}</span> to the wallet address below:
                </p>
                <div className="flex items-start gap-3">
                  {effectiveAddress && (
                    <div className="bg-white p-2 rounded border border-blue-200 flex-shrink-0">
                      <QRCodeSVG
                        value={effectiveAddress}
                        size={100}
                        level="H"
                        includeMargin={true}
                        fgColor="#1a1a1a"
                        bgColor="#ffffff"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-mono text-blue-900 break-all flex-1">{effectiveAddress}</p>
                      <button
                        onClick={() => handleCopyWalletAddress(effectiveAddress)}
                        className="flex-shrink-0 p-1.5 rounded hover:bg-blue-100 transition-colors"
                        title="Copy wallet address"
                      >
                        <span className={`material-icons-outlined text-sm ${
                          copiedAddress ? "text-green-600" : "text-blue-600"
                        }`}>
                          {copiedAddress ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-700">Network:</span>
                      {getChainLogo(invoice.crypto_chain_id) && (
                        <img
                          src={getChainLogo(invoice.crypto_chain_id)}
                          alt={invoice.crypto_chain_id}
                          className="w-4 h-4 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="text-xs font-semibold text-blue-700">{invoice.crypto_chain_id.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="mt-auto pt-6 border-t border-blue-200 text-xs text-gray-600">
            <p className="mb-2">
              If you have any questions about this invoice, please contact{" "}
              {(invoice?.invoice_type || merchant?.invoiceType) === "business" && merchant?.businessPhone
                ? `${merchant.businessName || merchant.name}, ${merchant.businessPhone}, ${merchant.email}`
                : `${merchant?.name || "the sender"}, ${merchant?.email || ""}`}
            </p>
            <p className="text-right text-gray-500">
              Invoice Template © {new Date().getFullYear()} FlipPay
            </p>
          </div>

          {/* Action Buttons */}
          {invoice.status === "pending" && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 no-print">
              {isOwner ? (
                // Sender/Owner buttons: Send Invoice and Download Invoice
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleSendInvoice}
                    className="w-full bg-primary text-secondary font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <span className="material-icons-outlined">send</span>
                    Send Invoice
                  </button>
                  <button
                    onClick={handleDownloadInvoice}
                    className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-icons-outlined">download</span>
                    Download Invoice
                  </button>
                </div>
              ) : (
                // Receiver buttons: I Paid button
                <div className="space-y-3">
                  <button
                    onClick={handleMarkAsPaid}
                    disabled={isMarkingPaid}
                    className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isMarkingPaid ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">check_circle</span>
                        I Paid
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                    Click this button to notify the sender that you have made the payment
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* For owners, also show download button even if paid */}
          {invoice.status === "paid" && isOwner && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 no-print">
              <button
                onClick={handleDownloadInvoice}
                className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons-outlined">download</span>
                Download Invoice
              </button>
            </div>
          )}

          {invoice.status === "paid" && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                <span className="material-icons-outlined text-green-500 text-4xl mb-2">
                  check_circle
                </span>
                <p className="text-green-800 dark:text-green-400 font-semibold">
                  This invoice has been paid
                </p>
              </div>
            </div>
          )}

          {invoice.status === "expired" && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <span className="material-icons-outlined text-red-500 text-4xl mb-2">
                  error
                </span>
                <p className="text-red-800 dark:text-red-400 font-semibold">
                  This invoice has expired
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      </div>
    </>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <InvoiceDetailContent />
    </Suspense>
  );
}
