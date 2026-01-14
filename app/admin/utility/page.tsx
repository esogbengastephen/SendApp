"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

interface UtilityService {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "disabled";
  apiEndpoint?: string;
  supportedNetworks?: string[];
  category: "airtime" | "data" | "tv" | "betting" | "school" | "electricity" | "other";
  markup?: number; // Percentage markup
  minAmount?: number;
  maxAmount?: number;
}

interface NetworkPrice {
  network: string;
  markup: number;
  enabled: boolean;
}

export default function UtilityPage() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingService, setEditingService] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Utility services with default prices
  const [utilityServices, setUtilityServices] = useState<UtilityService[]>([
    {
      id: "airtime",
      name: "Airtime",
      description: "Purchase airtime for all major networks (MTN, Airtel, Glo, 9mobile). Instant top-up with competitive rates.",
      icon: "phone_android",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetAirTimeV1.asp",
      supportedNetworks: ["MTN", "Airtel", "Glo", "9mobile"],
      category: "airtime",
      markup: 2.5, // 2.5% markup
      minAmount: 50,
      maxAmount: 10000,
    },
    {
      id: "data",
      name: "Data Bundle",
      description: "Buy data bundles for all networks. Various plans available from daily to monthly subscriptions.",
      icon: "data_usage",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetDataV1.asp",
      supportedNetworks: ["MTN", "Airtel", "Glo", "9mobile"],
      category: "data",
      markup: 3.0,
      minAmount: 100,
      maxAmount: 50000,
    },
    {
      id: "tv",
      name: "Cable TV Subscription",
      description: "Subscribe to DStv, GOtv, and Startimes. Monthly and yearly packages available.",
      icon: "tv",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetCableTVV1.asp",
      supportedNetworks: ["DStv", "GOtv", "Startimes"],
      category: "tv",
      markup: 2.0,
      minAmount: 1000,
      maxAmount: 50000,
    },
    {
      id: "betting",
      name: "Betting Wallet Funding",
      description: "Fund betting wallets for major platforms. Instant funding with secure transactions.",
      icon: "sports_esports",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetBettingV1.asp",
      category: "betting",
      markup: 2.5,
      minAmount: 100,
      maxAmount: 100000,
    },
    {
      id: "school",
      name: "School e-PINs",
      description: "Purchase WAEC and JAMB e-PINs for students. Secure and instant delivery.",
      icon: "school",
      status: "disabled",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetSchoolV1.asp",
      supportedNetworks: ["WAEC", "JAMB"],
      category: "school",
      markup: 1.5,
      minAmount: 1000,
      maxAmount: 10000,
    },
    {
      id: "electricity",
      name: "Electricity Bill Payment",
      description: "Pay electricity bills for EKEDC, IKEDC, AEDC, and other providers.",
      icon: "bolt",
      status: "active",
      apiEndpoint: "https://www.nellobytesystems.com/APIElectricityV1.asp",
      supportedNetworks: ["EKEDC", "IKEDC", "AEDC", "PHED", "KEDCO", "EEDC", "IBEDC", "KAEDCO", "JED", "YEDC"],
      category: "electricity",
      markup: 2.0,
      minAmount: 100,
      maxAmount: 100000,
    },
  ]);

  const [networkPrices, setNetworkPrices] = useState<Record<string, NetworkPrice[]>>({});

  const categories = [
    { id: "all", name: "All Services", icon: "apps" },
    { id: "airtime", name: "Airtime", icon: "phone_android" },
    { id: "data", name: "Data", icon: "data_usage" },
    { id: "tv", name: "TV", icon: "tv" },
    { id: "betting", name: "Betting", icon: "sports_esports" },
    { id: "school", name: "School", icon: "school" },
    { id: "electricity", name: "Electricity", icon: "bolt" },
  ];

  const filteredServices = selectedCategory === "all"
    ? utilityServices
    : utilityServices.filter(service => service.category === selectedCategory);

  // Fetch utility settings on mount
  useEffect(() => {
    if (address) {
      fetchUtilitySettings();
    }
  }, [address]);

  const fetchUtilitySettings = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/utility?adminWallet=${address}`);
      const data = await response.json();
      
      if (data.success && data.services) {
        setUtilityServices(data.services);
        if (data.networkPrices) {
          setNetworkPrices(data.networkPrices);
        }
      }
    } catch (error) {
      console.error("Error fetching utility settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveServiceSettings = async (serviceId: string) => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const service = utilityServices.find(s => s.id === serviceId);
      if (!service) return;

      const response = await fetch("/api/admin/utility", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminWallet: address,
          serviceId,
          service: {
            status: service.status,
            markup: service.markup,
            minAmount: service.minAmount,
            maxAmount: service.maxAmount,
          },
          networkPrices: networkPrices[serviceId] || [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${service.name} settings saved successfully!`);
        setEditingService(null);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save settings");
        setTimeout(() => setError(null), 5000);
      }
    } catch (error: any) {
      console.error("Error saving utility settings:", error);
      setError(error.message || "Failed to save settings");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const updateService = (serviceId: string, updates: Partial<UtilityService>) => {
    setUtilityServices(prev => prev.map(service => 
      service.id === serviceId ? { ...service, ...updates } : service
    ));
  };

  const updateNetworkPrice = (serviceId: string, network: string, updates: Partial<NetworkPrice>) => {
    setNetworkPrices(prev => {
      const current = prev[serviceId] || [];
      const existing = current.find(np => np.network === network);
      
      if (existing) {
        return {
          ...prev,
          [serviceId]: current.map(np => 
            np.network === network ? { ...np, ...updates } : np
          ),
        };
      } else {
        return {
          ...prev,
          [serviceId]: [...current, { network, markup: 0, enabled: true, ...updates }],
        };
      }
    });
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading utility settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Utility Services Management
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Configure prices, markups, and settings for all utility services
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* API Provider Info */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              API Provider: ClubKonnect
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Utility Services Platform
            </p>
          </div>
          <a
            href="https://www.clubkonnect.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:opacity-80 transition-opacity text-sm font-medium"
          >
            Visit Website →
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Services</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {utilityServices.length}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Active Services</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {utilityServices.filter(s => s.status === "active").length}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Disabled Services</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {utilityServices.filter(s => s.status === "disabled").length}
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Filter by Category
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? "bg-primary text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span className="material-icons-outlined text-lg">{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
          >
            {/* Service Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
                  <span className="material-icons-outlined text-primary text-2xl">
                    {service.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {service.name}
                  </h3>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getStatusColor(service.status)}`}>
                    {service.status === "active" ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    service.status === "active" ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                  }`}>
                    <input
                      type="checkbox"
                      checked={service.status === "active"}
                      onChange={(e) => updateService(service.id, { status: e.target.checked ? "active" : "disabled" })}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        service.status === "active" ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>
                <button
                  onClick={() => setEditingService(editingService === service.id ? null : service.id)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  {editingService === service.id ? "Cancel" : "Configure"}
                </button>
              </div>
            </div>

            {/* Service Description */}
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {service.description}
            </p>

            {/* Current Settings Summary */}
            {editingService !== service.id && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Markup</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {service.markup?.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Min Amount</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ₦{service.minAmount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Max Amount</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ₦{service.maxAmount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Networks</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {service.supportedNetworks?.length || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Configuration Form */}
            {editingService === service.id && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 space-y-4">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Price Configuration
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Markup Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={service.markup || 0}
                      onChange={(e) => updateService(service.id, { markup: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="2.5"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Percentage added to base price
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Minimum Amount (₦)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={service.minAmount || 0}
                      onChange={(e) => updateService(service.id, { minAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Maximum Amount (₦)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={service.maxAmount || 0}
                      onChange={(e) => updateService(service.id, { maxAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="10000"
                    />
                  </div>
                </div>

                {/* Network-Specific Pricing */}
                {service.supportedNetworks && service.supportedNetworks.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                      Network-Specific Pricing
                    </h5>
                    <div className="space-y-2">
                      {service.supportedNetworks.map((network) => {
                        const networkPrice = networkPrices[service.id]?.find(np => np.network === network) || {
                          network,
                          markup: service.markup || 0,
                          enabled: true,
                        };
                        
                        return (
                          <div key={network} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{network}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer">
                                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  networkPrice.enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={networkPrice.enabled}
                                    onChange={(e) => updateNetworkPrice(service.id, network, { enabled: e.target.checked })}
                                    className="sr-only"
                                  />
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                      networkPrice.enabled ? "translate-x-5" : "translate-x-1"
                                    }`}
                                  />
                                </div>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={networkPrice.markup}
                                onChange={(e) => updateNetworkPrice(service.id, network, { markup: parseFloat(e.target.value) || 0 })}
                                className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                placeholder="2.5"
                                disabled={!networkPrice.enabled}
                              />
                              <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* API Endpoint Info */}
                {service.apiEndpoint && (
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      API Endpoint:
                    </p>
                    <a
                      href={service.apiEndpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline break-all"
                    >
                      {service.apiEndpoint}
                    </a>
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setEditingService(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveServiceSettings(service.id)}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-slate-900 font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

