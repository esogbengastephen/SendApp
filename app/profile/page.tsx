"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { getUserFromStorage } from "@/lib/session";
import imageCompression from "browser-image-compression";

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  // Business invoice settings
  const [invoiceType, setInvoiceType] = useState<"personal" | "business">("personal");
  const [businessName, setBusinessName] = useState("");
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessZip, setBusinessZip] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const businessLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBusinessLogo, setUploadingBusinessLogo] = useState(false);
  const [showBusinessLogoCrop, setShowBusinessLogoCrop] = useState(false);
  const [businessImageSrc, setBusinessImageSrc] = useState<string>("");
  
  // Cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
  }, [router]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/user/profile?userId=${user.id}`);
      const data = await response.json();
      
      if (data.success && data.profile) {
        setDisplayName(data.profile.displayName || "");
        setPhotoUrl(data.profile.photoUrl || null);
        setInvoiceType(data.profile.invoiceType || "personal");
        setBusinessName(data.profile.businessName || "");
        setBusinessLogoUrl(data.profile.businessLogoUrl || null);
        setBusinessAddress(data.profile.businessAddress || "");
        setBusinessCity(data.profile.businessCity || "");
        setBusinessState(data.profile.businessState || "");
        setBusinessZip(data.profile.businessZip || "");
        setBusinessPhone(data.profile.businessPhone || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  // Create cropped image
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Set canvas size to match cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        "image/jpeg",
        0.95 // High quality
      );
    });
  };

  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCropAndUpload = async () => {
    if (!croppedAreaPixels || !imageSrc) return;

    setUploading(true);
    setError("");

    try {
      // Get cropped image
      const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels);

      // Convert blob URL to File
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });

      // Compress the image
      const options = {
        maxSizeMB: 0.5, // Max 500KB
        maxWidthOrHeight: 800, // Max dimension
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85, // High quality compression
      };

      const compressedFile = await imageCompression(file, options);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        // Upload to API
        const uploadResponse = await fetch("/api/user/upload-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            image: base64String,
            filename: "profile.jpg",
          }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success) {
          setPhotoUrl(uploadData.photoUrl);
          setSuccess("Profile picture updated successfully!");
          setTimeout(() => setSuccess(""), 3000);
          setShowCropModal(false);
          setImageSrc("");
          // Clean up blob URL
          URL.revokeObjectURL(croppedImageUrl);
        } else {
          setError(uploadData.error || "Failed to upload image");
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      console.error("Error processing image:", error);
      setError(error.message || "Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (only PNG, JPG, JPEG)
    // Normalize MIME type - some systems use image/jpg instead of image/jpeg
    const normalizedType = file.type.toLowerCase().replace('image/jpg', 'image/jpeg');
    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(normalizedType)) {
      setError("Please select a PNG, JPG, or JPEG image");
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }

    setError("");
    setSuccess("");

    // Read file and show crop modal
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSrc(reader.result as string);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizedType = file.type.toLowerCase().replace('image/jpg', 'image/jpeg');
    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(normalizedType)) {
      setError("Please select a PNG, JPG, or JPEG image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }

    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setBusinessImageSrc(reader.result as string);
      setShowBusinessLogoCrop(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessLogoCropAndUpload = async () => {
    if (!croppedAreaPixels || !businessImageSrc || !user?.id) return;

    setUploadingBusinessLogo(true);
    setError("");
    setSuccess("");

    try {
      // Get cropped image
      const croppedImageUrl = await getCroppedImg(businessImageSrc, croppedAreaPixels);

      // Convert blob URL to File
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], "business-logo.jpg", { type: "image/jpeg" });

      // Compress the image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      };

      const compressedFile = await imageCompression(file, options);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        // Upload to API
        const uploadResponse = await fetch("/api/user/upload-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            image: base64String,
            filename: "business-logo.jpg",
          }),
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success && uploadData.url) {
          setBusinessLogoUrl(uploadData.url);
          setShowBusinessLogoCrop(false);
          setBusinessImageSrc("");
          setSuccess("Business logo uploaded successfully!");
        } else {
          setError(uploadData.error || "Failed to upload business logo");
        }
        setUploadingBusinessLogo(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      console.error("Error uploading business logo:", error);
      setError(error.message || "Failed to upload business logo");
      setUploadingBusinessLogo(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          display_name: displayName.trim() || null,
          photo_url: photoUrl,
          invoice_type: invoiceType,
          business_name: invoiceType === "business" ? businessName.trim() || null : null,
          business_logo_url: invoiceType === "business" ? businessLogoUrl : null,
          business_address: invoiceType === "business" ? businessAddress.trim() || null : null,
          business_city: invoiceType === "business" ? businessCity.trim() || null : null,
          business_state: invoiceType === "business" ? businessState.trim() || null : null,
          business_zip: invoiceType === "business" ? businessZip.trim() || null : null,
          business_phone: invoiceType === "business" ? businessPhone.trim() || null : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Profile updated successfully!");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (error: any) {
      setError(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="bg-secondary/10 p-2 rounded-xl hover:bg-secondary/20 transition backdrop-blur-sm"
          >
            <span className="material-icons-outlined text-secondary">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold text-secondary">Edit Profile</h1>
        </div>

        {/* Main Card */}
        <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-100/80 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-xl">
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-secondary/80">
              Profile Picture
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={displayName || "Profile"}
                    width={100}
                    height={100}
                    className="rounded-full border-4 border-secondary/20 object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-secondary/10 border-4 border-secondary/20 flex items-center justify-center">
                    <span className="material-icons-outlined text-secondary/40 text-4xl">face</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-secondary/50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Uploading..." : "Change Photo"}
                </button>
                {photoUrl && (
                  <button
                    onClick={() => {
                      setPhotoUrl(null);
                      setSuccess("Profile picture removed");
                      setTimeout(() => setSuccess(""), 3000);
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            <p className="text-xs text-secondary/50 mt-2">
              PNG, JPG, or JPEG. Max size 10MB. Image will be optimized automatically.
            </p>
          </div>

          {/* Display Name Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-secondary/80">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={50}
              className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-secondary/50 mt-1">
              {displayName.length}/50 characters
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-secondary/80">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full p-3 border border-secondary/20 rounded-xl bg-secondary/10 text-secondary/60 cursor-not-allowed"
            />
            <p className="text-xs text-secondary/50 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Invoice Settings Divider */}
          <div className="my-8 border-t border-secondary/20"></div>

          {/* Invoice Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-secondary/80">
              Invoice Type
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setInvoiceType("personal")}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                  invoiceType === "personal"
                    ? "bg-secondary text-primary"
                    : "bg-white/40 hover:bg-white/60 text-secondary"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType("business")}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                  invoiceType === "business"
                    ? "bg-secondary text-primary"
                    : "bg-white/40 hover:bg-white/60 text-secondary"
                }`}
              >
                Business
              </button>
            </div>
            <p className="text-xs text-secondary/50 mt-2">
              {invoiceType === "personal" 
                ? "Invoices will show your personal name and email"
                : "Invoices will show your business information and logo"}
            </p>
          </div>

          {/* Business Settings (only shown if business is selected) */}
          {invoiceType === "business" && (
            <div className="space-y-6 mb-6 p-4 bg-white/20 dark:bg-white/10 rounded-xl border border-secondary/20">
              <h3 className="text-lg font-bold text-secondary">Business Information</h3>
              
              {/* Business Logo */}
              <div>
                <label className="block text-sm font-medium mb-3 text-secondary/80">
                  Business Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {businessLogoUrl ? (
                      <img
                        src={businessLogoUrl}
                        alt="Business Logo"
                        className="w-24 h-24 rounded-lg border-4 border-secondary/20 object-contain bg-white p-2"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-secondary/10 border-4 border-secondary/20 flex items-center justify-center">
                        <span className="material-icons-outlined text-secondary/40 text-4xl">image</span>
                      </div>
                    )}
                    {uploadingBusinessLogo && (
                      <div className="absolute inset-0 bg-secondary/50 rounded-lg flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => businessLogoInputRef.current?.click()}
                      disabled={uploadingBusinessLogo}
                      className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingBusinessLogo ? "Uploading..." : "Upload Logo"}
                    </button>
                    {businessLogoUrl && (
                      <button
                        onClick={() => {
                          setBusinessLogoUrl(null);
                          setSuccess("Business logo removed");
                          setTimeout(() => setSuccess(""), 3000);
                        }}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <input
                    ref={businessLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                    onChange={handleBusinessLogoSelect}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-secondary/50 mt-2">
                  PNG, JPG, or JPEG. Max size 10MB. Recommended: Square logo, transparent background.
                </p>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-sm font-medium mb-2 text-secondary/80">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter business/company name"
                  maxLength={100}
                  className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Business Address */}
              <div>
                <label className="block text-sm font-medium mb-2 text-secondary/80">
                  Street Address
                </label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Enter street address"
                  className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* City, State, ZIP Row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-secondary/80">
                    City
                  </label>
                  <input
                    type="text"
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    placeholder="City"
                    className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-secondary/80">
                    State
                  </label>
                  <input
                    type="text"
                    value={businessState}
                    onChange={(e) => setBusinessState(e.target.value)}
                    placeholder="State"
                    className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-secondary/80">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={businessZip}
                    onChange={(e) => setBusinessZip(e.target.value)}
                    placeholder="ZIP"
                    className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Business Phone */}
              <div>
                <label className="block text-sm font-medium mb-2 text-secondary/80">
                  Business Phone
                </label>
                <input
                  type="tel"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="(000) 000-0000"
                  className="w-full p-3 border border-secondary/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-secondary font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="material-icons-outlined">save</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
            <button
              onClick={() => router.back()}
              className="bg-white/40 hover:bg-white/60 text-secondary font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Business Logo Crop Modal */}
      {showBusinessLogoCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm">
          <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-lg w-full max-w-2xl mx-4">
            <h2 className="text-xl font-bold text-secondary mb-4">Crop Your Business Logo</h2>
            
            <div className="relative w-full h-96 bg-background-dark/20 rounded-xl overflow-hidden mb-4">
              <Cropper
                image={businessImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1} // Square crop for logo
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect" // Rectangular crop for logo
                showGrid={false}
              />
            </div>

            {/* Zoom Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-secondary/80 mb-2">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-secondary/20 rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowBusinessLogoCrop(false);
                  setBusinessImageSrc("");
                  if (businessLogoInputRef.current) {
                    businessLogoInputRef.current.value = "";
                  }
                }}
                className="flex-1 bg-white/40 hover:bg-white/60 text-secondary font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBusinessLogoCropAndUpload}
                disabled={uploadingBusinessLogo}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingBusinessLogo ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">check</span>
                    <span>Save Logo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm">
          <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-lg w-full max-w-2xl mx-4">
            <h2 className="text-xl font-bold text-secondary mb-4">Crop Your Profile Picture</h2>
            
            <div className="relative w-full h-96 bg-background-dark/20 rounded-xl overflow-hidden mb-4">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1} // Square crop for circular avatar
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round" // Circular crop
                showGrid={false}
              />
            </div>

            {/* Zoom Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-secondary/80 mb-2">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-secondary/20 rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="flex-1 bg-white/40 hover:bg-white/60 text-secondary font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCropAndUpload}
                disabled={uploading}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">check</span>
                    <span>Apply & Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
