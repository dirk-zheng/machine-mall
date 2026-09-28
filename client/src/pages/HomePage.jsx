import { Link } from 'react-router-dom';
import { ArrowRight, FileCheck2, FlaskConical, Microscope, PackageCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { productSlug } from '../data/seoContent';

const capabilities = [
  [Microscope, 'Function-led selection', 'Choose by INCI, performance target, solubility, use level and formulation format.'],
  [FileCheck2, 'Qualification documents', 'Review available TDS, SDS, COA and supporting quality or regulatory statements.'],
  [FlaskConical, 'Bench-ready guidance', 'Start with practical incorporation, process, pH and compatibility considerations.'],
  [PackageCheck, 'Sample to commercial lot', 'Move from evaluation quantities to documented commercial packs with clear MOQ and lead time.'],
];

export default function HomePage() {
  const { state } = useStore();
  const featured = state.products.slice(0, 6);
  return <div className="min-h-screen bg-[#fbf7f2] pt-24">
    <section className="relative min-h-[700px] overflow-hidden bg-[#ead9ce]">
      <img src="/ingredients/hero-ingredients.png" alt="Cosmetic ingredient powders, extracts and formulation samples" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#fbf6ef]/96 via-[#fbf6ef]/78 to-transparent" />
      <div className="relative mx-auto flex min-h-[700px] max-w-7xl items-center px-5 sm:px-8"><div className="max-w-2xl py-20">
        <p className="mb-5 text-xs font-bold uppercase tracking-[.28em] text-[#a05247]">Cosmetic ingredients · Technical supply</p>
        <h1 className="font-heading text-5xl font-medium leading-[1.02] text-[#2d201d] sm:text-7xl">Ingredients with a<br/><span className="font-serif italic text-[#a05247]">clear formulation role.</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-[#65524d]">Performance actives, botanical extracts and functional materials supported by practical technical guidance and lot-level documentation.</p>
        <div className="mt-9 flex flex-wrap gap-3"><Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-[#2d201d] px-7 py-4 font-semibold text-white">Explore ingredients <ArrowRight size={18}/></Link><Link to="/contact" className="rounded-full border border-[#2d201d]/20 bg-white/70 px-7 py-4 font-semibold text-[#2d201d] backdrop-blur">Request a sample</Link></div>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#74615b]"><span>Clear INCI</span><span>Recommended use levels</span><span>TDS / SDS / COA</span></div>
      </div></div>
    </section>
    <section className="border-y border-[#2d201d]/8 bg-[#2d201d] text-white"><div className="mx-auto grid max-w-7xl gap-px md:grid-cols-4">{capabilities.map(([Icon,title,desc])=><div key={title} className="flex gap-4 border-white/10 p-7 md:border-r"><Icon className="shrink-0 text-[#eeb8a8]"/><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-white/60">{desc}</p></div></div>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.24em] text-[#a05247]">Selected materials</p><h2 className="mt-3 font-heading text-4xl font-medium text-[#2d201d] sm:text-5xl">Build with documented ingredients.</h2><p className="mt-4 max-w-2xl leading-7 text-[#74615b]">Compare function, INCI, recommended use level, pack size and MOQ before requesting technical files or samples.</p></div><Link to="/products" className="inline-flex items-center gap-2 font-semibold text-[#7d3f38]">View all ingredients <ArrowRight size={17}/></Link></div>
      <div className="mt-11 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.map((product,index)=><Link key={product.id} to={`/products/${productSlug(product)}`} className="group"><div className="relative overflow-hidden rounded-[2rem] bg-[#eadfd8]"><img src={product.image} alt={product.name} className={`aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-105 ${index%3===1?'object-[58%_center]':index%3===2?'object-[78%_center]':'object-[25%_center]'}`}/><span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8d4940]">{product.badge}</span></div><h3 className="mt-4 font-heading text-xl font-medium text-[#2d201d]">{product.name}</h3><p className="mt-1 text-sm text-[#7a6963]">{product.inci} · {product.recommendedUse}</p></Link>)}</div>
    </section>
    <section className="bg-[#efe2da] py-24"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2"><img src="/ingredients/hyaluronate-detail.png" alt="Cosmetic ingredient evaluation in a formulation laboratory" className="aspect-[4/3] w-full rounded-[2.5rem] object-cover"/><div className="lg:pl-10"><FlaskConical className="text-[#a05247]" size={30}/><p className="mt-6 text-xs font-bold uppercase tracking-[.24em] text-[#a05247]">Technical collaboration</p><h2 className="mt-3 font-heading text-4xl font-medium leading-tight text-[#2d201d] sm:text-5xl">Select for the formula, not the trend.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-[#6e5b55]">Share the dosage form, process, target pH, sensory brief and claim direction. We will narrow the material options and documentation relevant to your bench review.</p><Link to="/services/formulation-support" className="mt-8 inline-flex items-center gap-2 border-b border-[#2d201d] pb-1 font-semibold">Explore formulation support <ArrowRight size={17}/></Link></div></div></section>
  </div>;
}
