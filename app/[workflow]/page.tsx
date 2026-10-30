import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PhotoGrouperApp from '@/components/PhotoGrouperApp';
import { getWorkflowConfig, WORKFLOW_CONFIGS } from '@/utils/workflows';

interface WorkflowPageProps {
  params: Promise<{ workflow: string }>;
}

export function generateStaticParams() {
  return WORKFLOW_CONFIGS.map(({ slug }) => ({ workflow: slug }));
}

export async function generateMetadata({ params }: WorkflowPageProps): Promise<Metadata> {
  const { workflow: slug } = await params;
  const workflow = WORKFLOW_CONFIGS.find((candidate) => candidate.slug === slug);
  if (!workflow) return {};

  return {
    title: workflow.name,
    description: workflow.description,
    alternates: { canonical: `/${workflow.slug}` },
    openGraph: {
      title: `${workflow.name} | Photo Grouper`,
      description: workflow.description,
      url: `/${workflow.slug}`,
    },
  };
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { workflow: slug } = await params;
  const workflow = getWorkflowConfig(slug);
  if (!workflow.slug) notFound();
  return <PhotoGrouperApp workflow={workflow} />;
}
