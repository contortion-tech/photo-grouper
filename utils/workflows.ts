import type { FitMode } from './photoEdits';

export interface WorkflowConfig {
  slug: string;
  name: string;
  title: string;
  description: string;
  eyebrow: string;
  photoCount: number | null;
  templateId: string | null;
  defaultFitMode: FitMode;
  outputAspectRatio: number | null;
  comparisonLabels: boolean;
}

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  slug: '',
  name: 'Photo collage',
  eyebrow: 'Private collage maker',
  title: 'Make the group shot fit the moment.',
  description: 'Turn 2 to 9 photos into a clean, share-ready collage. No account, no cloud, no waiting.',
  photoCount: null,
  templateId: null,
  defaultFitMode: 'cover',
  outputAspectRatio: null,
  comparisonLabels: false,
};

export const WORKFLOW_CONFIGS: WorkflowConfig[] = [
  {
    slug: 'before-after-photo-maker',
    name: 'Before and after photo maker',
    eyebrow: 'Before and after maker',
    title: 'Show the change clearly.',
    description: 'Place two photos side by side with clear labels. Everything stays on your device.',
    photoCount: 2,
    templateId: '2-side-by-side',
    defaultFitMode: 'cover',
    outputAspectRatio: 1,
    comparisonLabels: true,
  },
  {
    slug: 'combine-two-photos',
    name: 'Combine two photos',
    eyebrow: 'Two photo combiner',
    title: 'Put two photos together.',
    description: 'Combine two photos into one clean image without an account or upload.',
    photoCount: 2,
    templateId: '2-side-by-side',
    defaultFitMode: 'cover',
    outputAspectRatio: null,
    comparisonLabels: false,
  },
  {
    slug: 'side-by-side-photo-maker',
    name: 'Side by side photo maker',
    eyebrow: 'Side by side',
    title: 'Compare photos at a glance.',
    description: 'Create a balanced side-by-side image for sharing, work, or personal projects.',
    photoCount: 2,
    templateId: '2-side-by-side',
    defaultFitMode: 'cover',
    outputAspectRatio: null,
    comparisonLabels: false,
  },
  {
    slug: 'merge-images-without-cropping',
    name: 'Merge images without cropping',
    eyebrow: 'No-crop image combiner',
    title: 'Keep every part of the photo.',
    description: 'Join two complete images with no forced crop. Processing happens locally.',
    photoCount: 2,
    templateId: '2-side-by-side',
    defaultFitMode: 'contain',
    outputAspectRatio: null,
    comparisonLabels: false,
  },
  {
    slug: 'instagram-story-collage',
    name: 'Instagram Story collage',
    eyebrow: '9:16 story collage',
    title: 'Build a full-screen story collage.',
    description: 'Arrange 2 to 9 photos in a 9:16 canvas ready for Stories, Reels, and TikTok.',
    photoCount: null,
    templateId: null,
    defaultFitMode: 'cover',
    outputAspectRatio: 9 / 16,
    comparisonLabels: false,
  },
];

const WORKFLOW_BY_SLUG = new Map(WORKFLOW_CONFIGS.map((workflow) => [workflow.slug, workflow]));

export function getWorkflowConfig(slug: string): WorkflowConfig {
  return WORKFLOW_BY_SLUG.get(slug) ?? DEFAULT_WORKFLOW;
}
