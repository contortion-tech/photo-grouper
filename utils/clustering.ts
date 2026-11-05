import type { LocalPhoto } from "../types/photo";
import { TEMPLATES as COLLAGE_TEMPLATES, type CollageTemplate } from "./templates";

export type Orientation = "portrait" | "landscape" | "square";

export interface AspectBreakdown {
  readonly portrait: number;
  readonly landscape: number;
  readonly square: number;
  readonly dominant: Orientation;
  readonly portraitRatio: number;
  readonly landscapeRatio: number;
}

export interface PhotoBurst {
  readonly id: string;
  readonly representative: LocalPhoto;
  readonly candidates: readonly LocalPhoto[];
  readonly startTimeMs: number | null;
  readonly endTimeMs: number | null;
  readonly durationMs: number;
  readonly isBurst: boolean;
}

export interface TemplateRecommendation {
  readonly templateId: string;
  readonly template: CollageTemplate | null;
  readonly score: number;
  readonly slotCountDelta: number;
  readonly orientationMismatch: number;
}

export interface PhotoCluster {
  readonly id: string;
  readonly startTimeMs: number | null;
  readonly endTimeMs: number | null;
  readonly hasTimestamp: boolean;
  readonly photos: readonly LocalPhoto[];
  readonly effectivePhotos: readonly LocalPhoto[];
  readonly bursts: readonly PhotoBurst[];
  readonly aspectBreakdown: AspectBreakdown;
  readonly recommendedTemplate: TemplateRecommendation;
  readonly expandedTemplate: TemplateRecommendation;
}

export interface ClusterConfig {
  readonly burstThresholdMs?: number;
  readonly sceneGapMs?: number;
  readonly squareDeadband?: number;
  readonly maxUnitsPerCluster?: number;
  readonly lockBurstOrientation?: boolean;
  readonly templates?: readonly CollageTemplate[];
}

interface NormalizedPhoto {
  readonly raw: LocalPhoto;
  readonly timestampMs: number | null;
  readonly aspectRatio: number;
  readonly orientation: Orientation;
  readonly resolution: number;
}

interface ResolvedConfig {
  readonly burstThresholdMs: number;
  readonly sceneGapMs: number;
  readonly squareDeadband: number;
  readonly maxUnitsPerCluster: number;
  readonly lockBurstOrientation: boolean;
  readonly templates: readonly CollageTemplate[];
}

const DEFAULT_BURST_THRESHOLD_MS = 3_000;
const DEFAULT_SCENE_GAP_MS = 15 * 60 * 1_000;
const MIN_SCENE_GAP_MS = 5 * 60 * 1_000;
const MAX_SCENE_GAP_MS = 30 * 60 * 1_000;
const DEFAULT_SQUARE_DEADBAND = 0.05;
const FALLBACK_MAX_UNITS = 9;

const filenameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function clusterPhotos(
  photos: readonly LocalPhoto[],
  config?: ClusterConfig
): PhotoCluster[] {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const resolvedConfig = resolveConfig(config);
  const normalized = photos.map((photo) =>
    normalizePhoto(photo, resolvedConfig.squareDeadband)
  );

  const timed: NormalizedPhoto[] = [];
  const untimed: NormalizedPhoto[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const item = normalized[i];
    if (item.timestampMs !== null) {
      timed.push(item);
    } else {
      untimed.push(item);
    }
  }

  timed.sort(compareTimedPhotos);
  untimed.sort(compareUntimedPhotos);

  const clusters: PhotoCluster[] = [];
  let clusterIndex = 0;

  if (timed.length > 0) {
    const timedBursts = groupIntoBursts(timed, resolvedConfig, true);
    const timedScenes = segmentBurstUnits(
      timedBursts,
      resolvedConfig.sceneGapMs,
      resolvedConfig.maxUnitsPerCluster
    );

    for (let i = 0; i < timedScenes.length; i++) {
      clusters.push(
        buildCluster(timedScenes[i], clusterIndex++, true, resolvedConfig)
      );
    }
  }

  if (untimed.length > 0) {
    const untimedUnits = untimed.map((item, idx) =>
      createSinglePhotoBurst(item, `untimed-unit-${idx}`)
    );
    const untimedBatches = chunkUntimedUnits(
      untimedUnits,
      resolvedConfig.maxUnitsPerCluster
    );

    for (let i = 0; i < untimedBatches.length; i++) {
      clusters.push(
        buildCluster(untimedBatches[i], clusterIndex++, false, resolvedConfig)
      );
    }
  }

  return clusters;
}

