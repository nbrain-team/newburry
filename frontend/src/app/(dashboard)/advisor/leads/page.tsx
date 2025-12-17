'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Lead {
  id: number;
  full_name: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  challenge: string;
  source: string;
  page_url: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: '',
    source: ''
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  async function fetchLeads() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.source) params.append('source', filter.source);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateLead(leadId: number, updates: Partial<Lead>) {
    try {
      setUpdating(true);
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        await fetchLeads();
        if (selectedLead?.id === leadId) {
          const data = await res.json();
          setSelectedLead(data.lead);
        }
      }
    } catch (err) {
      console.error('Error updating lead:', err);
      alert('Failed to update lead');
    } finally {
      setUpdating(false);
    }
  }

  function openLeadDetails(lead: Lead) {
    setSelectedLead(lead);
    setShowDetails(true);
  }

  function closeLeadDetails() {
    setShowDetails(false);
    setSelectedLead(null);
  }

  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'converted': return 'bg-purple-100 text-purple-800';
      case 'lost': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getSourceLabel(source: string) {
    const labels: Record<string, string> = {
      'dual-track-strategy': 'Dual-Track Strategy',
      'newsletter-growth': 'Newsletter Growth',
      'ai-brain-foundation': 'AI Brain Foundation',
      'contact-form': 'Contact Form'
    };
    return labels[source] || source;
  }

  function formatDate(dateString: string) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Website Leads</h1>
          <p className="text-gray-600">Manage leads captured from website forms and landing pages</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
              <select
                value={filter.source}
                onChange={(e) => setFilter({ ...filter, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Sources</option>
                <option value="dual-track-strategy">Dual-Track Strategy</option>
                <option value="newsletter-growth">Newsletter Growth</option>
                <option value="ai-brain-foundation">AI Brain Foundation</option>
                <option value="contact-form">Contact Form</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilter({ status: '', source: '' })}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Total Leads</div>
            <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">New</div>
            <div className="text-2xl font-bold text-blue-600">
              {leads.filter(l => l.status === 'new').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Contacted</div>
            <div className="text-2xl font-bold text-yellow-600">
              {leads.filter(l => l.status === 'contacted').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Qualified</div>
            <div className="text-2xl font-bold text-green-600">
              {leads.filter(l => l.status === 'qualified').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Converted</div>
            <div className="text-2xl font-bold text-purple-600">
              {leads.filter(l => l.status === 'converted').length}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name / Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{lead.full_name}</div>
                      <div className="text-sm text-gray-500">{lead.company || 'No company'}</div>
                      {lead.title && <div className="text-xs text-gray-400">{lead.title}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{lead.email}</div>
                      {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">
                        {getSourceLabel(lead.source)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                        disabled={updating}
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusBadgeColor(lead.status)} border-0 cursor-pointer`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => openLeadDetails(lead)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No leads found</p>
              <p className="text-gray-400 text-sm mt-2">Leads will appear here when captured from website forms</p>
            </div>
          )}
        </div>
      </div>

      {/* Lead Details Modal */}
      {showDetails && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Lead Details</h2>
              <button
                onClick={closeLeadDetails}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{selectedLead.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Title</label>
                    <p className="text-gray-900">{selectedLead.title || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email</label>
                    <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Phone</label>
                    {selectedLead.phone ? (
                      <a href={`tel:${selectedLead.phone}`} className="text-blue-600 hover:underline">
                        {selectedLead.phone}
                      </a>
                    ) : (
                      <p className="text-gray-900">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Company</label>
                    <p className="text-gray-900">{selectedLead.company || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Source</label>
                    <p className="text-gray-900">{getSourceLabel(selectedLead.source)}</p>
                  </div>
                </div>
              </div>

              {/* Challenge/Interest */}
              {selectedLead.challenge && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Challenge / Interest</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedLead.challenge}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="text-gray-900">{formatDate(selectedLead.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900">{formatDate(selectedLead.updated_at)}</span>
                  </div>
                  {selectedLead.last_contacted_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Contacted:</span>
                      <span className="text-gray-900">{formatDate(selectedLead.last_contacted_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                <textarea
                  value={selectedLead.notes || ''}
                  onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                  placeholder="Add notes about this lead..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => updateLead(selectedLead.id, { notes: selectedLead.notes })}
                  disabled={updating}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {updating ? 'Saving...' : 'Save Notes'}
                </button>
              </div>

              {/* Page URL */}
              {selectedLead.page_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Source Page</label>
                  <a
                    href={selectedLead.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm break-all"
                  >
                    {selectedLead.page_url}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

