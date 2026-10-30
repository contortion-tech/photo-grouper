import PhotoGrouperApp from '@/components/PhotoGrouperApp';
import { DEFAULT_WORKFLOW } from '@/utils/workflows';

export default function HomePage() {
  return <PhotoGrouperApp workflow={DEFAULT_WORKFLOW} />;
}