function resolveConfig(config?: ClusterConfig): ResolvedConfig {
  const templates =
    config?.templates && config.templates.length > 0
      ? config.templates
      : COLLAGE_TEMPLATES ?? [];

  const maxTemplateSlots = templates.reduce((max, tpl) => {
    const count = Array.isArray(tpl.slots) ? tpl.slots.length : 0;
    return count > max ? count : max;
  }, 0);

  const rawSceneGap = config?.sceneGapMs ?? DEFAULT_SCENE_GAP_MS;
  const clampedSceneGap = Math.max(
    MIN_SCENE_GAP_MS,
    Math.min(MAX_SCENE_GAP_MS, rawSceneGap)
  );

  const burstThresholdMs = Math.max(
    0,
    config?.burstThresholdMs ?? DEFAULT_BURST_THRESHOLD_MS
  );

  const squareDeadband = Math.max(
    0,
    Math.min(0.25, config?.squareDeadband ?? DEFAULT_SQUARE_DEADBAND)
  );

  const derivedMaxUnits =
    maxTemplateSlots > 0 ? maxTemplateSlots : FALLBACK_MAX_UNITS;

  const maxUnitsPerCluster = Math.max(
    1,
    config?.maxUnitsPerCluster ?? derivedMaxUnits
  );

  return {
    burstThresholdMs,
    sceneGapMs: clampedSceneGap,
    squareDeadband,
    maxUnitsPerCluster,
    lockBurstOrientation: config?.lockBurstOrientation ?? true,
    templates,
  };
}

function normalizePhoto(
  photo: LocalPhoto,
  squareDeadband: number
): NormalizedPhoto {
  const record = photo as unknown as Record<string, unknown>;
  const rawTimestamp =
    record.timestamp ??
    record.exifTimestamp ??
    record.takenAt ??
    record.dateTaken ??
    null;

  const timestampMs = parseTimestampMs(rawTimestamp);
  const safeWidth =
    typeof photo.width === "number" &&
    Number.isFinite(photo.width) &&
    photo.width > 0
      ? photo.width
      : 1;
  const safeHeight =
    typeof photo.height === "number" &&
    Number.isFinite(photo.height) &&
    photo.height > 0
      ? photo.height
      : 1;

  const aspectRatio = safeWidth / safeHeight;
  const orientation = classifyOrientation(aspectRatio, squareDeadband);

  return {
    raw: photo,
    timestampMs,
    aspectRatio,
    orientation,
    resolution: safeWidth * safeHeight,
  };
}

function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e11 ? Math.round(numeric * 1000) : Math.round(numeric);
    }
    const exifNormalized = trimmed.replace(
      /^(\d{4}):(\d{2}):(\d{2})\s+/,
      "$1-$2-$3T"
    );
    const parsed = Date.parse(exifNormalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function classifyOrientation(
  aspectRatio: number,
  squareDeadband: number = DEFAULT_SQUARE_DEADBAND
): Orientation {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "square";
  }
  if (Math.abs(aspectRatio - 1) <= squareDeadband) {
    return "square";
  }
  return aspectRatio < 1 ? "portrait" : "landscape";
}

function compareTimedPhotos(a: NormalizedPhoto, b: NormalizedPhoto): number {
  const timeDiff = (a.timestampMs ?? 0) - (b.timestampMs ?? 0);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return compareUntimedPhotos(a, b);
}

function compareUntimedPhotos(a: NormalizedPhoto, b: NormalizedPhoto): number {
  const nameA = a.raw.filename ?? "";
  const nameB = b.raw.filename ?? "";
  const byName = filenameCollator.compare(nameA, nameB);
  if (byName !== 0) {
    return byName;
  }
  const idA = a.raw.id ?? "";
  const idB = b.raw.id ?? "";
  return filenameCollator.compare(idA, idB);
}

