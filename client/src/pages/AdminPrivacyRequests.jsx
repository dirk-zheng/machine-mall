import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { adminAPI } from '../api';

export default function AdminPrivacyRequests() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const load = () => adminAPI.getPrivacyRequests().then(setItems).catch((requestError) => setError(requestError.message));
  useEffect(() => { load(); }, []);
  const update = async (id, status) => {
    setError('');
    try { await adminAPI.updatePrivacyRequest(id, status); await load(); } catch (requestError) { setError(requestError.message); }
  };
  return <div className="min-h-screen bg-slate-50 pb-16 pt-24"><main className="mx-auto max-w-6xl px-5 py-10"><p className="text-sm font-semibold uppercase tracking-wider text-primary">Admin · restricted</p><h1 className="mt-2 flex items-center gap-3 font-heading text-4xl font-bold"><ShieldCheck className="text-primary"/>Privacy request queue</h1><p className="mt-3 max-w-3xl text-slate-500">Verify the requester through the supplied business email before accessing, changing, exporting, or deleting data. Record completion here; do not fulfill requests from chat alone.</p>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}<section className="mt-8 space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{item.reference} · {item.requestType}</p><h2 className="mt-2 font-semibold">{item.email}</h2><p className="mt-2 text-sm text-slate-500">Submitted {new Date(item.createdAt).toLocaleString()}</p>{item.details && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.details}</p>}</div><label className="shrink-0 text-sm font-semibold">Status<select value={item.status} onChange={(event) => update(item.id, event.target.value)} className="mt-2 block rounded-xl border-slate-300 font-normal"><option value="verification_required">Verify identity</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="denied">Denied</option></select></label></div></article>)}{items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No privacy requests.</p>}</section></main></div>;
}
