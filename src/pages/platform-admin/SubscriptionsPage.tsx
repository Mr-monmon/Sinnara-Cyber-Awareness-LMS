import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, DollarSign, FileText, Plus, Edit2, Trash2, AlertCircle, Check, X, Download, Bell, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
}

interface Company {
  id: string;
  name: string;
  admin_name?: string;
  admin_email?: string;
  subscription_start?: string;
  subscription_end?: string;
  subscription_type?: string;
  is_active?: boolean;
  reminder_sent?: boolean;
  reminder_sent_at?: string;
}

export const SubscriptionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [invoiceFormData, setInvoiceFormData] = useState({
    company_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: 0,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companiesRes, invoicesRes] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('invoices').select('*').order('issue_date', { ascending: false })
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (invoicesRes.data) setInvoices(invoicesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  const getStatusBadge = (status: string, type: 'subscription' | 'invoice') => {
    const subscriptionStyles = {
      ACTIVE: 'bg-green-100 text-green-800 border-green-200',
      EXPIRED: 'bg-red-100 text-red-800 border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };

    const invoiceStyles = {
      PAID: 'bg-green-100 text-green-800 border-green-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      OVERDUE: 'bg-red-100 text-red-800 border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
      REFUNDED: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    const labels = {
      ACTIVE: 'Active',
      EXPIRED: 'Expired',
      CANCELLED: 'Cancelled',
      PENDING: 'Pending',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
      REFUNDED: 'Refunded'
    };

    const styles = type === 'subscription' ? subscriptionStyles : invoiceStyles;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getSubscriptionTypeLabel = (type: string) => {
    const labels = {
      POC_3M: 'Trial 3 Months',
      MONTHLY_6: '6 Months',
      YEARLY_1: '1 Year',
      YEARLY_2: '2 Years',
      CUSTOM: 'Custom'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleSendReminder = async (company: Company) => {
    if (!company.admin_email) {
      alert('No admin email configured for this company');
      return;
    }

    if (!confirm(`Send subscription renewal reminder to ${company.admin_email}?`)) {
      return;
    }

    try {
      const daysRemaining = company.subscription_end ? getDaysRemaining(company.subscription_end) : 0;

      await supabase
        .from('companies')
        .update({
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString()
        })
        .eq('id', company.id);

      await supabase.from('audit_logs').insert([{
        action_type: 'SEND_REMINDER',
        entity_type: 'SUBSCRIPTION',
        entity_id: company.id,
        description: `Sent renewal reminder to ${company.name}`,
        new_value: { days_remaining: daysRemaining, recipient: company.admin_email }
      }]);

      await loadData();
      alert(`Reminder sent successfully to ${company.admin_email}`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    }
  };

  const exportInvoicesPDF = () => {
    const filtered = selectedCompany
      ? invoices.filter(i => i.company_id === selectedCompany)
      : invoices;

    const content = `
INVOICE EXPORT REPORT
Generated: ${new Date().toLocaleDateString()}
Total Invoices: ${filtered.length}

${filtered.map(inv => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVOICE: ${inv.invoice_number}
Company: ${getCompanyName(inv.company_id)}
Issue Date: ${new Date(inv.issue_date).toLocaleDateString()}
Due Date: ${new Date(inv.due_date).toLocaleDateString()}
${inv.payment_date ? `Paid: ${new Date(inv.payment_date).toLocaleDateString()}` : ''}

Amount: ${inv.amount.toLocaleString()} SAR
Tax (15%): ${inv.tax.toLocaleString()} SAR
Total: ${inv.total.toLocaleString()} ${inv.currency}

Status: ${inv.status}
${inv.notes ? `Notes: ${inv.notes}` : ''}
${inv.payment_method ? `Payment Method: ${inv.payment_method}` : ''}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Paid: ${filtered.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0).toLocaleString()} SAR
Total Pending: ${filtered.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + i.total, 0).toLocaleString()} SAR
Total Overdue: ${filtered.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0).toLocaleString()} SAR
    `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-export-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportInvoicesCSV = () => {
    const filtered = selectedCompany
      ? invoices.filter(i => i.company_id === selectedCompany)
      : invoices;

    const headers = ['Invoice Number', 'Company', 'Issue Date', 'Due Date', 'Payment Date', 'Amount', 'Tax', 'Total', 'Currency', 'Status', 'Payment Method', 'Notes'];
    const rows = filtered.map(inv => [
      inv.invoice_number,
      getCompanyName(inv.company_id),
      new Date(inv.issue_date).toLocaleDateString(),
      new Date(inv.due_date).toLocaleDateString(),
      inv.payment_date ? new Date(inv.payment_date).toLocaleDateString() : '',
      inv.amount,
      inv.tax,
      inv.total,
      inv.currency,
      inv.status,
      inv.payment_method || '',
      inv.notes || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const taxRate = 0.15;
      const tax = invoiceFormData.amount * taxRate;
      const total = invoiceFormData.amount + tax;

      const { data: maxInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (maxInvoice?.invoice_number) {
        const currentNumber = parseInt(maxInvoice.invoice_number.replace('INV-', ''));
        nextNumber = currentNumber + 1;
      }

      const invoiceNumber = 'INV-' + nextNumber.toString().padStart(6, '0');

      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update({
            company_id: invoiceFormData.company_id,
            issue_date: invoiceFormData.issue_date,
            due_date: invoiceFormData.due_date,
            amount: invoiceFormData.amount,
            tax: tax,
            total: total,
            notes: invoiceFormData.notes
          })
          .eq('id', editingInvoice.id);

        if (error) throw error;

        await supabase.from('audit_logs').insert([{
          action_type: 'UPDATE',
          entity_type: 'INVOICE',
          entity_id: editingInvoice.id,
          description: `Updated invoice: ${editingInvoice.invoice_number}`,
          new_value: { amount: invoiceFormData.amount, total }
        }]);

        alert('Invoice updated successfully');
      } else {
        const { error } = await supabase.from('invoices').insert([{
          company_id: invoiceFormData.company_id,
          invoice_number: invoiceNumber,
          issue_date: invoiceFormData.issue_date,
          due_date: invoiceFormData.due_date,
          amount: invoiceFormData.amount,
          tax: tax,
          total: total,
          currency: 'SAR',
          status: 'PENDING',
          notes: invoiceFormData.notes
        }]);

        if (error) throw error;

        await supabase.from('audit_logs').insert([{
          action_type: 'CREATE',
          entity_type: 'INVOICE',
          description: `Created new invoice: ${invoiceNumber}`,
          new_value: { invoice_number: invoiceNumber, amount: invoiceFormData.amount, total }
        }]);

        alert('Invoice created successfully: ' + invoiceNumber);
      }

      setShowInvoiceModal(false);
      setEditingInvoice(null);
      setInvoiceFormData({
        company_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: 0,
        notes: ''
      });
      await loadData();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice: ' + (error as any).message);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceFormData({
      company_id: invoice.company_id,
      issue_date: invoice.issue_date.split('T')[0],
      due_date: invoice.due_date.split('T')[0],
      amount: invoice.amount,
      notes: invoice.notes || ''
    });
    setShowInvoiceModal(true);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'DELETE',
        entity_type: 'INVOICE',
        entity_id: invoice.id,
        description: `Deleted invoice: ${invoice.invoice_number}`
      }]);

      await loadData();
      alert('Invoice deleted successfully');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };

      if (newStatus === 'PAID') {
        updateData.payment_date = new Date().toISOString();
        updateData.payment_method = 'Manual';
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'UPDATE',
        entity_type: 'INVOICE',
        entity_id: invoiceId,
        description: `Updated invoice status to: ${newStatus}`,
        new_value: { status: newStatus }
      }]);

      await loadData();
      alert('Invoice status updated');
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Failed to update invoice');
    }
  };

  const handleUpdateCompanySubscription = async (company: Company, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: newStatus === 'ACTIVE' })
        .eq('id', company.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'UPDATE_COMPANY',
        entity_type: 'COMPANY',
        entity_id: company.id,
        description: `Updated subscription status: ${company.name}`,
        new_value: { is_active: newStatus === 'ACTIVE' }
      }]);

      await loadData();
      alert('Subscription status updated');
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    }
  };

  const getTotalRevenue = () => {
    return invoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + i.total, 0);
  };

  const getPendingAmount = () => {
    return invoices
      .filter(i => i.status === 'PENDING' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.total, 0);
  };

  const getActiveSubscriptions = () => {
    return companies.filter(c => {
      if (!c.subscription_end) return false;
      const daysRemaining = getDaysRemaining(c.subscription_end);
      return daysRemaining > 0 && c.is_active !== false;
    }).length;
  };

  const getExpiringSubscriptions = () => {
    return companies.filter(c => {
      if (!c.subscription_end) return false;
      const daysRemaining = getDaysRemaining(c.subscription_end);
      return daysRemaining > 0 && daysRemaining <= 30;
    }).length;
  };

  const filteredCompanies = selectedCompany
    ? companies.filter(c => c.id === selectedCompany)
    : companies;

  const filteredInvoices = selectedCompany
    ? invoices.filter(i => i.company_id === selectedCompany)
    : invoices;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Subscriptions & Invoices</h1>
        <p className="text-slate-600">Manage company subscriptions and billing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {getTotalRevenue().toLocaleString()}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Total Revenue (SAR)</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {getPendingAmount().toLocaleString()}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Pending Amount (SAR)</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {getActiveSubscriptions()}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Active Subscriptions</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {getExpiringSubscriptions()}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Expiring in 30 Days</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === 'subscriptions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Invoices
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Companies</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>

            {activeTab === 'invoices' && (
              <>
                <button
                  onClick={exportInvoicesCSV}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  onClick={exportInvoicesPDF}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Export Report
                </button>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setInvoiceFormData({
                      company_id: '',
                      issue_date: new Date().toISOString().split('T')[0],
                      due_date: '',
                      amount: 0,
                      notes: ''
                    });
                    setShowInvoiceModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all flex items-center gap-2 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  New Invoice
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'subscriptions' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">End Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Days Left</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCompanies.map((company) => {
                    if (!company.subscription_end) return null;
                    const daysRemaining = getDaysRemaining(company.subscription_end);
                    const isActive = company.is_active !== false && daysRemaining > 0;
                    const needsReminder = daysRemaining > 0 && daysRemaining <= 30;

                    return (
                      <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 font-medium text-slate-900">
                          {company.name}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>{company.admin_name || '-'}</div>
                          <div className="text-xs text-slate-500">{company.admin_email || '-'}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {getSubscriptionTypeLabel(company.subscription_type || '')}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {company.subscription_start ? new Date(company.subscription_start).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {new Date(company.subscription_end).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`font-medium ${
                            daysRemaining < 0 ? 'text-red-600' :
                            daysRemaining < 30 ? 'text-orange-600' :
                            'text-green-600'
                          }`}>
                            {daysRemaining < 0 ? 'Expired' : `${daysRemaining} days`}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {getStatusBadge(isActive ? 'ACTIVE' : 'EXPIRED', 'subscription')}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {needsReminder && (
                              <button
                                onClick={() => handleSendReminder(company)}
                                className={`p-2 rounded-lg transition-colors ${
                                  company.reminder_sent
                                    ? 'text-slate-400 bg-slate-100'
                                    : 'text-orange-600 hover:bg-orange-50'
                                }`}
                                title={company.reminder_sent ? `Reminder sent ${company.reminder_sent_at ? new Date(company.reminder_sent_at).toLocaleDateString() : ''}` : 'Send renewal reminder'}
                                disabled={company.reminder_sent}
                              >
                                <Bell className="h-4 w-4" />
                              </button>
                            )}
                            {isActive ? (
                              <button
                                onClick={() => handleUpdateCompanySubscription(company, 'EXPIRED')}
                                className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                title="Deactivate"
                              >
                                <X className="h-3 w-3" />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateCompanySubscription(company, 'ACTIVE')}
                                className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                title="Activate"
                              >
                                <Check className="h-3 w-3" />
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCompanies.filter(c => c.subscription_end).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No subscriptions found
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Issue Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Tax 15%</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-mono font-medium text-slate-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {getCompanyName(invoice.company_id)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {new Date(invoice.issue_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {invoice.amount.toLocaleString()} SAR
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {invoice.tax.toLocaleString()} SAR
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {invoice.total.toLocaleString()} {invoice.currency}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(invoice.status, 'invoice')}
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs">
                        {invoice.payment_date ? (
                          <div>
                            <div>{new Date(invoice.payment_date).toLocaleDateString()}</div>
                            <div className="text-slate-500">{invoice.payment_method || 'N/A'}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {invoice.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateInvoiceStatus(invoice.id, 'PAID')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark as Paid"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No invoices found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company *
                </label>
                <select
                  required
                  value={invoiceFormData.company_id}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, company_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceFormData.issue_date}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, issue_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceFormData.due_date}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, due_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount (SAR) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={invoiceFormData.amount}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="10000"
                />
                {invoiceFormData.amount > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">Base Amount:</span>
                      <span className="font-medium text-slate-900">{invoiceFormData.amount.toLocaleString()} SAR</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">VAT (15%):</span>
                      <span className="font-medium text-slate-900">{(invoiceFormData.amount * 0.15).toLocaleString()} SAR</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-slate-700 font-semibold">Total:</span>
                      <span className="font-bold text-blue-900">{(invoiceFormData.amount * 1.15).toLocaleString()} SAR</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={invoiceFormData.notes}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  {editingInvoice ? 'Save Changes' : 'Create Invoice'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setEditingInvoice(null);
                  }}
                  className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
