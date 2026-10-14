import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardPlus, CreditCard, FileCheck2, FlaskConical, PackageCheck, Palette, Settings2, Wifi } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { categoryNames } from '../data/products';
import { productSlug } from '../data/seoContent';

export default function ProductDetail(){
  const {slug}=useParams();
  const {state,addToRfqAssortment}=useStore();
  const {user}=useAuth();
  const [added,setAdded]=useState(false);
  const [error,setError]=useState('');
  const [activeIndex,setActiveIndex]=useState(0);
  const p=state.products.find(x=>productSlug(x)===slug);

  useEffect(()=>{setActiveIndex(0);setAdded(false);setError('')},[slug]);

  if(!p)return <div className="min-h-screen pt-40 text-center"><h1 className="text-3xl font-bold">Machine not found</h1><Link to="/products" className="mt-4 inline-block text-[#087da8]">View all machines</Link></div>;

  const gallery=Array.isArray(p.gallery)&&p.gallery.length?p.gallery:[p.image];
  const activeImage=gallery[Math.min(activeIndex,gallery.length-1)]||p.image;
  const add=async()=>{setError('');try{await addToRfqAssortment(p);setAdded(true)}catch(err){setError(err.message)}};
  const customOptions=[
    [Palette,'Exterior & branding','Cabinet color, full-body vinyl wrap, illuminated logo, fascia graphics and custom screen content.'],
    [Settings2,'Product & dispensing','Shelf spacing, spiral size, conveyor, elevator, locker cells and collection-bin geometry.'],
    [CreditCard,'Payment & access','Card, mobile wallet, QR, cash, membership, employee badge and identity verification.'],
    [Wifi,'Software & connectivity','Custom interface, 4G/Wi-Fi/Ethernet, telemetry, API/ERP integration and remote promotions.'],
  ];

  return <div className="min-h-screen bg-[#f7f9fc] pt-24"><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <Link to="/products" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#5b687a]"><ArrowLeft size={16}/> Back to machine lineup</Link>
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="overflow-hidden rounded-[2.25rem] bg-[#eef2f6]"><img src={activeImage} alt={`${p.name} — view ${activeIndex+1}`} className="aspect-[4/3] w-full object-contain p-4 mix-blend-multiply transition duration-300"/></div>
        {gallery.length>1&&<div className="mt-4 grid grid-cols-3 gap-3">{gallery.map((image,index)=><button type="button" key={image} onClick={()=>setActiveIndex(index)} aria-label={`View ${index+1} of ${p.name}`} aria-pressed={activeIndex===index} className={`overflow-hidden rounded-2xl border-2 bg-[#eef2f6] transition ${activeIndex===index?'border-[#087da8] shadow-sm':'border-transparent opacity-75 hover:opacity-100'}`}><img src={image} alt="" className="aspect-square w-full object-contain p-2 mix-blend-multiply"/></button>)}</div>}
        <p className="mt-3 text-center text-xs text-[#738094]">Installed machine · Product capacity · Real location context</p>
      </div>
      <section className="lg:py-4">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#087da8]">{categoryNames[p.category]} · {p.badge}</p>
        <h1 className="mt-4 font-heading text-4xl font-medium text-[#172033] sm:text-5xl">{p.name}</h1>
        <p className="mt-3 text-lg text-[#075f85]">{p.benefit}</p>
        <p className="mt-6 text-lg leading-8 text-[#526176]">{p.description}</p>
        <div className="mt-7 grid grid-cols-2 gap-3 border-y border-[#172033]/10 py-5">
          <div><span className="text-xs uppercase tracking-wider text-[#677386]">Capacity</span><strong className="mt-1 block">{p.inci||'Configured to order'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#677386]">Best for</span><strong className="mt-1 block">{p.recommendedUse||'Commercial locations'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#677386]">Temperature</span><strong className="mt-1 block">{p.solubility||'Configuration dependent'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#677386]">Dimensions · MOQ</span><strong className="mt-1 block">{p.sizes} · {p.moq}</strong></div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link to={`/contact?product=${encodeURIComponent(p.name)}`} className="flex items-center justify-center rounded-full bg-[#111827] px-5 py-4 font-semibold text-white hover:bg-[#087da8]">Request deployment quote</Link>{user?<button onClick={add} disabled={added} className="flex items-center justify-center gap-2 rounded-full border border-[#111827]/20 px-5 py-4 font-semibold disabled:bg-cyan-50 disabled:text-[#075f85]"><ClipboardPlus size={18}/>{added?'Added to quote list':'Add to quote list'}</button>:<Link to="/login" state={{from:{pathname:`/products/${slug}`}}} className="flex items-center justify-center gap-2 rounded-full border border-[#111827]/20 px-5 py-4 font-semibold"><ClipboardPlus size={18}/> Sign in to build a quote list</Link>}</div>
        {error&&<p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-9"><h2 className="font-heading text-2xl font-bold">Machine highlights</h2><ul className="mt-4 space-y-3">{(p.specs||[]).map(s=><li key={s} className="flex gap-3 text-[#5b687a]"><Check className="mt-1 shrink-0 text-[#087da8]" size={16}/>{s}</li>)}</ul>{p.applications&&<div className="mt-6 rounded-2xl bg-[#e8f1f5] p-5 text-sm leading-6"><strong className="mb-1 block text-[#111827]">Location fit & configuration</strong>{p.applications}</div>}</div>
        <div className="mt-7 grid gap-3 border-y border-[#111827]/10 py-6 sm:grid-cols-3"><span className="flex items-center gap-2 text-xs"><FileCheck2 size={17}/> Site survey</span><span className="flex items-center gap-2 text-xs"><FlaskConical size={17}/> Payment setup</span><span className="flex items-center gap-2 text-xs"><PackageCheck size={17}/> Delivery & installation</span></div>
      </section>
    </div>
    <section className="mt-20 rounded-[2.5rem] bg-[#111827] p-7 text-white sm:p-10"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#55c7df]">Customize this model</p><h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">Configure {p.name} around your product.</h2><p className="mt-4 leading-7 text-white/65">Send product dimensions, package weight, temperature range, payment market, desired branding and order quantity. Our team will return a recommended configuration and project scope.</p></div><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{customOptions.map(([Icon,title,body])=><div key={title} className="rounded-2xl bg-white/7 p-5"><Icon className="text-[#55c7df]" size={22}/><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{body}</p></div>)}</div><Link to={`/contact?product=${encodeURIComponent(`${p.name} custom configuration`)}`} className="mt-8 inline-flex items-center rounded-full bg-[#087da8] px-6 py-3.5 font-semibold text-white">Request custom configuration</Link></section>
  </main></div>;
}
