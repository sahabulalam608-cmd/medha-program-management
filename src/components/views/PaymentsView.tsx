import React, { useState } from 'react';
import { PaymentItem } from '../../types';
import { MedhaApiService } from '../../services/api';
import { Search, Download, Plus, CheckCircle, Clock, AlertTriangle, X, Check } from 'lucide-react';

interface PaymentsViewProps {
  payments: PaymentItem[];
  onRefresh: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ payments, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newPay, setNewPay] = useState({
    memberId: 'NCM-01',
    name: 'Israt Jahan',
    batch: 'NCM PART-1',
    tranId: '',
    amount: 6500,
    channel: 'bKash',
    date: new Date().toISOString().slice(0, 10),
    status: 'Verified' as PaymentItem['status'],
    notes: 'Payment received via personal bKash send money'
  });

  const filtered = payments.filter((p) => {
    const matchesChannel = channelFilter === 'All' || p.channel === channelFilter;
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(term) ||
      p.memberId.toLowerCase().includes(term) ||
      p.tranId.toLowerCase().includes(term);
    return matchesChannel && matchesStatus && matchesSearch;
  });

  const handleStatusToggle = (id: string, current: PaymentItem['status']) => {
    const next: PaymentItem['status'] = current === 'Verified' ? 'Pending' : 'Verified';
    MedhaApiService.updatePaymentStatus(id, next);
    onRefresh();
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPay.tranId) return;
    MedhaApiService.addPayment(newPay);
    setIsAddOpen(false);
    onRefresh();
  };

  const totalAmount = filtered.reduce((acc, p) => acc + (p.status === 'Verified' ? p.amount : 0), 0);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search TrxID, student name, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Channel selector */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] font-medium text-[#1e1b4b]"
          >
            <option value="All">All Channels</option>
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Bank">Bank</option>
          </select>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] font-medium text-[#1e1b4b]"
          >
            <option value="All">All Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Installment Due">Installment Due</option>
          </select>

          <button
            onClick={() => MedhaApiService.exportCsv(filtered, 'Medha_Payments.csv')}
            className="p-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 bg-[#5b21b6] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-4 px-5 bg-gradient-to-r from-[#f5f3ff] to-[#fdf2f8] rounded-2xl border border-purple-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="font-semibold text-[#1e1b4b]">
            Total Verified in View: <b className="text-base text-[#5b21b6] font-extrabold ml-1">৳{totalAmount.toLocaleString('en-BD')}</b>
          </span>
        </div>
        <span className="text-[#64748b]">{filtered.length} transactions listed</span>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Amount (৳)</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0f7]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#faf9fe] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#1e1b4b]">{item.name}</div>
                    <div className="font-mono text-[10px] text-[#5b21b6]">{item.memberId}</div>
                  </td>
                  <td className="py-3 px-4 text-[#64748b]">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold">
                      {item.batch}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] ${
                          item.channel === 'bKash'
                            ? 'bg-pink-100 text-pink-700'
                            : item.channel === 'Nagad'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.channel === 'bKash' ? 'bK' : item.channel === 'Nagad' ? 'NG' : 'BK'}
                      </span>
                      <span className="font-semibold text-[#1e1b4b]">{item.channel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#1e1b4b]">
                    {item.tranId}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-sm text-[#1e1b4b]">
                    ৳{item.amount.toLocaleString('en-BD')}
                  </td>
                  <td className="py-3 px-4 text-[#64748b] text-[11px] whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'Installment Due'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleStatusToggle(item.id, item.status)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 ${
                        item.status === 'Verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-[#5b21b6] text-white hover:bg-[#6d28d9]'
                      }`}
                    >
                      {item.status === 'Verified' ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{item.status === 'Verified' ? 'Verified' : 'Verify'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#ece9f4] flex items-center justify-between bg-[#fafafa]">
              <h3 className="font-bold text-sm text-[#1e1b4b]">Record New Student Payment</h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-lg text-[#64748b]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={newPay.name}
                  onChange={(e) => setNewPay({ ...newPay, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">bKash / Nagad Transaction ID (TrxID) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BL991203B"
                  value={newPay.tranId}
                  onChange={(e) => setNewPay({ ...newPay, tranId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Channel</label>
                  <select
                    value={newPay.channel}
                    onChange={(e) => setNewPay({ ...newPay, channel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] bg-white"
                  >
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount (BDT)</label>
                  <input
                    type="number"
                    value={newPay.amount}
                    onChange={(e) => setNewPay({ ...newPay, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#ece9f4] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f7f6fb] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-xs"
                >
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
