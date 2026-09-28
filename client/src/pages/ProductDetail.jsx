import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardPlus, FileCheck2, FlaskConical, PackageCheck } from 'lucide-react';
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

  if(!p)return <div className="min-h-screen pt-40 text-center"><h1 className="text-3xl font-bold">Ingredient not found</h1><Link to="/products" className="mt-4 inline-block text-[#a05247]">View all ingredients</Link></div>;

  const gallery=Array.isArray(p.gallery)&&p.gallery.length?p.gallery:[p.image];
  const activeImage=gallery[Math.min(activeIndex,gallery.length-1)]||p.image;
  const add=async()=>{setError('');try{await addToRfqAssortment(p);setAdded(true)}catch(err){setError(err.message)}};

  return <div className="min-h-screen bg-[#fbf7f2] pt-24"><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <Link to="/products" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#6f5b55]"><ArrowLeft size={16}/> Back to ingredient portfolio</Link>
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="overflow-hidden rounded-[2.25rem] bg-[#eadfd8]"><img src={activeImage} alt={`${p.name} — view ${activeIndex+1}`} className="aspect-[4/5] w-full object-cover transition duration-300"/></div>
        {gallery.length>1&&<div className="mt-4 grid grid-cols-3 gap-3">{gallery.map((image,index)=><button type="button" key={image} onClick={()=>setActiveIndex(index)} aria-label={`View ${index+1} of ${p.name}`} aria-pressed={activeIndex===index} className={`overflow-hidden rounded-2xl border-2 bg-[#eadfd8] transition ${activeIndex===index?'border-[#a05247] shadow-sm':'border-transparent opacity-75 hover:opacity-100'}`}><img src={image} alt="" className="aspect-square w-full object-cover"/></button>)}</div>}
        <p className="mt-3 text-center text-xs text-[#81706a]">Material format · Texture detail · Formulation context</p>
      </div>
      <section className="lg:py-4">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#a05247]">{categoryNames[p.category]} · {p.badge}</p>
        <h1 className="mt-4 font-heading text-4xl font-medium text-[#2d201d] sm:text-5xl">{p.name}</h1>
        <p className="mt-3 text-lg text-[#8a5048]">{p.benefit}</p>
        <p className="mt-6 text-lg leading-8 text-[#695751]">{p.description}</p>
        <div className="mt-7 grid grid-cols-2 gap-3 border-y border-[#2d201d]/10 py-5">
          <div><span className="text-xs uppercase tracking-wider text-[#75635d]">INCI</span><strong className="mt-1 block">{p.inci||'Available on request'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#75635d]">Recommended use</span><strong className="mt-1 block">{p.recommendedUse||'Formula dependent'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#75635d]">Solubility</span><strong className="mt-1 block">{p.solubility||'See TDS'}</strong></div>
          <div><span className="text-xs uppercase tracking-wider text-[#75635d]">Pack sizes · MOQ</span><strong className="mt-1 block">{p.sizes} · {p.moq}</strong></div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link to={`/contact?product=${encodeURIComponent(p.name)}`} className="flex items-center justify-center rounded-full bg-[#2d201d] px-5 py-4 font-semibold text-white hover:bg-[#a05247]">Request quote & sample</Link>{user?<button onClick={add} disabled={added} className="flex items-center justify-center gap-2 rounded-full border border-[#2d201d]/20 px-5 py-4 font-semibold disabled:bg-rose-50 disabled:text-[#8d4940]"><ClipboardPlus size={18}/>{added?'Added to sample list':'Add to sample list'}</button>:<Link to="/login" state={{from:{pathname:`/products/${slug}`}}} className="flex items-center justify-center gap-2 rounded-full border border-[#2d201d]/20 px-5 py-4 font-semibold"><ClipboardPlus size={18}/> Sign in to build a sample list</Link>}</div>
        {error&&<p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-9"><h2 className="font-heading text-2xl font-medium">Technical highlights</h2><ul className="mt-4 space-y-3">{(p.specs||[]).map(s=><li key={s} className="flex gap-3 text-[#695751]"><Check className="mt-1 shrink-0 text-[#a05247]" size={16}/>{s}</li>)}</ul>{p.applications&&<div className="mt-6 rounded-2xl bg-[#efe2da] p-5 text-sm leading-6"><strong className="mb-1 block text-[#2d201d]">Typical applications & handling</strong>{p.applications}</div>}</div>
        <div className="mt-7 grid gap-3 border-y border-[#2d201d]/10 py-6 sm:grid-cols-3"><span className="flex items-center gap-2 text-xs"><FileCheck2 size={17}/> TDS / SDS / COA</span><span className="flex items-center gap-2 text-xs"><FlaskConical size={17}/> Evaluation samples</span><span className="flex items-center gap-2 text-xs"><PackageCheck size={17}/> Commercial pack sizes</span></div>
      </section>
    </div>
  </main></div>;
}
