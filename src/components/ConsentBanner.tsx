import { Link } from 'react-router-dom';
import { setAnalyticsConsent, useAnalyticsConsent } from '../lib/analytics';
import { Button, Card } from './ui';

export function ConsentBanner() {
  const consent = useAnalyticsConsent();
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      className="pointer-events-none sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2"
    >
      <Card elevated className="pointer-events-auto">
        <p className="text-sm font-semibold">Allow usage analytics?</p>
        <p className="mt-1 text-xs leading-snug text-muted">
          With your permission we use Google Analytics to see which screens get used, so we
          know what to improve. It sets cookies and sends your IP address and device details to
          Google. Nothing is collected unless you allow it, and you can change this in
          Settings.{' '}
          <Link to="/privacy" className="underline hover:text-text">
            Privacy policy
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setAnalyticsConsent(false)}>
            Don't allow
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setAnalyticsConsent(true)}>
            Allow analytics
          </Button>
        </div>
      </Card>
    </div>
  );
}