interface InternalBurstUnit {
  readonly items: NormalizedPhoto[];
  readonly startTimeMs: number | null;
  readonly endTimeMs: number | null;
}

function groupIntoBursts(
  sortedTimed: readonly NormalizedPhoto[],
  config: ResolvedConfig,
  hasTimestamp: boolean
): InternalBurstUnit[] {
  if (sortedTimed.length === 0) {
    return [];
  }

  const units: InternalBurstUnit[] = [];
  let currentItems: NormalizedPhoto[] = [sortedTimed[0]];

  for (let i = 1; i < sortedTimed.length; i++) {
    const prev = sortedTimed[i - 1];
    const curr = sortedTimed[i];

    const deltaMs =
      hasTimestamp && prev.timestampMs !== null && curr.timestampMs !== null
        ? curr.timestampMs - prev.timestampMs
        : Number.POSITIVE_INFINITY;

    const orientationMatches =
      !config.lockBurstOrientation || prev.orientation === curr.orientation;

    if (deltaMs < config.burstThresholdMs && orientationMatches) {
      currentItems.push(curr);
    } else {
      units.push(finalizeInternalUnit(currentItems));
      currentItems = [curr];
    }
  }

  units.push(finalizeInternalUnit(currentItems));
  return units;
}

function finalizeInternalUnit(items: NormalizedPhoto[]): InternalBurstUnit {
  const first = items[0];
  const last = items[items.length - 1];
  return {
    items,
    startTimeMs: first.timestampMs,
    endTimeMs: last.timestampMs,
  };
}

function createSinglePhotoBurst(
  item: NormalizedPhoto,
  id: string
): PhotoBurst {
  return {
    id,
    representative: item.raw,
    candidates: [item.raw],
    startTimeMs: item.timestampMs,
    endTimeMs: item.timestampMs,
    durationMs: 0,
    isBurst: false,
  };
}

function toPhotoBurst(unit: InternalBurstUnit, id: string): PhotoBurst {
  const candidates = unit.items.map((item) => item.raw);
  const representative = selectBurstRepresentative(unit.items).raw;
  const startTimeMs = unit.startTimeMs;
  const endTimeMs = unit.endTimeMs;
  const durationMs =
    startTimeMs !== null && endTimeMs !== null
      ? Math.max(0, endTimeMs - startTimeMs)
      : 0;

  return {
    id,
    representative,
    candidates,
    startTimeMs,
    endTimeMs,
    durationMs,
    isBurst: candidates.length > 1,
  };
}

function selectBurstRepresentative(
  items: readonly NormalizedPhoto[]
): NormalizedPhoto {
  if (items.length === 1) {
    return items[0];
  }

  const centerIndex = (items.length - 1) / 2;
  let best = items[0];
  let bestCenterDistance = Math.abs(0 - centerIndex);

  for (let i = 1; i < items.length; i++) {
    const candidate = items[i];
    const centerDistance = Math.abs(i - centerIndex);

    if (candidate.resolution > best.resolution) {
      best = candidate;
      bestCenterDistance = centerDistance;
    } else if (
      candidate.resolution === best.resolution &&
      centerDistance < bestCenterDistance
    ) {
      best = candidate;
      bestCenterDistance = centerDistance;
    }
  }

  return best;
}

