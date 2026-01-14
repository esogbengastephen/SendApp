"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";
import { getBettingNetworkLogo, getTelecomNetworkLogo, getTVNetworkLogo, getGiftCardNetworkLogo } from "@/lib/logos";

interface GiftCardProduct {
  id: number;
  name: string;
  brandName: string;
  logoUrl?: string;
}

interface UtilityFormProps {
  serviceId: string;
  serviceName: string;
  icon: string;
  networks?: string[];
  placeholder?: string;
  showPackageDropdown?: boolean; // For TV subscriptions
  productMap?: Record<string, GiftCardProduct>; // For gift card products from Reloadly
}

export default function UtilityForm({
  serviceId,
  serviceName,
  icon,
  networks = [],
  placeholder = "Enter phone number",
  showPackageDropdown = false,
  productMap = {},
}: UtilityFormProps) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0] || "");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [serviceSettings, setServiceSettings] = useState<any>(null);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target as Node)) {
        setIsNetworkDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchServiceSettings();
  }, [serviceId]);

  // Fetch packages when network is selected (for TV, Data, or Betting)
  useEffect(() => {
    if (showPackageDropdown && selectedNetwork && (serviceId === "tv" || serviceId === "data" || serviceId === "betting")) {
      if (serviceId === "tv") {
        fetchTVPackages(selectedNetwork);
      } else if (serviceId === "data") {
        fetchDataPackages(selectedNetwork);
      } else if (serviceId === "betting") {
        fetchBettingPackages(selectedNetwork);
      }
    }
  }, [selectedNetwork, showPackageDropdown, serviceId]);

  // Update amount when package is selected
  useEffect(() => {
    if (selectedPackage && packages.length > 0) {
      const pkg = packages.find(p => p.id === selectedPackage || p.name === selectedPackage);
      if (pkg && pkg.amount) {
        setAmount(pkg.amount.toString());
      }
    }
  }, [selectedPackage, packages]);

  useEffect(() => {
    if (amount && serviceSettings) {
      const amountNum = parseFloat(amount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const markup = serviceSettings.markup || 0;
        const total = amountNum + (amountNum * markup / 100);
        setCalculatedTotal(total);
      } else {
        setCalculatedTotal(0);
      }
    } else {
      setCalculatedTotal(0);
    }
  }, [amount, serviceSettings]);

  const fetchServiceSettings = async () => {
    setLoadingSettings(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/utility/service/${serviceId}`);
      const data = await response.json();
      
      if (data.success && data.service) {
        setServiceSettings(data.service);
        if (data.service.status !== "active") {
          setError(`${serviceName} service is currently unavailable`);
        }
      } else {
        // Use default settings if API fails
        const defaultSettings: Record<string, any> = {
          airtime: {
            id: "airtime",
            name: "Airtime",
            status: "active",
            markup: 2.5,
            minAmount: 50,
            maxAmount: 10000,
          },
          data: {
            id: "data",
            name: "Data Bundle",
            status: "active",
            markup: 3.0,
            minAmount: 100,
            maxAmount: 50000,
          },
          tv: {
            id: "tv",
            name: "Cable TV Subscription",
            status: "active",
            markup: 2.0,
            minAmount: 1000,
            maxAmount: 50000,
          },
          betting: {
            id: "betting",
            name: "Betting Wallet Funding",
            status: "active",
            markup: 2.5,
            minAmount: 100,
            maxAmount: 100000,
          },
          "gift-card-redeem": {
            id: "gift-card-redeem",
            name: "Gift Card Redeem",
            status: "active",
            markup: 5.0,
            minAmount: 500,
            maxAmount: 50000,
          },
        };
        
        const defaultService = defaultSettings[serviceId] || {
          id: serviceId,
          status: "active",
          markup: 0,
          minAmount: 0,
          maxAmount: 0,
        };
        
        setServiceSettings(defaultService);
      }
    } catch (error) {
      console.error("Error fetching service settings:", error);
      // Use default settings on error
      const defaultSettings: Record<string, any> = {
        airtime: {
          id: "airtime",
          name: "Airtime",
          status: "active",
          markup: 2.5,
          minAmount: 50,
          maxAmount: 10000,
        },
        data: {
          id: "data",
          name: "Data Bundle",
          status: "active",
          markup: 3.0,
          minAmount: 100,
          maxAmount: 50000,
        },
        tv: {
          id: "tv",
          name: "Cable TV Subscription",
          status: "active",
          markup: 2.0,
          minAmount: 1000,
          maxAmount: 50000,
        },
        betting: {
          id: "betting",
          name: "Betting Wallet Funding",
          status: "active",
          markup: 2.5,
          minAmount: 100,
          maxAmount: 100000,
        },
      };
      
      const defaultService = defaultSettings[serviceId] || {
        id: serviceId,
        status: "active",
        markup: 0,
        minAmount: 0,
        maxAmount: 0,
      };
      
      setServiceSettings(defaultService);
    } finally {
      setLoadingSettings(false);
    }
  };

  const validateForm = () => {
    if (!phoneNumber.trim()) {
      setError(serviceId === "gift-card-redeem" ? "Please enter a gift card code" : "Please enter a phone number");
      return false;
    }

    // Gift card code validation (different from phone number)
    if (serviceId === "gift-card-redeem") {
      // Basic gift card code validation (alphanumeric, 10-50 characters)
      const codeRegex = /^[A-Za-z0-9]{10,50}$/;
      const cleanedCode = phoneNumber.trim().replace(/\s/g, "");
      if (!codeRegex.test(cleanedCode)) {
        setError("Please enter a valid gift card code (10-50 alphanumeric characters)");
        return false;
      }
      // For gift card redemption, amount is not required (will be determined from code)
      return true;
    } else {
      // Basic phone number validation (Nigerian format)
      const phoneRegex = /^(0|\+234)[789][01]\d{8}$/;
      const cleanedPhone = phoneNumber.replace(/\s/g, "");
      if (!phoneRegex.test(cleanedPhone)) {
        setError("Please enter a valid Nigerian phone number");
        return false;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (serviceSettings) {
      const amountNum = parseFloat(amount);
      if (serviceSettings.minAmount && amountNum < serviceSettings.minAmount) {
        setError(`Minimum amount is ₦${serviceSettings.minAmount.toLocaleString()}`);
        return false;
      }
      if (serviceSettings.maxAmount && amountNum > serviceSettings.maxAmount) {
        setError(`Maximum amount is ₦${serviceSettings.maxAmount.toLocaleString()}`);
        return false;
      }
    }

    if (networks.length > 0 && !selectedNetwork) {
      setError("Please select a network");
      return false;
    }

    if (showPackageDropdown && !selectedPackage && !amount) {
      setError("Please select a package or enter an amount");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    const user = getUserFromStorage();
    if (!user) {
      router.push("/auth");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/utility/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId,
          phoneNumber: phoneNumber.replace(/\s/g, ""),
          network: selectedNetwork || null,
          packageId: selectedPackage || null,
          amount: serviceId === "gift-card-redeem" ? 0 : parseFloat(amount), // Amount will be determined from gift card code
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || `${serviceName} purchase successful!`);
        // Reset form
        setPhoneNumber("");
        setAmount("");
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setError(data.error || "Purchase failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Error processing purchase:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTVPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(`/api/utility/tv-packages?network=${encodeURIComponent(network)}`);
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load TV packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching TV packages:", error);
      setError("Failed to load TV packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchDataPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(`/api/utility/data-packages?network=${encodeURIComponent(network)}`);
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load data packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching data packages:", error);
      setError("Failed to load data packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchBettingPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(`/api/utility/betting-packages?network=${encodeURIComponent(network)}`);
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load betting packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching betting packages:", error);
      setError("Failed to load betting packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as Nigerian number
    if (digits.startsWith("234")) {
      return `+${digits}`;
    } else if (digits.startsWith("0")) {
      return digits;
    } else if (digits.length > 0) {
      return `0${digits}`;
    }
    return digits;
  };

  // Function to detect network from phone number
  const detectNetwork = (phone: string): string | null => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // Extract the first 4 digits (or first 5 for some special cases)
    let prefix = "";
    if (digits.startsWith("234")) {
      // International format: +2348012345678 -> extract 8012
      prefix = digits.substring(3, 7);
    } else if (digits.startsWith("0")) {
      // Local format: 08012345678 -> extract 0801
      prefix = digits.substring(0, 4);
    } else if (digits.length >= 4) {
      // No leading 0: 8012345678 -> extract 8012
      prefix = digits.substring(0, 4);
    }
    
    // Network prefix mapping (Nigerian networks)
    const networkPrefixes: Record<string, string[]> = {
      MTN: [
        "0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814",
        "0903", "0906", "0913", "0916", "07025", "07026", "0704"
      ],
      Airtel: [
        "0802", "0808", "0708", "0812", "0901", "0902", "0904", "0907", "0912"
      ],
      Glo: [
        "0805", "0807", "0705", "0815", "0811", "0905", "0915"
      ],
      "9mobile": [
        "0809", "0817", "0818", "0908", "0909"
      ],
    };
    
    // Check for 5-digit prefix first (MTN special cases)
    if (digits.length >= 5) {
      const fiveDigitPrefix = digits.startsWith("234") 
        ? digits.substring(3, 8) 
        : digits.substring(0, 5);
      
      if (networkPrefixes.MTN.includes(fiveDigitPrefix)) {
        return "MTN";
      }
    }
    
    // Check 4-digit prefix
    for (const [network, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(prefix)) {
        return network;
      }
    }
    
    return null;
  };

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phoneNumber && networks.length > 0) {
      const detectedNetwork = detectNetwork(phoneNumber);
      if (detectedNetwork && networks.includes(detectedNetwork)) {
        // Only auto-select if network is available for this service and different from current selection
        setSelectedNetwork((prev) => {
          if (prev !== detectedNetwork) {
            return detectedNetwork;
          }
          return prev;
        });
      }
    }
  }, [phoneNumber, networks]);

  if (loadingSettings || !serviceSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading service...</p>
        </div>
      </div>
    );
  }

  if (serviceSettings.status !== "active") {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
        <div className="text-center">
          <span className="material-icons-outlined text-6xl text-red-500 mb-4">error_outline</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Service Unavailable
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {serviceName} is currently disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-primary/10 dark:bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons-outlined text-primary text-4xl">{icon}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {serviceName}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {serviceId === "gift-card-redeem" 
              ? "Enter your gift card code to redeem its value" 
              : "Quick and secure transactions"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Network Selection */}
            {networks.length > 0 && (
              <div ref={networkDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select Network
                  {phoneNumber && detectNetwork(phoneNumber) && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                      (Auto-detected: {detectNetwork(phoneNumber)})
                    </span>
                  )}
                </label>
                {(serviceId === "betting" || serviceId === "airtime" || serviceId === "data" || serviceId === "tv" || serviceId === "gift-card-redeem") ? (
                  <>
                    {/* Custom dropdown with logos for betting, telecom, and TV networks */}
                    <button
                      type="button"
                      onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                      className={`w-full rounded-lg border ${
                        phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                          ? "border-green-500 dark:border-green-400"
                          : "border-slate-300 dark:border-slate-600"
                      } bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedNetwork && (
                          <div className="relative w-6 h-6">
                            {(() => {
                              let logoUrl = "";
                              if (serviceId === "betting") {
                                logoUrl = getBettingNetworkLogo(selectedNetwork);
                              } else if (serviceId === "airtime" || serviceId === "data") {
                                logoUrl = getTelecomNetworkLogo(selectedNetwork);
                              } else if (serviceId === "tv") {
                                logoUrl = getTVNetworkLogo(selectedNetwork);
                              } else if (serviceId === "gift-card-redeem") {
                                // Use Reloadly product logo if available, otherwise fallback to local logo
                                const product = productMap[selectedNetwork];
                                logoUrl = product?.logoUrl || getGiftCardNetworkLogo(selectedNetwork);
                              }
                              
                              const logoKey = `${serviceId}-${selectedNetwork}`;
                              const hasFailed = failedLogos.has(logoKey);
                              
                              return (
                                <>
                                  {logoUrl && !hasFailed ? (
                                    // Show actual logo if available
                                    <Image
                                      src={logoUrl}
                                      alt={selectedNetwork}
                                      width={24}
                                      height={24}
                                      className="rounded object-contain"
                                      unoptimized
                                      onError={() => {
                                        setFailedLogos(prev => new Set(prev).add(logoKey));
                                      }}
                                    />
                                  ) : (
                                    // Fallback - show letter only if logo failed or unavailable
                                    <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                      <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">{selectedNetwork.charAt(0)}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <span className="font-medium">{selectedNetwork || "Select a network"}</span>
                      </div>
                      <span className="material-icons-outlined text-sm text-slate-600 dark:text-slate-300">
                        {isNetworkDropdownOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {isNetworkDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 backdrop-blur-md rounded-lg border border-slate-300 dark:border-slate-600 shadow-lg max-h-64 overflow-y-auto">
                        {networks.map((network) => (
                          <button
                            key={network}
                            type="button"
                            onClick={() => {
                              setSelectedNetwork(network);
                              setIsNetworkDropdownOpen(false);
                            }}
                            className={`w-full p-3 flex items-center gap-3 transition-colors ${
                              selectedNetwork === network 
                                ? "bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40" 
                                : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <div className="relative w-6 h-6">
                              {(() => {
                                let logoUrl = "";
                                if (serviceId === "betting") {
                                  logoUrl = getBettingNetworkLogo(network);
                                } else if (serviceId === "airtime" || serviceId === "data") {
                                  logoUrl = getTelecomNetworkLogo(network);
                                } else if (serviceId === "tv") {
                                  logoUrl = getTVNetworkLogo(network);
                                } else if (serviceId === "gift-card-redeem") {
                                  // Use Reloadly product logo if available, otherwise fallback to local logo
                                  const product = productMap[network];
                                  logoUrl = product?.logoUrl || getGiftCardNetworkLogo(network);
                                }
                                
                                const logoKey = `${serviceId}-${network}`;
                                const hasFailed = failedLogos.has(logoKey);
                                
                                return (
                                  <>
                                    {logoUrl && !hasFailed ? (
                                      // Show actual logo if available
                                      <Image
                                        src={logoUrl}
                                        alt={network}
                                        width={24}
                                        height={24}
                                        className="rounded object-contain"
                                        unoptimized
                                        onError={() => {
                                          setFailedLogos(prev => new Set(prev).add(logoKey));
                                        }}
                                      />
                                    ) : (
                                      // Fallback - show letter only if logo failed or unavailable
                                      <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">{network.charAt(0)}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{network}</span>
                            {selectedNetwork === network && (
                              <span className="material-icons-outlined text-primary dark:text-primary ml-auto text-sm">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Regular select for non-betting services */
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className={`w-full rounded-lg border ${
                      phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                        ? "border-green-500 dark:border-green-400"
                        : "border-slate-300 dark:border-slate-600"
                    } bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary`}
                    required
                  >
                    <option value="">Select a network</option>
                    {networks.map((network) => (
                      <option key={network} value={network}>
                        {network}
                      </option>
                    ))}
                  </select>
                )}
                {phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber) && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <span className="material-icons-outlined text-sm">check_circle</span>
                    Network automatically detected
                  </p>
                )}
              </div>
            )}

            {/* Package Selection for TV Subscriptions */}
            {showPackageDropdown && selectedNetwork && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select Package
                </label>
                {loadingPackages ? (
                  <div className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-3 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Loading packages...</span>
                  </div>
                ) : (
                  <select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="">Select a package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id || pkg.name} value={pkg.id || pkg.name}>
                        {pkg.name} {pkg.amount ? `- ₦${pkg.amount.toLocaleString()}` : ""} {pkg.data ? `(${pkg.data})` : ""} {pkg.validity ? `- ${pkg.validity}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {packages.length === 0 && !loadingPackages && selectedNetwork && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    No packages available for {selectedNetwork}
                  </p>
                )}
              </div>
            )}

            {/* Phone Number / Gift Card Code */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {placeholder}
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  if (serviceId === "gift-card-redeem") {
                    // For gift cards, don't format as phone number
                    setPhoneNumber(e.target.value);
                  } else {
                    setPhoneNumber(formatPhoneNumber(e.target.value));
                  }
                }}
                placeholder={serviceId === "gift-card-redeem" ? "Enter gift card code" : "08012345678 or +2348012345678"}
                maxLength={serviceId === "gift-card-redeem" ? 50 : 14}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>

            {/* Amount - Hidden for gift card redemption (amount comes from gift card) */}
            {serviceId !== "gift-card-redeem" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={showPackageDropdown ? "Select a package or enter amount" : "Enter amount"}
                  min={serviceSettings.minAmount || 1}
                  max={serviceSettings.maxAmount || 1000000}
                  step="1"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
                  required={!showPackageDropdown || !selectedPackage}
                  disabled={showPackageDropdown && selectedPackage ? true : false}
                />
                {serviceSettings.minAmount && serviceSettings.maxAmount && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Min: ₦{serviceSettings.minAmount.toLocaleString()} - Max: ₦{serviceSettings.maxAmount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
            
            {/* Gift Card Info Message */}
            {serviceId === "gift-card-redeem" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                  <span className="material-icons-outlined text-lg">info</span>
                  <span>
                    <strong>Redeem your existing gift card:</strong> Enter the gift card code you already have. 
                    The value will be automatically detected from the code and credited to your account.
                  </span>
                </p>
              </div>
            )}

            {/* Price Breakdown */}
            {calculatedTotal > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    ₦{parseFloat(amount).toLocaleString()}
                  </span>
                </div>
                {serviceSettings.markup > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Service Fee ({serviceSettings.markup}%):</span>
                    <span className="text-slate-900 dark:text-slate-100 font-medium">
                      ₦{((parseFloat(amount) * serviceSettings.markup) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-900 dark:text-slate-100 font-bold">Total:</span>
                  <span className="text-primary font-bold text-lg">
                    ₦{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !phoneNumber || (serviceId !== "gift-card-redeem" && (!amount || calculatedTotal === 0))}
              className="w-full bg-primary text-white dark:text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                serviceId === "gift-card-redeem" ? `Redeem Gift Card` : `Purchase ${serviceName}`
              )}
            </button>
          </form>
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full text-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

