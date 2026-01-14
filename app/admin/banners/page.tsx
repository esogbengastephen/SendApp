"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  click_count: number;
  created_at: string;
}

export default function AdminBannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    link_url: "",
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await fetch("/api/admin/banners");
      const data = await response.json();
      
      if (data.success) {
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingBanner
        ? `/api/banners/${editingBanner.id}`
        : "/api/banners";
      
      const method = editingBanner ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          link_url: formData.link_url || null,
          title: formData.title || null,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowAddModal(false);
        setEditingBanner(null);
        setFormData({
          title: "",
          image_url: "",
          link_url: "",
          display_order: 0,
          is_active: true,
        });
        fetchBanners();
      } else {
        alert(data.error || "Failed to save banner");
      }
    } catch (error) {
      console.error("Error saving banner:", error);
      alert("Failed to save banner");
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || "",
      image_url: banner.image_url,
      link_url: banner.link_url || "",
      display_order: banner.display_order,
      is_active: banner.is_active,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const response = await fetch(`/api/banners/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      
      if (data.success) {
        fetchBanners();
      } else {
        alert(data.error || "Failed to delete banner");
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Failed to delete banner");
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const response = await fetch(`/api/banners/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !banner.is_active }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Error toggling banner:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Banner Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage promotional banners displayed to users
            </p>
          </div>
          <button
            onClick={() => {
              setEditingBanner(null);
              setFormData({
                title: "",
                image_url: "",
                link_url: "",
                display_order: banners.length,
                is_active: true,
              });
              setShowAddModal(true);
            }}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <span className="material-icons-outlined">add</span>
            <span>Add Banner</span>
          </button>
        </div>

        {/* Banners List */}
        {loading ? (
          <div className="text-center py-20 text-slate-600 dark:text-slate-400">
            Loading banners...
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-20 text-slate-600 dark:text-slate-400">
            <span className="material-icons-outlined text-6xl mb-4 opacity-50 block">
              image
            </span>
            <p>No banners yet. Click "Add Banner" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden ${
                  !banner.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="relative w-full aspect-video bg-slate-200 dark:bg-slate-700">
                  <Image
                    src={banner.image_url}
                    alt={banner.title || "Banner"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {!banner.is_active && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold">INACTIVE</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                    {banner.title || "Untitled Banner"}
                  </h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <p>Order: {banner.display_order}</p>
                    <p>Clicks: {banner.click_count}</p>
                    {banner.link_url && (
                      <p className="truncate">Link: {banner.link_url}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(banner)}
                      className="flex-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`flex-1 px-3 py-2 rounded transition text-sm ${
                        banner.is_active
                          ? "bg-yellow-500 text-white hover:bg-yellow-600"
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                    >
                      {banner.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 transition text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingBanner ? "Edit Banner" : "Add New Banner"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingBanner(null);
                    }}
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <span className="material-icons-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Title (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2"
                      placeholder="Banner title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Image URL *
                    </label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) =>
                        setFormData({ ...formData, image_url: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2"
                      placeholder="https://example.com/banner.jpg"
                      required
                    />
                    {formData.image_url && (
                      <div className="mt-2 relative w-full aspect-video bg-slate-200 rounded overflow-hidden">
                        <Image
                          src={formData.image_url}
                          alt="Preview"
                          fill
                          className="object-contain"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Link URL (optional)
                    </label>
                    <input
                      type="url"
                      value={formData.link_url}
                      onChange={(e) =>
                        setFormData({ ...formData, link_url: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2"
                      placeholder="https://example.com or /page"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty if banner should not be clickable
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            display_order: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_active: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Active
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                    >
                      {editingBanner ? "Update Banner" : "Create Banner"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingBanner(null);
                      }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
