'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import HomePage from '@/components/HomePage';
import PhotoSelection from '@/components/PhotoSelection';
import CollageEditor from '@/components/CollageEditor';
import InstallPrompt from '@/components/InstallPrompt';
import { TEMPLATES, CollageTemplate, getDefaultTemplate, getTemplatesForPhotoCount } from '@/utils/templates';
import { saveCollage, DEFAULT_EXPORT_OPTIONS, DEFAULT_COMPARISON_LABELS, type ExportOptions, type ComparisonLabels } from '@/utils/collageGenerator';
import { PhotoEdits, DEFAULT_EDITS, CollageStyle, DEFAULT_STYLE } from '@/utils/photoEdits';
import { DEFAULT_WORKFLOW, type WorkflowConfig } from '@/utils/workflows';
import { trackProductEvent } from '@/utils/analytics';

import { PhotoData } from '@/types/photo';

type AppPhase = 'home' | 'selection' | 'editor';

const MAX_PHOTOS = 9;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const initAssignments = (template: CollageTemplate, photoCount: number) => {
  const assignments = new Map<string, number>();
  template.slots.forEach((slot, index) => {
    if (index < photoCount) {
      assignments.set(slot.id, index);
    }
  });
  return assignments;
};

const initEdits = (template: CollageTemplate, fitMode: PhotoEdits['fitMode']) => {
  if (fitMode === DEFAULT_EDITS.fitMode) return new Map<string, PhotoEdits>();
  return new Map(template.slots.map((slot) => [slot.id, { ...DEFAULT_EDITS, fitMode }]));
};

interface PhotoGrouperAppProps {
  workflow?: WorkflowConfig;
}