function segmentBurstUnits(
  units: readonly InternalBurstUnit[],
  sceneGapMs: number,
  maxUnitsPerCluster: number
): PhotoBurst[][] {
  if (units.length === 0) {
    return [];
  }

  const rawScenes: InternalBurstUnit[][] = [];
  let currentScene: InternalBurstUnit[] = [units[0]];

  for (let i = 1; i < units.length; i++) {
    const prevUnit = units[i - 1];
    const currUnit = units[i];

    const gapMs =
      prevUnit.endTimeMs !== null && currUnit.startTimeMs !== null
        ? currUnit.startTimeMs - prevUnit.endTimeMs
        : 0;

    if (gapMs > sceneGapMs) {
      rawScenes.push(currentScene);
      currentScene = [currUnit];
    } else {
      currentScene.push(currUnit);
    }
  }
  rawScenes.push(currentScene);

  const boundedScenes: PhotoBurst[][] = [];
  let burstCounter = 0;

  for (let i = 0; i < rawScenes.length; i++) {
    const partitioned = partitionOversizedScene(
      rawScenes[i],
      maxUnitsPerCluster
    );
    for (let j = 0; j < partitioned.length; j++) {
      const group = partitioned[j].map((unit) =>
        toPhotoBurst(unit, `burst-${burstCounter++}`)
      );
      boundedScenes.push(group);
    }
  }

  return boundedScenes;
}

function partitionOversizedScene(
  sceneUnits: readonly InternalBurstUnit[],
  maxUnits: number
): InternalBurstUnit[][] {
  if (sceneUnits.length <= maxUnits) {
    return [sceneUnits.slice()];
  }

  const result: InternalBurstUnit[][] = [];
  let start = 0;

  while (start < sceneUnits.length) {
    const remaining = sceneUnits.length - start;
    if (remaining <= maxUnits) {
      result.push(sceneUnits.slice(start));
      break;
    }

    const minEnd = start + Math.max(1, Math.floor(maxUnits / 2));
    const maxEnd = Math.min(sceneUnits.length - 1, start + maxUnits);

    let bestSplitIndex = maxEnd;
    let largestInternalGap = -1;

    for (let idx = minEnd; idx <= maxEnd; idx++) {
      const prev = sceneUnits[idx - 1];
      const curr = sceneUnits[idx];
      const gap =
        prev.endTimeMs !== null && curr.startTimeMs !== null
          ? curr.startTimeMs - prev.endTimeMs
          : 0;

      if (gap > largestInternalGap) {
        largestInternalGap = gap;
        bestSplitIndex = idx;
      }
    }

    result.push(sceneUnits.slice(start, bestSplitIndex));
    start = bestSplitIndex;
  }

  return result;
}

function chunkUntimedUnits(
  units: readonly PhotoBurst[],
  maxUnits: number
): PhotoBurst[][] {
  const chunks: PhotoBurst[][] = [];
  for (let i = 0; i < units.length; i += maxUnits) {
    chunks.push(units.slice(i, i + maxUnits));
  }
  return chunks;
}

function buildCluster(
  bursts: readonly PhotoBurst[],
  index: number,
  hasTimestamp: boolean,
  config: ResolvedConfig
): PhotoCluster {
  const allPhotos: LocalPhoto[] = [];
  const effectivePhotos: LocalPhoto[] = [];

  for (let i = 0; i < bursts.length; i++) {
    const burst = bursts[i];
    effectivePhotos.push(burst.representative);
    for (let j = 0; j < burst.candidates.length; j++) {
      allPhotos.push(burst.candidates[j]);
    }
  }

  const firstBurst = bursts[0];
  const lastBurst = bursts[bursts.length - 1];

  const aspectBreakdown = computeAspectBreakdown(
    effectivePhotos,
    config.squareDeadband
  );

  const recommendedTemplate = selectBestTemplate(
    effectivePhotos,
    config.templates,
    config.squareDeadband
  );

  const expandedTemplate = selectBestTemplate(
    allPhotos,
    config.templates,
    config.squareDeadband
  );

  return {
    id: `cluster-${index}`,
    startTimeMs: hasTimestamp ? firstBurst.startTimeMs : null,
    endTimeMs: hasTimestamp ? lastBurst.endTimeMs : null,
    hasTimestamp,
    photos: allPhotos,
    effectivePhotos,
    bursts,
    aspectBreakdown,
    recommendedTemplate,
    expandedTemplate,
  };
}

