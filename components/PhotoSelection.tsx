'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent, type CSSProperties } from 'react';
import Image from 'next/image';
import BundleEditor from '@/components/BundleEditor';
import { createBundle, listBundles, loadBundle, restoreBundleZip, type BundleDraft } from '@/utils/bundles';
import { useVirtualizer } from '@tanstack/react-virtual';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import { ArrowLeft, ArrowRight, Check, FolderOpen, Images, Search, X, Expand, GripVertical } from 'lucide-react';
import { DEFAULT_GALLERY_SETTINGS, GALLERY_SETTINGS_KEY, ThumbnailPool, appendGalleryAssets, gridGeometry, isImageFile, readGallerySettings, toggleSelection, moveBefore, replaceVisibleOrder, suggestColourOrder, type GalleryAsset, type GallerySettings } from '@/utils/gallery';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import 'yet-another-react-lightbox/plugins/counter.css';

interface Props {
  maxPhotos: number;
  onCreateCollage: (files: File[]) => Promise<void>;
  onBack: () => void;
  isProcessing: boolean;
  processingProgress: { current: number; total: number };
  importNotice: string | null;
}

function Thumbnail({ asset, pool, fit = 'cover' }: { asset: GalleryAsset; pool: ThumbnailPool; fit?: 'cover' | 'contain' }) {
  const [state, setState] = useState<{ url?: string; error?: boolean }>({});
  useEffect(() => {
    let alive = true;
    let url: string | undefined;
    pool.request(asset).then((result) => {
      if (!alive) return;
      url = URL.createObjectURL(result.blob);
      setState({ url });
    }).catch(() => { if (alive) setState({ error: true }); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [asset, pool]);
  return state.url
    ? <Image unoptimized fill src={state.url} alt={asset.file.name} draggable={false} style={{ objectFit: fit }} sizes="384px" />
    : <span className="gallery-placeholder">{state.error ? 'Cannot preview' : <Images size={22} aria-hidden="true" />}</span>;
}

function GalleryViewer({ assets, initialIndex, selected, maxPhotos, pool, onToggle, onClose, onView, selectionLabel }: {
  assets: GalleryAsset[]; initialIndex: number; selected: string[]; maxPhotos: number; pool: ThumbnailPool;
  onToggle: (id: string) => void; onClose: () => void; onView: (index: number) => void; selectionLabel: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [slides, setSlides] = useState<Array<{ src: string; title: string; description: string }>>([]);
  useEffect(() => {
    const urls = assets.map((asset) => ({ src: URL.createObjectURL(asset.file), title: asset.file.name, description: asset.path }));
    const frame = requestAnimationFrame(() => setSlides(urls));
    return () => { cancelAnimationFrame(frame); urls.forEach((slide) => URL.revokeObjectURL(slide.src)); };
  }, [assets]);
  const selectedNow = selected.includes(assets[index]?.id);
  return <Lightbox open close={onClose} index={index} slides={slides}
    plugins={[Zoom, Fullscreen, Counter, Thumbnails]} carousel={{ preload: 1 }}
    on={{ view: ({ index: next }) => { setIndex(next); onView(next); } }}
    thumbnails={{ width: 70, height: 54, gap: 2, padding: 0, border: 0 }}
    toolbar={{ buttons: [<button key="select" type="button" className="yarl__button gallery-viewer-select" aria-label={selectedNow ? `Remove from ${selectionLabel}` : `Add to ${selectionLabel}`} disabled={!selectedNow && selected.length >= maxPhotos} aria-pressed={selectedNow} onClick={() => onToggle(assets[index].id)}>{selectedNow ? 'Selected' : `Add to ${selectionLabel}`} · {selected.length}/{maxPhotos}</button>, 'close'] }}
    render={{ thumbnail: ({ slide }) => {
      const position = slides.findIndex((candidate) => candidate.src === slide.src);
      return assets[position] ? <div className="gallery-viewer-thumb"><Thumbnail asset={assets[position]} pool={pool} /></div> : null;
    } }} />;
}

function indexedColours(assets: GalleryAsset[], pool: ThumbnailPool) { return assets.filter((asset) => pool.metadata.get(asset.id)?.edgeColour).length; }

export default function PhotoSelection({ maxPhotos: collageMaxPhotos, onCreateCollage, onBack, isProcessing, processingProgress, importNotice }: Props) {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [intent, setIntent] = useState<'collage' | 'bundle'>('collage');
  const [collageSelected, setCollageSelected] = useState<string[]>([]);
  const [bundleSelected, setBundleSelected] = useState<string[]>([]);
  const selected = intent === 'bundle' ? bundleSelected : collageSelected;
  const setSelected = intent === 'bundle' ? setBundleSelected : setCollageSelected;
  const maxPhotos = intent === 'bundle' ? 20 : collageMaxPhotos;
  const selectionLabel = intent === 'bundle' ? 'bundle' : 'collage';
  const [bundleDraft, setBundleDraft] = useState<BundleDraft | null>(null);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleSaved, setBundleSaved] = useState(false);
  const [savedBundles, setSavedBundles] = useState<Array<{ id: string; name: string; count: number; updatedAt: number }>>([]);
  const [showBundles, setShowBundles] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  const refreshBundles = useCallback(async () => {
    try { setSavedBundles(await listBundles()); }
    catch { setNotice('Saved bundles could not be read. You can still select photos and export a recovery ZIP.'); }
  }, []);
  useEffect(() => { void refreshBundles(); }, [refreshBundles]);
  const [settings, setSettings] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [orientation, setOrientation] = useState('all');
  const [notice, setNotice] = useState('');
  const [suggestion, setSuggestion] = useState<{ ids: string[]; region: 'edgeColour' | 'centreColour' } | null>(null);
  const [colourRegion, setColourRegion] = useState<'edgeColour' | 'centreColour'>('edgeColour');
  const pendingFocus = useRef<string | null>(null);
  const dragging = useRef<{ id: string; area: 'library' | 'tray' } | null>(null);
  const [revision, setRevision] = useState(0);
  const [viewer, setViewer] = useState<{ assets: GalleryAsset[]; index: number } | null>(null);
  const [width, setWidth] = useState(900);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const notifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pool] = useState(() => new ThumbnailPool(() => {
    if (notifyTimer.current === null) notifyTimer.current = setTimeout(() => { notifyTimer.current = null; setRevision((value) => value + 1); }, 100);
  }));
  useEffect(() => {
    pool.activate();
    let stored = DEFAULT_GALLERY_SETTINGS;
    try { stored = readGallerySettings(JSON.parse(localStorage.getItem(GALLERY_SETTINGS_KEY) || 'null')); } catch {}
    const frame = requestAnimationFrame(() => { setSettings(stored); setSettingsReady(true); });
    folderInput.current?.setAttribute('webkitdirectory', '');
    return () => { pool.dispose(); cancelAnimationFrame(frame); if (notifyTimer.current) clearTimeout(notifyTimer.current); };
  }, [pool]);
  useEffect(() => {
    if (!settingsReady) return;
    try { localStorage.setItem(GALLERY_SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }, [settings, settingsReady]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(entry.contentRect.width); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const update = (patch: Partial<GallerySettings>) => { if (patch.sort) setSuggestion(null); setSettings((old) => ({ ...old, ...patch })); };
  const addFiles = useCallback((files: File[]) => {
    setSuggestion(null);
    setAssets((old) => appendGalleryAssets(old, files));
    const skipped = files.filter((file) => !isImageFile(file) || file.size > 25 * 1024 * 1024).length;
    setNotice(skipped ? `${skipped} unsupported or over-25 MB files skipped. Originals are unchanged.` : '');
  }, []);
  const inputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || [])); event.target.value = '';
  };
  // Background indexing visits two images at a time; visible thumbnails share the same decode queue.
  useEffect(() => {
    let cancelled = false;
    let cursor = 0;
    const worker = async () => {
      while (!cancelled && cursor < assets.length) {
        const asset = assets[cursor++];
        if (pool.metadata.has(asset.id)) continue;
        try { await pool.request(asset); } catch {}
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    void worker(); void worker();
    return () => { cancelled = true; };
  }, [assets, pool]);
  const folders = useMemo(() => Array.from(new Set(assets.map((asset) => asset.folder).filter(Boolean))).sort(), [assets]);
  const visible = useMemo(() => {
    void revision;
    return assets.filter((asset) => {
      const meta = pool.metadata.get(asset.id);
      if (query && !asset.path.toLowerCase().includes(query.toLowerCase())) return false;
      if (folder && !(asset.folder === folder || asset.folder.startsWith(`${folder}/`))) return false;
      if (orientation !== 'all') {
        if (!meta || meta.error) return false;
        const kind = meta.width === meta.height ? 'square' : meta.width > meta.height ? 'landscape' : 'portrait';
        if (kind !== orientation) return false;
      }
      return true;
    }).sort((a, b) => settings.sort === 'manual' ? 0 : settings.sort === 'name' ? a.path.localeCompare(b.path, undefined, { numeric: true }) : settings.sort === 'newest' ? b.file.lastModified - a.file.lastModified : a.file.lastModified - b.file.lastModified);
  }, [assets, query, folder, orientation, settings.sort, pool, revision]);
  const displayAssets = useMemo(() => {
    if (!suggestion) return visible;
    const positions = new Map(suggestion.ids.map((id, i) => [id, i]));
    return [...visible].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
  }, [visible, suggestion]);
  const reorder = (area: 'library' | 'tray', source: string, target: string) => {
    if (area === 'tray') setSelected((old) => moveBefore(old, source, target));
    else {
      const ordered = moveBefore(visible.map((asset) => asset.id), source, target);
      const base = replaceVisibleOrder(assets.map((asset) => asset.id), visible.map((asset) => asset.id));
      const next = replaceVisibleOrder(base, ordered);
      const byId = new Map(assets.map((asset) => [asset.id, asset]));
      setAssets(next.map((id) => byId.get(id)!));
      update({ sort: 'manual' });
    }
    setNotice('Order updated. Original files are unchanged.');
  };
  const dragStart = (event: DragEvent, id: string, area: 'library' | 'tray') => {
    dragging.current = { id, area };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };
  const dropOn = (event: DragEvent, id: string, area: 'library' | 'tray') => {
    if (!dragging.current) return;
    event.preventDefault(); event.stopPropagation();
    if (dragging.current.area === area) reorder(area, dragging.current.id, id);
    dragging.current = null;
  };
  const keyboardMove = (event: React.KeyboardEvent, id: string, area: 'library' | 'tray') => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const ids = area === 'tray' ? selected : visible.map((asset) => asset.id);
    const index = ids.indexOf(id);
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    if (area === 'library') pendingFocus.current = id;
    if (delta < 0) reorder(area, id, ids[next]);
    else reorder(area, ids[next], id);
  };
  const geometry = gridGeometry(width, settings);
  const rows = useVirtualizer({ count: Math.ceil(displayAssets.length / geometry.columns), getScrollElement: () => viewport.current, estimateSize: () => geometry.rowHeight + (settings.labels ? 22 : 0), overscan: 3 });
  useEffect(() => { rows.measure(); }, [rows, geometry.rowHeight, settings.labels]);
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const index = displayAssets.findIndex((asset) => asset.id === id);
    if (index < 0) { pendingFocus.current = null; return; }
    rows.scrollToIndex(Math.floor(index / geometry.columns));
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      viewport.current?.querySelector<HTMLButtonElement>(`[data-asset-id="${id}"] .gallery-grip`)?.focus();
      pendingFocus.current = null;
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [displayAssets, rows, geometry.columns]);
  const select = (id: string, range = false) => {
    if (!selected.includes(id) && selected.length >= maxPhotos) setNotice(`Your ${selectionLabel} has ${maxPhotos} photos. Remove one to choose another.`);
    const previousAnchor = anchor.current;
    setSelected((old) => toggleSelection(old, displayAssets.map((asset) => asset.id), id, previousAnchor, range, maxPhotos));
    anchor.current = id;
  };
  const selectedAssets = selected.map((id) => assets.find((asset) => asset.id === id)!).filter(Boolean);
  const viewed = useRef<number>(0);
  const closeViewer = () => {
    const asset = viewer?.assets[viewed.current];
    setViewer(null);
    const index = displayAssets.findIndex((candidate) => candidate.id === asset?.id);
    if (asset && index >= 0) {
      rows.scrollToIndex(Math.floor(index / geometry.columns));
      requestAnimationFrame(() => requestAnimationFrame(() => viewport.current?.querySelector<HTMLButtonElement>(`[data-asset-id="${asset.id}"] .gallery-image`)?.focus()));
    }
  };
  const openStoredBundle = (draft: BundleDraft, saved: boolean) => {
    // A reopened bundle adds its own snapshot to the library; filenames never establish identity.
    const items = draft.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    setAssets((old) => [...old, ...items.map((item) => ({ id: item.id, file: item.file, path: `Bundle ${draft.name}/${item.file.name}`, folder: `Bundle ${draft.name}` }))]);
    setBundleSelected(items.map((item) => item.id));
    setBundleDraft({ ...draft, items }); setBundleSaved(saved); setBundleOpen(true);
    setIntent('bundle'); setShowBundles(false); setSuggestion(null);
  };
  const prepareBundle = () => {
    const files = selectedAssets.map((asset) => asset.file);
    let fresh: BundleDraft;
    try { fresh = createBundle(files); } catch (error) { setNotice(error instanceof Error ? error.message : 'These photos could not be prepared.'); return; }
    const existing = new Map(bundleDraft?.items.map((item) => [item.id, item]) ?? []);
    const items = selectedAssets.map((asset) => ({ id: asset.id, file: asset.file, crop: existing.get(asset.id)?.crop ?? fresh.items[0].crop }));
    setBundleDraft(bundleDraft ? { ...bundleDraft, items, updatedAt: Date.now() } : { ...fresh, items });
    setBundleSaved(false); setBundleOpen(true);
  };
  const indexed = pool.metadata.size;
  const errors = Array.from(pool.metadata.values()).filter((value) => value.error).length;
  const galleryStyle = { '--gallery-gap': `${settings.gap}px` } as CSSProperties;

  return <><div hidden={bundleOpen}><main className="media-library" style={galleryStyle} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!isProcessing && !bundleBusy) addFiles(Array.from(event.dataTransfer.files)); }}>
    <input ref={fileInput} type="file" multiple accept="image/*" onChange={inputChanged} hidden />
    <input ref={folderInput} type="file" multiple onChange={inputChanged} hidden />
    <input ref={restoreInput} type="file" accept=".zip,application/zip" hidden onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBundleBusy(true); setNotice('Checking bundle backup…');
      void restoreBundleZip(file).then((draft) => { openStoredBundle(draft, false); setNotice('Backup restored as an unsaved draft. Save it locally when ready.'); }).catch((error) => setNotice(error instanceof Error ? error.message : 'Could not restore this backup.')).finally(() => setBundleBusy(false));
    }} />
    <header className="gallery-header">
      <button className="gallery-icon" onClick={onBack} aria-label="Back to home" disabled={isProcessing || bundleBusy}><ArrowLeft size={18} /></button>
      <div><h1>Photo library</h1><span>{assets.length.toLocaleString()} images · {visible.length.toLocaleString()} shown{indexed < assets.length ? ` · indexing ${indexed}/${assets.length}` : ''}{errors ? ` · ${errors} cannot preview` : ''}</span></div>
      <div className="gallery-import"><button onClick={() => fileInput.current?.click()} disabled={isProcessing || bundleBusy}><Images size={16} /> Add images</button><button onClick={() => folderInput.current?.click()} disabled={isProcessing || bundleBusy}><FolderOpen size={16} /> Open folder</button></div>
    </header>
    <div className="gallery-toolbar" inert={isProcessing || bundleBusy || undefined}>
      <div className="gallery-segment" role="group" aria-label="Selection purpose"><button aria-pressed={intent === 'collage'} onClick={() => { setIntent('collage'); anchor.current = null; }}>Collage · up to {collageMaxPhotos}</button><button aria-pressed={intent === 'bundle'} onClick={() => { setIntent('bundle'); anchor.current = null; }}>Post bundle · up to 20</button></div>
      {intent === 'bundle' && <button className="gallery-action" onClick={() => {
        if (bundleDraft && !bundleSaved && !window.confirm('Start a new bundle? Unsaved changes in the current bundle will be discarded.')) return;
        setBundleDraft(null); setBundleSelected([]); setBundleSaved(false); anchor.current = null;
        setNotice('New bundle. Choose up to 20 images, then Prepare bundle. Existing saved bundles are unchanged.');
      }}>New bundle</button>}
      <button className="gallery-action" aria-expanded={showBundles} onClick={() => { setShowBundles((old) => !old); void refreshBundles(); }}>Saved bundles ({savedBundles.length})</button>
      <button className="gallery-action" onClick={() => restoreInput.current?.click()}>Restore bundle ZIP</button>
      {bundleDraft && !bundleOpen && <button className="gallery-action" onClick={() => setBundleOpen(true)}>Resume {bundleDraft.name}</button>}
    </div>
    {showBundles && <section className="gallery-saved-bundles" aria-label="Saved bundles"><strong>Saved on this browser</strong><p>Editable drafts include photos. Export a ZIP backup before clearing browser data.</p>{!savedBundles.length && <p>No saved bundles yet.</p>}{savedBundles.map((bundle) => <button key={bundle.id} disabled={bundleBusy} onClick={() => { setBundleBusy(true); void loadBundle(bundle.id).then((draft) => openStoredBundle(draft, true)).catch((error) => setNotice(error instanceof Error ? error.message : 'Could not open bundle.')).finally(() => setBundleBusy(false)); }}>{bundle.name} · {bundle.count} images · {new Date(bundle.updatedAt).toLocaleDateString()}</button>)}</section>}
    <div className="gallery-toolbar" inert={isProcessing || bundleBusy || undefined}>
      <label className="gallery-search"><Search size={16} /><input aria-label="Search images" placeholder="Search filenames or folders" value={query} onChange={(event) => { setSuggestion(null); setQuery(event.target.value); viewport.current?.scrollTo(0, 0); }} /></label>
      <select aria-label="Folder" value={folder} onChange={(event) => { setSuggestion(null); setFolder(event.target.value); viewport.current?.scrollTo(0, 0); }}><option value="">All folders</option>{folders.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Orientation" value={orientation} onChange={(event) => { setSuggestion(null); setOrientation(event.target.value); viewport.current?.scrollTo(0, 0); }}><option value="all">All orientations</option><option value="landscape">Landscape images</option><option value="square">Square images</option><option value="portrait">Portrait images</option></select>
      <select aria-label="Sort images" value={settings.sort} onChange={(event) => update({ sort: event.target.value as GallerySettings['sort'] })}><option value="name">Filename</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="manual">Manual order</option></select>
    </div>
    <div className="gallery-toolbar" inert={isProcessing || bundleBusy || undefined}>
      <select aria-label="Colour sampling region" value={colourRegion} onChange={(event) => { setSuggestion(null); setColourRegion(event.target.value as typeof colourRegion); }}><option value="edgeColour">Edge colours · background hint</option><option value="centreColour">Centre colours · outfit hint</option></select>
      <button className="gallery-action" disabled={!!suggestion || visible.length < 2 || visible.some((asset) => !pool.metadata.has(asset.id)) || indexedColours(visible, pool) < 2} onClick={() => { setSuggestion({ ids: suggestColourOrder(visible.map((a) => a.id), pool.metadata, colourRegion), region: colourRegion }); viewport.current?.scrollTo(0, 0); }}>Suggest colour order</button>
      <small>Local colour hints; no subject recognition or file changes.</small>
      <span className="gallery-help">Drag a grip to reorder · focus a grip and use arrow keys</span>
    </div>
    {suggestion && <div className="gallery-suggestion" role="status"><strong>Previewing {suggestion.ids.length} images by {suggestion.region === 'edgeColour' ? 'edge' : 'centre'} colour</strong><span>Review the grid, then apply or discard. Selection is unchanged.</span><button onClick={() => { const byId = new Map(assets.map((a) => [a.id, a])); setAssets(replaceVisibleOrder(assets.map((a) => a.id), suggestion.ids).map((id) => byId.get(id)!)); update({ sort: 'manual' }); setSuggestion(null); setNotice('Suggested order applied. Original files are unchanged.'); }}>Apply order</button><button onClick={() => setSuggestion(null)}>Discard</button></div>}
    <div className="gallery-toolbar gallery-view-controls" inert={isProcessing || bundleBusy || undefined}>
      <div className="gallery-segment" role="group" aria-label="Tile shape">{(['original', 'landscape', 'square', 'portrait'] as const).map((shape) => <button key={shape} aria-pressed={settings.shape === shape} onClick={() => update({ shape })}>{shape === 'original' ? 'Original' : shape[0].toUpperCase() + shape.slice(1)}</button>)}</div>
      <label>Size <input aria-label="Thumbnail size" type="range" min={80} max={320} step={10} value={settings.size} onChange={(event) => update({ size: +event.target.value })} /><output>{settings.size}</output></label>
      <label>Gap <input aria-label="Image spacing" type="range" min={0} max={12} value={settings.gap} onChange={(event) => update({ gap: +event.target.value })} /><output>{settings.gap}px</output></label>
      <select aria-label="Image fit" value={settings.fit} onChange={(event) => update({ fit: event.target.value as GallerySettings['fit'] })}><option value="cover">Fill tiles</option><option value="contain">Fit entire image</option></select>
      <label><input type="checkbox" checked={settings.labels} onChange={(event) => update({ labels: event.target.checked })} /> Filenames</label>
    </div>
    {(notice || importNotice) && <div className="gallery-notice" role="status">{importNotice || notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="gallery-viewport" ref={viewport} aria-label="Image gallery" onDragOver={(event) => {
      if (!dragging.current || !viewport.current) return;
      event.preventDefault();
      const bounds = viewport.current.getBoundingClientRect();
      if (event.clientY < bounds.top + 60) viewport.current.scrollTop -= 40;
      else if (event.clientY > bounds.bottom - 60) viewport.current.scrollTop += 40;
    }} inert={isProcessing || bundleBusy || undefined}>
      {!assets.length ? <div className="gallery-empty"><Images size={40} /><h2>Your photos, room to browse.</h2><p>Open a folder or add images. Browse freely, then choose {intent === 'bundle' ? '1–20 for a post bundle' : `2–${maxPhotos} for a collage`}.</p><button onClick={() => folderInput.current?.click()}>Open a photo folder</button><small>Library photos stay in this tab. Saved bundles retain their selected photos locally; reopen other files after reload.</small></div> : !visible.length ? <div className="gallery-empty"><h2>No matching images</h2><p>{indexed < assets.length ? 'Orientation results update while indexing continues.' : 'Try another search or filter.'}</p><button onClick={() => { setSuggestion(null); setQuery(''); setFolder(''); setOrientation('all'); }}>Clear filters</button></div> :
        <div style={{ height: rows.getTotalSize(), position: 'relative', width: '100%' }}>
          {rows.getVirtualItems().map((row) => <div key={row.key} data-index={row.index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)`, height: row.size, display: 'grid', gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gap: settings.gap }}>
            {displayAssets.slice(row.index * geometry.columns, (row.index + 1) * geometry.columns).map((asset, column) => {
              const picked = selected.indexOf(asset.id);
              return <div key={asset.id} className={`gallery-tile ${picked >= 0 ? 'is-selected' : ''}`} data-asset-id={asset.id} onDragOver={(event) => { if (dragging.current?.area === 'library') event.preventDefault(); }} onDrop={(event) => dropOn(event, asset.id, 'library')}>
                <button className="gallery-image" style={{ height: geometry.cellHeight }} onClick={(event) => select(asset.id, event.shiftKey)} aria-label={`${picked >= 0 ? 'Deselect' : 'Select'} ${asset.path}`} aria-pressed={picked >= 0} title={`Click to select · ${asset.path}`}><Thumbnail asset={asset} pool={pool} fit={settings.shape === 'original' ? 'contain' : settings.fit} /><span className="gallery-selection-badge" aria-hidden="true">{picked >= 0 ? picked + 1 : <Check size={14} />}</span></button>
                <button className="gallery-preview" aria-label={`View ${asset.path}`} title="Open large preview" onClick={() => { const index = row.index * geometry.columns + column; viewed.current = index; setViewer({ assets: displayAssets, index }); }}><Expand size={16} /></button>
                <button className="gallery-grip" onClick={(event) => select(asset.id, event.shiftKey)} disabled={!!suggestion} draggable={!suggestion} onDragStart={(event) => dragStart(event, asset.id, 'library')} onDragEnd={() => { dragging.current = null; }} onKeyDown={(event) => keyboardMove(event, asset.id, 'library')} aria-label={`Reorder ${asset.path}`} title="Drag to reorder; arrow keys when focused"><GripVertical size={16} /></button>
                {settings.labels && <div className="gallery-filename" title={asset.path}>{asset.file.name}</div>}
              </div>;
            })}
          </div>)}
        </div>}
    </div>
    <footer className="gallery-footer" inert={isProcessing || bundleBusy || undefined}>
      <div className="gallery-tray-heading"><strong>{intent === 'bundle' ? 'Bundle selection' : 'Collage selection'} <span>{selected.length}/{maxPhotos}</span></strong><small>Shift-click to select a range</small></div>
      <div className="gallery-tray" aria-label={intent === 'bundle' ? 'Bundle selection' : 'Collage selection'}>{selectedAssets.map((asset, position) => <div className="gallery-tray-item" key={asset.id} onDragOver={(event) => { if (dragging.current?.area === 'tray') event.preventDefault(); }} onDrop={(event) => dropOn(event, asset.id, 'tray')}><Thumbnail asset={asset} pool={pool} /><span>{position + 1}</span><button className="gallery-tray-grip" draggable onDragStart={(event) => dragStart(event, asset.id, 'tray')} onDragEnd={() => { dragging.current = null; }} onKeyDown={(event) => keyboardMove(event, asset.id, 'tray')} aria-label={`Reorder selected ${asset.path}`} title="Drag or use arrow keys"><GripVertical size={14} /></button><button aria-label={`Remove ${asset.path} from ${selectionLabel}`} onClick={() => setSelected((old) => old.filter((id) => id !== asset.id))}><X size={12} /></button></div>)}{!selected.length && <span className="gallery-tray-empty">Click any thumbnail to select it. Use its corner button to preview.</span>}</div>
      <button className="gallery-create" disabled={selected.length < (intent === 'bundle' ? 1 : 2) || isProcessing || bundleBusy} onClick={() => { if (intent === 'bundle') prepareBundle(); else void onCreateCollage(selectedAssets.map((asset) => asset.file)); }}>{isProcessing ? `Preparing ${processingProgress.current}/${processingProgress.total}` : intent === 'bundle' ? 'Prepare bundle' : 'Create collage'}<ArrowRight size={16} /></button>
    </footer>
    {viewer !== null && <GalleryViewer selectionLabel={selectionLabel} assets={viewer.assets} initialIndex={viewer.index} selected={selected} maxPhotos={maxPhotos} pool={pool} onToggle={(id) => select(id)} onClose={closeViewer} onView={(index) => { viewed.current = index; }} />}
  </main></div>{bundleOpen && bundleDraft && <BundleEditor key={bundleDraft.id} draft={bundleDraft} initiallySaved={bundleSaved} onChange={(draft) => { setBundleDraft(draft); setBundleSaved(false); }} onSaved={() => { setBundleSaved(true); void refreshBundles(); }} onBack={() => {
    setBundleOpen(false); setIntent('bundle'); setBundleSelected(bundleDraft.items.map((item) => item.id));
  }} />}</>;
}