export default function PhotoGrouperApp({ workflow = DEFAULT_WORKFLOW }: PhotoGrouperAppProps) {
  const maxPhotos = workflow.photoCount ?? MAX_PHOTOS;
  const [phase, setPhase] = useState<AppPhase>('home');

  // Photo state
  const [photos, setPhotos] = useState<PhotoData[]>([]);

  // Collage state
  const [selectedTemplate, setSelectedTemplate] = useState<CollageTemplate>(TEMPLATES[0]);
  const [photoAssignments, setPhotoAssignments] = useState<Map<string, number>>(new Map());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edits keyed by slot id (only persisted as long as a template is in use)
  const [slotEdits, setSlotEdits] = useState<Map<string, PhotoEdits>>(new Map());
  // Collage-wide style
  const [collageStyle, setCollageStyle] = useState<CollageStyle>(DEFAULT_STYLE);
  // Output aspect ratio override (null = follow the layout's own ratio)
  const [outputAspectRatio, setOutputAspectRatio] = useState<number | null>(workflow.outputAspectRatio);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [comparisonLabels, setComparisonLabels] = useState<ComparisonLabels>({
    ...DEFAULT_COMPARISON_LABELS,
    enabled: workflow.comparisonLabels,
  });
  const [showExportFeedback, setShowExportFeedback] = useState(false);

  // Processing state for image compression
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const photosRef = useRef<PhotoData[]>([]);
  const processingRef = useRef(false);
  const feedbackShownRef = useRef(false);
  const feedbackDialogRef = useRef<HTMLElement>(null);
  const firstFeedbackButtonRef = useRef<HTMLButtonElement>(null);
  const feedbackReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (!showExportFeedback) return;

    feedbackReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => firstFeedbackButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      feedbackReturnFocusRef.current?.focus();
      feedbackReturnFocusRef.current = null;
    };
  }, [showExportFeedback]);

  const editorTemplates = useMemo(
    () => getTemplatesForPhotoCount(photos.length),
    [photos.length]
  );

  // ===== PHOTO SELECTION HANDLERS =====

  const handleSelectPhotos = useCallback(() => {
    setPhase('selection');
  }, []);

  const processFiles = useCallback(async (incomingFiles: File[], preferredTemplateId?: string | null) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setImportNotice(null);
    const files = incomingFiles.slice(0, maxPhotos);
    setProcessingProgress({ current: 0, total: files.length });
    const prepared: PhotoData[] = [];
    let failed = 0;
    try {
      for (const [index, original] of files.entries()) {
        if (original.size > MAX_SOURCE_BYTES) { failed += 1; continue; }
        const url = URL.createObjectURL(original);
        const image = new window.Image();
        try {
          image.src = url;
          await image.decode();
          prepared.push({ file: original, previewUrl: url });
        } catch {
          URL.revokeObjectURL(url);
          failed += 1;
        } finally {
          image.src = '';
        }
        setProcessingProgress({ current: index + 1, total: files.length });
      }
      if (failed) {
        prepared.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        setImportNotice(`${failed} selected image${failed === 1 ? ' could' : 's could'} not be opened. Remove unsupported images from the selection and try again.`);
        return;
      }
      if (prepared.length < 2) return;
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      photosRef.current = prepared;
      setPhotos(prepared);
      const configured = workflow.templateId
        ? TEMPLATES.find((candidate) => candidate.id === workflow.templateId && candidate.slots.length === prepared.length)
        : null;
      // Cluster "Select cluster" hands over its recommended layout; it only
      // applies when no workflow template is configured and it fits exactly.
      const clusterPreferred = preferredTemplateId && !configured
        ? TEMPLATES.find((candidate) => candidate.id === preferredTemplateId && candidate.slots.length === prepared.length) ?? null
        : null;
      const template = configured ?? clusterPreferred ?? getDefaultTemplate(prepared.length);
      setSelectedTemplate(template);
      setPhotoAssignments(initAssignments(template, prepared.length));
      setSlotEdits(initEdits(template, workflow.defaultFitMode));
      setCollageStyle(DEFAULT_STYLE);
      setOutputAspectRatio(workflow.outputAspectRatio);
      setExportOptions(DEFAULT_EXPORT_OPTIONS);
      setComparisonLabels({ ...DEFAULT_COMPARISON_LABELS, enabled: workflow.comparisonLabels });
      setSelectedSlot(null);
      setPhase('editor');
      trackProductEvent('editor_opened', { photo_count: prepared.length, workflow: workflow.slug || 'home', fit: workflow.defaultFitMode });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }, [maxPhotos, workflow]);

  const handleTemplateSelect = useCallback((template: CollageTemplate) => {
    setSelectedTemplate(template);
    setPhotoAssignments(initAssignments(template, photos.length));
    setSelectedSlot(null);
    // Reset geometry when layout changes because slot IDs may not map cleanly.
    setSlotEdits(initEdits(template, workflow.defaultFitMode));
  }, [photos.length, workflow.defaultFitMode]);

  // Click-to-select. If the same slot is tapped again it toggles off.
  // Inline UI in the editor handles "swap" via an explicit action.
  const handleSlotClick = useCallback((slotId: string) => {
    setSelectedSlot((prev) => (prev === slotId ? null : slotId));
  }, []);

  const handleSwapSlots = useCallback((slotA: string, slotB: string) => {
    setPhotoAssignments((prev) => {
      const newMap = new Map(prev);
      const p1 = prev.get(slotA);
      const p2 = prev.get(slotB);
      if (p1 !== undefined) newMap.set(slotB, p1); else newMap.delete(slotB);
      if (p2 !== undefined) newMap.set(slotA, p2); else newMap.delete(slotA);
      return newMap;
    });
    // Also swap edits so the visual edit follows the photo.
    setSlotEdits((prev) => {
      const newMap = new Map(prev);
      const e1 = prev.get(slotA);
      const e2 = prev.get(slotB);
      if (e1) newMap.set(slotB, e1); else newMap.delete(slotB);
      if (e2) newMap.set(slotA, e2); else newMap.delete(slotA);
      return newMap;
    });
  }, []);

  const handleUpdateSlotEdits = useCallback((slotId: string, updates: Partial<PhotoEdits>) => {
    setSlotEdits((prev) => {
      const newMap = new Map(prev);
      const current = prev.get(slotId) ?? DEFAULT_EDITS;
      newMap.set(slotId, { ...current, ...updates });
      return newMap;
    });
  }, []);

  const handleResetSlotEdits = useCallback((slotId: string) => {
    setSlotEdits((prev) => {
      const newMap = new Map(prev);
      if (workflow.defaultFitMode === DEFAULT_EDITS.fitMode) {
        newMap.delete(slotId);
      } else {
        newMap.set(slotId, { ...DEFAULT_EDITS, fitMode: workflow.defaultFitMode });
      }
      return newMap;
    });
  }, [workflow.defaultFitMode]);

  // Apply the same edit (filter/preset) to every slot.
  const handleApplyEditToAll = useCallback((updates: Partial<PhotoEdits>) => {
    setSlotEdits((prev) => {
      const newMap = new Map(prev);
      selectedTemplate.slots.forEach((slot) => {
        const current = newMap.get(slot.id) ?? DEFAULT_EDITS;
        newMap.set(slot.id, { ...current, ...updates });
      });
      return newMap;
    });
  }, [selectedTemplate]);

  const handleUpdateStyle = useCallback((updates: Partial<CollageStyle>) => {
    setCollageStyle((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSetAspectRatio = useCallback((ratio: number | null) => {
    setOutputAspectRatio(ratio);
  }, []);

  const handleUpdateExportOptions = useCallback((updates: Partial<ExportOptions>) => {
    setExportOptions((previous) => ({ ...previous, ...updates }));
  }, []);

  const handleUpdateComparisonLabels = useCallback((updates: Partial<ComparisonLabels>) => {
    setComparisonLabels((previous) => ({ ...previous, ...updates }));
  }, []);

  const handleSave = useCallback(async () => {
    if (photos.length === 0) return;

    setIsSaving(true);
    try {
      const photosMap = new Map<string, PhotoData>();
      photoAssignments.forEach((photoIndex, slotId) => {
        if (photos[photoIndex]) {
          photosMap.set(slotId, photos[photoIndex]);
        }
      });

      const result = await saveCollage(
        selectedTemplate,
        photosMap,
        slotEdits,
        collageStyle,
        outputAspectRatio,
        exportOptions,
        comparisonLabels,
      );
      trackProductEvent('export_completed', {
        format: exportOptions.format,
        width: exportOptions.width,
        method: result,
        photo_count: photos.length,
        workflow: workflow.slug || 'home',
      });
      if (!feedbackShownRef.current) {
        feedbackShownRef.current = true;
        setShowExportFeedback(true);
      }
    } catch (error) {
      console.error('Failed to save collage:', error);
      trackProductEvent('export_failed', {
        format: exportOptions.format,
        width: exportOptions.width,
        workflow: workflow.slug || 'home',
      });
      alert('Failed to save collage. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [photos, photoAssignments, selectedTemplate, slotEdits, collageStyle, outputAspectRatio, exportOptions, comparisonLabels, workflow.slug]);

  const handleCancelEditor = useCallback(() => {
    setSelectedSlot(null);
    setPhase('selection');
  }, []);

  const handleBackToHome = useCallback(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    photosRef.current = [];
    setPhotos([]);
    setPhotoAssignments(new Map());
    setSlotEdits(new Map());
    setSelectedSlot(null);
    setShowExportFeedback(false);
    setPhase('home');
  }, [photos]);

  const handleCloseExportFeedback = useCallback(() => {
    setShowExportFeedback(false);
  }, []);

  const handleExportFeedback = useCallback((category: string) => {
    trackProductEvent('export_feedback', {
      category,
      workflow: workflow.slug || 'home',
    });
    handleCloseExportFeedback();
  }, [handleCloseExportFeedback, workflow.slug]);

  const handleFeedbackKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCloseExportFeedback();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [handleCloseExportFeedback]);

  // ===== RENDER =====

  return (
    <>
      <div
        inert={showExportFeedback ? true : undefined}
        aria-hidden={showExportFeedback ? true : undefined}
      >
      {phase === 'home' && (
        <HomePage onSelectPhotos={handleSelectPhotos} workflow={workflow} />
      )}

      {phase !== 'home' && (
        <div hidden={phase !== 'selection'}>
          <PhotoSelection
            maxPhotos={maxPhotos}
            onCreateCollage={processFiles}
            onBack={handleBackToHome}
            isProcessing={isProcessing}
            processingProgress={processingProgress}
            importNotice={importNotice}
          />
        </div>
      )}

      {phase === 'editor' && (
        <CollageEditor
          photos={photos}
          templates={editorTemplates}
          selectedTemplate={selectedTemplate}
          photoAssignments={photoAssignments}
          selectedSlot={selectedSlot}
          slotEdits={slotEdits}
          collageStyle={collageStyle}
          outputAspectRatio={outputAspectRatio}
          exportOptions={exportOptions}
          comparisonLabels={comparisonLabels}
          isSaving={isSaving}
          onTemplateSelect={handleTemplateSelect}
          onResizeLayout={setSelectedTemplate}
          onSlotClick={handleSlotClick}
          onSwapSlots={handleSwapSlots}
          onUpdateSlotEdits={handleUpdateSlotEdits}
          onResetSlotEdits={handleResetSlotEdits}
          onApplyEditToAll={handleApplyEditToAll}
          onUpdateStyle={handleUpdateStyle}
          onSetAspectRatio={handleSetAspectRatio}
          onUpdateExportOptions={handleUpdateExportOptions}
          onUpdateComparisonLabels={handleUpdateComparisonLabels}
          onSave={handleSave}
          onCancel={handleCancelEditor}
        />
      )}

      <InstallPrompt enabled={phase !== 'editor'} />
      </div>

      {showExportFeedback && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center" role="presentation">
          <section
            ref={feedbackDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-feedback-title"
            onKeyDown={handleFeedbackKeyDown}
            className="w-full max-w-md rounded-[1.75rem] bg-white p-6 text-slate-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Export complete</p>
                <h2 id="export-feedback-title" className="mt-1 text-2xl font-semibold tracking-tight">What did you create?</h2>
                <p className="mt-1 text-sm text-slate-500">One tap helps improve Photo Grouper. No image data is collected.</p>
              </div>
              <button
                onClick={handleCloseExportFeedback}
                aria-label="Close feedback"
                className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ['personal', 'Personal collage'],
                ['before_after', 'Before and after'],
                ['business', 'Business post'],
                ['product', 'Product listing'],
                ['school_work', 'School or work'],
                ['other', 'Something else'],
              ].map(([value, label], index) => (
                <button
                  ref={index === 0 ? firstFeedbackButtonRef : undefined}
                  key={value}
                  onClick={() => handleExportFeedback(value)}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
