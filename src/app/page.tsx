import { ExplorerRoot } from '@/components/ExplorerRoot';
import { readPublicConfig } from '@/lib/env';

export default function HomePage() {
  const config = readPublicConfig();

  return (
    <ExplorerRoot
      clerkEnabled={config.clerkEnabled}
      googleMapsApiKey={config.googleMapsApiKey}
      mapId={config.mapId}
      initialCenter={config.initialCenter}
    />
  );
}