export function computeAspectBreakdown(
  photos: readonly LocalPhoto[],
  squareDeadband: number = DEFAULT_SQUARE_DEADBAND
): AspectBreakdown {
  let portrait = 0;
  let landscape = 0;
  let square = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const w = photo.width > 0 ? photo.width : 1;
    const h = photo.height > 0 ? photo.height : 1;
    const orientation = classifyOrientation(w / h, squareDeadband);

    if (orientation === "portrait") {
      portrait++;
    } else if (orientation === "landscape") {
      landscape++;
    } else {
      square++;
    }
  }

  const total = photos.length || 1;
  let dominant: Orientation = "square";

  if (portrait >= landscape && portrait >= square && portrait > 0) {
    dominant = "portrait";
  } else if (landscape >= portrait && landscape >= square && landscape > 0) {
    dominant = "landscape";
  }

  return {
    portrait,
    landscape,
    square,
    dominant,
    portraitRatio: portrait / total,
    landscapeRatio: landscape / total,
  };
}

export function selectBestTemplate(
  photos: readonly LocalPhoto[],
  templates: readonly CollageTemplate[],
  squareDeadband: number = DEFAULT_SQUARE_DEADBAND
): TemplateRecommendation {
  if (!templates || templates.length === 0) {
    return {
      templateId: "default-single",
      template: null,
      score: 0,
      slotCountDelta: photos.length,
      orientationMismatch: photos.length,
    };
  }

  const targetCount = photos.length;
  const photoBreakdown = computeAspectBreakdown(photos, squareDeadband);
  const sortedPhotoRatios = photos
    .map((p) => {
      const w = p.width > 0 ? p.width : 1;
      const h = p.height > 0 ? p.height : 1;
      return w / h;
    })
    .sort((a, b) => a - b);

  let bestTemplate = templates[0];
  let bestCost = Number.POSITIVE_INFINITY;
  let bestSlotDelta = 0;
  let bestOrientationMismatch = 0;

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const slots = Array.isArray(template.slots) ? template.slots : [];
    const slotCount = slots.length;

    const underfillPenalty =
      slotCount < targetCount ? (targetCount - slotCount) * 4.5 : 0;
    const overfillPenalty =
      slotCount > targetCount ? (slotCount - targetCount) * 3.0 : 0;

    let slotPortrait = 0;
    let slotLandscape = 0;
    let slotSquare = 0;
    const slotRatios: number[] = [];

    for (let j = 0; j < slotCount; j++) {
      const slot = slots[j];
      const sw = slot.width > 0 ? slot.width : 1;
      const sh = slot.height > 0 ? slot.height : 1;
      const ratio = sw / sh;
      slotRatios.push(ratio);

      const orient = classifyOrientation(ratio, squareDeadband);
      if (orient === "portrait") {
        slotPortrait++;
      } else if (orient === "landscape") {
        slotLandscape++;
      } else {
        slotSquare++;
      }
    }

    slotRatios.sort((a, b) => a - b);

    const orientationMismatch =
      Math.abs(photoBreakdown.portrait - slotPortrait) +
      Math.abs(photoBreakdown.landscape - slotLandscape) +
      Math.abs(photoBreakdown.square - slotSquare);

    const pairCount = Math.min(sortedPhotoRatios.length, slotRatios.length);
    let aspectErrorSum = 0;

    for (let k = 0; k < pairCount; k++) {
      const pRatio = sortedPhotoRatios[k];
      const sRatio = slotRatios[k];
      aspectErrorSum += Math.abs(Math.log(pRatio / sRatio));
    }

    const meanAspectError = pairCount > 0 ? aspectErrorSum / pairCount : 1;

    const totalCost =
      underfillPenalty +
      overfillPenalty +
      orientationMismatch * 1.25 +
      meanAspectError * 0.5;

    if (totalCost < bestCost) {
      bestCost = totalCost;
      bestTemplate = template;
      bestSlotDelta = slotCount - targetCount;
      bestOrientationMismatch = orientationMismatch;
    }
  }

  const normalizedScore = Number((1 / (1 + bestCost)).toFixed(4));

  return {
    templateId: bestTemplate.id,
    template: bestTemplate,
    score: normalizedScore,
    slotCountDelta: bestSlotDelta,
    orientationMismatch: bestOrientationMismatch,
  };
}
