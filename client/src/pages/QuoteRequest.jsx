import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export default function QuoteRequest() {
  const { state, updateQuantity, removeFromRfqAssortment, clearRfqAssortment, submitQuote } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ market: 'United States', targetCustomerProfile: '', specifications: '', estimatedQuantity: '', notes: '' });
  const [status, setStatus] = useState({ sending: false, error: '' });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ sending: true, error: '' });
    try {
      const result = await submitQuote(form);
      navigate('/quote-success', { state: result });
    } catch (error) {
      setStatus({ sending: false, error: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf8f2] pt-24">
      <main className="mx-auto max-w-6xl px-5 py-12">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> Back to ingredient portfolio</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-3xl bg-white p-7">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-bold uppercase tracking-wider text-[#a05247]">Technical sourcing workspace</p><h1 className="mt-1 font-heading text-2xl font-bold">Ingredient sample list</h1></div>
              {state.rfqAssortment.length > 0 && <button onClick={clearRfqAssortment} className="text-sm text-red-600">Clear all</button>}
            </div>
            {state.rfqAssortment.length ? (
              <div className="mt-6 space-y-4">
                {state.rfqAssortment.map((item) => (
                  <div key={item.productId} className="flex gap-4 border-b pb-4">
                    <img src={item.product?.image} alt="" className="h-24 w-20 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h2 className="font-semibold">{item.product?.name}</h2>
                      <label className="mt-2 block text-xs text-[#657068]">Indicative units<input type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.productId, Number(event.target.value))} className="ml-2 w-24 rounded-lg py-1.5" /></label>
                    </div>
                    <button onClick={() => removeFromRfqAssortment(item.productId)} aria-label={`Remove ${item.product?.name}`}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-[#657068]"><ClipboardList className="mx-auto" size={34} /><p className="mt-3">No cosmetic ingredients added yet.</p><Link to="/products" className="mt-3 inline-block font-semibold text-[#a05247]">Browse ingredients</Link></div>
            )}
            <p className="mt-5 text-xs leading-5 text-[#657068]">Quantities are planning inputs only. Sample availability, pack size, MOQ and current lot lead time are confirmed in the quotation.</p>
          </section>

          <form onSubmit={submit} className="rounded-3xl bg-white p-7">
            <h2 className="font-heading text-2xl font-bold">Cosmetic ingredient RFQ</h2>
            <div className="mt-6 space-y-5">
              <label className="block"><span className="mb-2 block text-sm font-semibold">Target market</span><input required value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })} className="w-full rounded-xl" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">Company type, application and target market *</span><textarea required rows="3" value={form.targetCustomerProfile} onChange={(event) => setForm({ ...form, targetCustomerProfile: event.target.value })} placeholder="e.g. contract manufacturer, leave-on serum, EU market" className="w-full rounded-xl" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">INCI, function, use level and document requirements *</span><textarea required rows="4" value={form.specifications} onChange={(event) => setForm({ ...form, specifications: event.target.value })} placeholder="e.g. oil-soluble soothing active; TDS, SDS and representative COA required" className="w-full rounded-xl" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">Estimated first-order quantity (kg) *</span><input required type="number" min="1" value={form.estimatedQuantity} onChange={(event) => setForm({ ...form, estimatedQuantity: event.target.value })} className="w-full rounded-xl" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">Target cost, delivery destination, timing and other notes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full rounded-xl" /></label>
              <label className="flex items-start gap-3 text-xs leading-5 text-[#59655e]"><input type="checkbox" required className="mt-1 rounded"/><span>I am authorized to submit this B2B RFQ and acknowledge the <Link to="/privacy" target="_blank">Privacy Policy</Link> and <Link to="/terms" target="_blank">Terms of Use</Link>. RFQ details are sent to our sales team in Lark.</span></label>
              {status.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{status.error}</p>}
              <button disabled={status.sending || !state.rfqAssortment.length} className="w-full rounded-full bg-[#2d201d] py-4 font-semibold text-white disabled:opacity-40">{status.sending ? 'Sending…' : 'Submit ingredient RFQ'}</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
