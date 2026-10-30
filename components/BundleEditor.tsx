'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check, Download, GripVertical, RotateCcw, Save, X } from 'lucide-react';
import {
  BUNDLE_RATIOS, DEFAULT_BUNDLE_CROP, exportBundle, postingPlacement, saveBundle,
  type BundleCrop, type BundleDraft, type BundleItem, type BundleRatio,
} from '@/utils/bundles';

interface Props {
  draft: BundleDraft;
  onChange: (draft: BundleDraft) => void;
  onBack: () => void;
  onSaved: () => void;
  initiallySaved?: boolean;
}

function useFileUrl(file: File) {
  const [source, setSource] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setSource({ file, url }));
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(url); };
  }, [file]);
  return source?.file === file ? source.url : null;
}

function BundleThumbnail({ item }: { item: BundleItem }) {
  const url = useFileUrl(item.file);
  return url ? <Image unoptimized fill sizes="100px" src={url} alt={item.file.name} className="object-cover" draggable={false} /> : null;
}

function CropPreview({ item, ratio, background, onCrop, disabled }: {
  item: BundleItem; ratio: number | null; background: string;
  onCrop: (crop: Partial<BundleCrop>) => void; disabled: boolean;
}) {
  const url = useFileUrl(item.file);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 400, height: 400 });
  const [loadError, setLoadError] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: BundleCrop; overflowX: number; overflowY: number } | null>(null);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const aspect = ratio ?? (imageSize.width && imageSize.height ? imageSize.width / imageSize.height : 1);
  const crop = ratio === null ? DEFAULT_BUNDLE_CROP : item.crop;
  const placement = imageSize.width ? postingPlacement(imageSize.width, imageSize.height, containerSize.width, containerSize.height, crop) : null;
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || ratio === null || crop.fit !== 'cover' || !placement) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop, overflowX: Math.max(0, placement.width - containerSize.width), overflowY: Math.max(0, placement.height - containerSize.height) };
    event.preventDefault();
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    onCrop({
      x: current.overflowX ? clamp(current.crop.x - (event.clientX - current.x) / current.overflowX) : current.crop.x,
      y: current.overflowY ? clamp(current.crop.y - (event.clientY - current.y) / current.overflowY) : current.crop.y,
    });
  };
  return <div className="flex w-full justify-center">
    <div ref={frame} className={`relative w-full max-w-md overflow-hidden rounded border border-slate-600 ${ratio !== null && crop.fit === 'cover' ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ aspectRatio: aspect, background, touchAction: ratio !== null && crop.fit === 'cover' ? 'none' : 'auto' }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} aria-label="Posting image crop preview">
      {url && <Image unoptimized src={url} width={imageSize.width || 1000} height={imageSize.height || 1000} alt={item.file.name} draggable={false} onLoad={(event) => { const image = event.currentTarget; setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); setLoadError(false); }} onError={() => setLoadError(true)} style={placement ? { position: 'absolute', left: placement.x, top: placement.y, width: placement.width, height: placement.height, maxWidth: 'none' } : { width: '100%', height: '100%', objectFit: 'contain' }} />}
      {loadError && <p role="alert" className="absolute inset-0 grid place-items-center bg-slate-900 p-4 text-center text-sm">This image cannot be previewed. Choose a browser-supported source before exporting.</p>}
    </div>
  </div>;
}

const controlClass = 'min-h-10 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 disabled:opacity-40';

export default function BundleEditor({ draft, onChange, onBack, onSaved, initiallySaved = false }: Props) {
  const [activeId, setActiveId] = useState(draft.items[0]?.id);
  const [savedDraft, setSavedDraft] = useState<BundleDraft | null>(initiallySaved ? draft : null);
  const [includePosting, setIncludePosting] = useState(false);
  const [busy, setBusy] = useState<'save' | 'export' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dragging = useRef<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const current = draft.items.find((item) => item.id === activeId) ?? draft.items[0];
  const selectedIndex = draft.items.findIndex((item) => item.id === current?.id);
  const preset = BUNDLE_RATIOS.find((candidate) => candidate.id === draft.ratio) ?? BUNDLE_RATIOS[0];
  const isSaved = savedDraft === draft;
  const validName = draft.name.trim().length > 0 && draft.name.trim().length <= 80;
  const update = (patch: Partial<BundleDraft>) => {
    onChange({ ...draft, ...patch, updatedAt: Date.now() });
    setMessage('');
  };
  const updateCrop = (patch: Partial<BundleCrop>) => {
    if (!current || busy) return;
    update({ items: draft.items.map((item) => item.id === current.id ? { ...item, crop: { ...item.crop, ...patch } } : item) });
  };
  const reorder = (source: string, target: string) => {
    if (busy || source === target) return;
    const sourceItem = draft.items.find((item) => item.id === source);
    if (!sourceItem || !draft.items.some((item) => item.id === target)) return;
    const items = draft.items.filter((item) => item.id !== source);
    items.splice(items.findIndex((item) => item.id === target), 0, sourceItem);
    update({ items });
  };
  const move = (id: string, delta: number) => {
    const index = draft.items.findIndex((item) => item.id === id);
    const other = draft.items[index + delta];
    if (!other || busy) return;
    if (delta < 0) reorder(id, other.id); else reorder(other.id, id);
    requestAnimationFrame(() => strip.current?.querySelector<HTMLButtonElement>(`[data-bundle-grip="${id}"]`)?.focus());
  };
  const save = async () => {
    if (!validName || busy) return;
    setBusy('save'); setError(''); setMessage('Saving local draft…');
    try {
      await saveBundle(draft);
      setSavedDraft(draft);
      setMessage('Draft saved on this browser. Download a ZIP for a portable backup.');
      onSaved();
    } catch (failure) {
      setSavedDraft(null);
      setMessage('');
      setError(`Draft is unsaved. Your selection is still here; ZIP export remains available. ${failure instanceof Error ? failure.message : 'Local storage is unavailable.'}`);
    } finally { setBusy(null); }
  };
  const download = async () => {
    if (!validName || busy) return;
    setBusy('export'); setError(''); setMessage('Preparing ZIP…');
    try {
      const blob = await exportBundle(draft, includePosting && draft.ratio !== 'original', setMessage);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${draft.name.trim().replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 80) || 'photo-bundle'}.zip`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      setMessage('ZIP download started. Keep the ZIP as your restorable backup.');
    } catch (failure) {
      setMessage('');
      setError(`ZIP could not be created. Your draft is unchanged. ${failure instanceof Error ? failure.message : 'Please retry.'}`);
    } finally { setBusy(null); }
  };
  if (!current) return null;
  return <main className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3">
      <button type="button" onClick={onBack} disabled={!!busy} className={controlClass}><ArrowLeft className="mr-1 inline h-4 w-4" /> Photos</button>
      <div className="flex-1"><h1 className="text-base font-semibold">Post bundle</h1><p className="text-xs text-slate-400">{draft.items.length}/20 images · <span role="status">{isSaved ? 'Saved locally' : 'Unsaved changes'}</span></p></div>
      <button type="button" onClick={() => void save()} disabled={!!busy || !validName} className={controlClass}><Save className="mr-1 inline h-4 w-4" />{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
      <button type="button" onClick={() => void download()} disabled={!!busy || !validName} className={`${controlClass} border-blue-400 bg-blue-500 font-medium text-white`}><Download className="mr-1 inline h-4 w-4" />{busy === 'export' ? 'Preparing ZIP…' : 'Download ZIP'}</button>
    </header>
    <div aria-live="polite" className="px-4">{message && <p className="mt-3 rounded bg-slate-800 px-3 py-2 text-sm">{message}</p>}{error && <p role="alert" className="mt-3 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-100">{error}</p>}</div>
    <fieldset disabled={!!busy} className="min-w-0 border-0 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-slate-300">Bundle nickname<input aria-label="Bundle nickname" maxLength={80} value={draft.name} onChange={(event) => update({ name: event.target.value })} className={controlClass} /></label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">Gallery ratio<select aria-label="Gallery ratio" value={draft.ratio} onChange={(event) => update({ ratio: event.target.value as BundleRatio })} className={controlClass}>{BUNDLE_RATIOS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">Posting copy width<select aria-label="Posting copy width" value={draft.width} disabled={draft.ratio === 'original'} onChange={(event) => update({ width: Number(event.target.value) as 1080 | 2160 })} className={controlClass}><option value={1080}>1080 px</option><option value={2160}>2160 px · HQ</option></select></label>
      </div>
      {!validName && <p className="mt-2 text-xs text-amber-200">Give this bundle a nickname before saving or exporting.</p>}
      <div className="mt-4 flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Posting order</h2><p className="text-xs text-slate-400">Drag a grip or focus it and use ← →. First image is the cover.</p></div>
      <div ref={strip} className="mt-2 flex gap-2 overflow-x-auto pb-2" aria-label="Bundle image order">
        {draft.items.map((item, index) => <div key={item.id} className={`relative w-24 shrink-0 rounded border-2 ${item.id === current.id ? 'border-blue-400' : 'border-slate-700'}`} onDragOver={(event) => { if (dragging.current) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const source = dragging.current; dragging.current = null; if (source) reorder(source, item.id); }}>
          <button type="button" onClick={() => setActiveId(item.id)} aria-label={`Edit image ${index + 1}: ${item.file.name}`} aria-pressed={item.id === current.id} className="relative block h-24 w-full overflow-hidden"><BundleThumbnail item={item} /><span className="absolute bottom-0 left-0 rounded-tr bg-slate-950/90 px-2 py-1 text-xs">{index + 1}</span></button>
          <button type="button" draggable data-bundle-grip={item.id} onDragStart={(event) => { dragging.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }} onDragEnd={() => { dragging.current = null; }} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(item.id, event.key === 'ArrowLeft' ? -1 : 1); } }} aria-label={`Reorder bundle image ${index + 1}: ${item.file.name}`} title="Drag or use left/right arrow keys" className="absolute left-0 top-0 grid h-11 w-11 cursor-grab place-items-center rounded-br bg-slate-950/80"><GripVertical size={17} /></button>
          <button type="button" disabled={draft.items.length <= 1} onClick={() => update({ items: draft.items.filter((candidate) => candidate.id !== item.id) })} aria-label={`Remove bundle image ${index + 1}: ${item.file.name}`} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-bl bg-slate-950/80 disabled:opacity-30"><X size={16} /></button>
        </div>)}
      </div>
      <div className="mt-4 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0" aria-label="Crop selected image">
          <div className="mb-3 flex items-center gap-2"><button type="button" className={controlClass} disabled={selectedIndex <= 0} onClick={() => setActiveId(draft.items[selectedIndex - 1].id)} aria-label="Previous bundle image"><ArrowLeft size={16} /></button><p className="min-w-0 flex-1 truncate text-center text-xs text-slate-300" title={current.file.name}>Image {selectedIndex + 1}/{draft.items.length} · {current.file.name}</p><button type="button" className={controlClass} disabled={selectedIndex >= draft.items.length - 1} onClick={() => setActiveId(draft.items[selectedIndex + 1].id)} aria-label="Next bundle image"><ArrowRight size={16} /></button></div>
          <CropPreview key={current.id} item={current} ratio={preset.ratio} background={draft.background} onCrop={updateCrop} disabled={!!busy} />
          <p className="mt-2 text-center text-xs text-slate-400">{draft.ratio === 'original' ? 'Original proportions. Choose a ratio to prepare posting copies.' : current.crop.fit === 'cover' ? 'Drag the image to frame it, or use the position controls.' : 'Entire image fitted inside the shared gallery ratio.'}</p>
        </section>
        <section className="flex min-w-0 flex-col gap-4 rounded border border-slate-700 bg-slate-900 p-4" aria-label="Bundle framing and export">
          <h2 className="text-sm font-semibold">Framing · image {selectedIndex + 1}</h2>
          <fieldset disabled={draft.ratio === 'original'} className="flex flex-col gap-4 border-0 disabled:opacity-40">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Bundle image fit"><button type="button" aria-pressed={current.crop.fit === 'cover'} className={`${controlClass} ${current.crop.fit === 'cover' ? 'border-blue-400' : ''}`} onClick={() => updateCrop({ fit: 'cover' })}>Crop to fill</button><button type="button" aria-pressed={current.crop.fit === 'contain'} className={`${controlClass} ${current.crop.fit === 'contain' ? 'border-blue-400' : ''}`} onClick={() => updateCrop({ fit: 'contain' })}>Fit entire image</button></div>
            <label className="flex flex-col gap-2 text-xs">Zoom · {current.crop.zoom.toFixed(2)}×<input aria-label="Bundle image zoom" type="range" min={1} max={3} step={0.01} value={current.crop.zoom} disabled={current.crop.fit === 'contain'} onChange={(event) => updateCrop({ zoom: Number(event.target.value) })} /></label>
            <label className="flex flex-col gap-2 text-xs">Horizontal position<input aria-label="Bundle horizontal position" type="range" min={0} max={1} step={0.01} value={current.crop.x} disabled={current.crop.fit === 'contain'} onChange={(event) => updateCrop({ x: Number(event.target.value) })} /></label>
            <label className="flex flex-col gap-2 text-xs">Vertical position<input aria-label="Bundle vertical position" type="range" min={0} max={1} step={0.01} value={current.crop.y} disabled={current.crop.fit === 'contain'} onChange={(event) => updateCrop({ y: Number(event.target.value) })} /></label>
            <label className="flex items-center justify-between gap-2 text-xs">Fit background · whole bundle<input aria-label="Bundle fit background" type="color" value={draft.background} onChange={(event) => update({ background: event.target.value })} className="h-9 w-12 rounded border border-slate-500 bg-transparent" /></label>
            <button type="button" onClick={() => updateCrop({ ...DEFAULT_BUNDLE_CROP })} className={controlClass}><RotateCcw className="mr-1 inline h-4 w-4" />Reset this crop</button>
          </fieldset>
          <div className="border-t border-slate-700 pt-4"><label className="flex items-start gap-2 text-sm"><input aria-label="Include posting copies" type="checkbox" checked={includePosting && draft.ratio !== 'original'} disabled={draft.ratio === 'original'} onChange={(event) => setIncludePosting(event.target.checked)} className="mt-1" /><span>Include posting copies<small className="mt-1 block text-xs leading-relaxed text-slate-400">{includePosting && draft.ratio !== 'original' ? 'images/ contains framed JPEGs; originals/ retains untouched source files for recovery.' : 'images/ contains untouched originals. Crop settings are saved, but are not applied to those files.'}</small></span></label></div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />Originals and their embedded metadata are retained. Posting copies are JPEGs; enlarging a small source does not create extra detail.</p>
        </section>
      </div>
    </fieldset>
    <footer className="mt-auto border-t border-slate-700 px-4 py-3 text-xs leading-relaxed text-slate-400"><strong className="text-slate-200">On iPhone:</strong> open the ZIP in Files, then import the images/ folder. Check the numbered contact sheet when selecting images in Instagram; phone import order is not guaranteed. Keep the ZIP to restore this bundle later.</footer>
  </main>;
}
