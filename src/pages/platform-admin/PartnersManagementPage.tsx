import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Image, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Partner {
  id: string;
  name: string;
  logo_url: string;
  website: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export const PartnersManagementPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    website: ''
  });

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('order_index');

      if (error) throw error;
      if (data) setPartners(data);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update({
            name: formData.name,
            logo_url: formData.logo_url,
            website: formData.website || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPartner.id);

        if (error) throw error;
      } else {
        const maxOrder = partners.length > 0
          ? Math.max(...partners.map(p => p.order_index))
          : -1;

        const { error } = await supabase
          .from('partners')
          .insert([{
            name: formData.name,
            logo_url: formData.logo_url,
            website: formData.website || null,
            order_index: maxOrder + 1
          }]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPartner(null);
      setFormData({ name: '', logo_url: '', website: '' });
      loadPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      alert('Failed to save partner');
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      logo_url: partner.logo_url,
      website: partner.website || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this partner?')) return;

    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      alert('Failed to delete partner');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadPartners();
    } catch (error) {
      console.error('Error toggling partner status:', error);
      alert('Failed to update partner status');
    }
  };

  const movePartner = async (id: string, direction: 'up' | 'down') => {
    const index = partners.findIndex(p => p.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === partners.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const partner = partners[index];
    const swapPartner = partners[swapIndex];

    try {
      await Promise.all([
        supabase.from('partners').update({ order_index: swapPartner.order_index }).eq('id', partner.id),
        supabase.from('partners').update({ order_index: partner.order_index }).eq('id', swapPartner.id)
      ]);

      loadPartners();
    } catch (error) {
      console.error('Error reordering partners:', error);
      alert('Failed to reorder partners');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Partner Logos Management</h1>
          <p className="text-slate-600">Manage "Our Success Partners" logos displayed on the homepage</p>
        </div>
        <button
          onClick={() => {
            setEditingPartner(null);
            setFormData({ name: '', logo_url: '', website: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Partner
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Image className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No partners added yet</p>
          <p className="text-sm text-slate-500 mt-2">
            Click "Add Partner" to add your first partner logo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner, index) => (
            <div
              key={partner.id}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                partner.is_active ? 'border-slate-200' : 'border-slate-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">#{index + 1}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    partner.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {partner.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => movePartner(partner.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => movePartner(partner.id, 'down')}
                    disabled={index === partners.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4 p-4 bg-slate-50 rounded-lg flex items-center justify-center h-24">
                {partner.logo_url ? (
                  <img
                    src={partner.logo_url}
                    alt={partner.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<div class="text-slate-400">Logo not found</div>';
                    }}
                  />
                ) : (
                  <Image className="h-12 w-12 text-slate-300" />
                )}
              </div>

              <h3 className="font-bold text-slate-900 mb-1">{partner.name}</h3>
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                >
                  {partner.website}
                </a>
              )}

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => toggleActive(partner.id, partner.is_active)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                >
                  {partner.is_active ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleEdit(partner)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(partner.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {editingPartner ? 'Edit Partner' : 'Add New Partner'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Partner Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Microsoft"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logo URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter the full URL to the logo image
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Website (Optional)
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPartner(null);
                    setFormData({ name: '', logo_url: '', website: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingPartner ? 'Update' : 'Add'} Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
