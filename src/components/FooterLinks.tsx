import { Link } from 'react-router-dom';

/**
 * Footer with legal links - required for GDPR, CCPA, and general compliance.
 * Appears at the bottom of screens where appropriate.
 */
export function FooterLinks() {
  return (
    <div className="flex flex-wrap justify-center gap-3 pt-4 mt-4 border-t border-border/20 text-xs">
      <Link to="/privacy" className="text-muted hover:text-text transition">
        Privacy Policy
      </Link>
      <span className="text-border/30">·</span>
      <Link to="/terms" className="text-muted hover:text-text transition">
        Terms of Service
      </Link>
      <span className="text-border/30">·</span>
      <Link to="/dmca" className="text-muted hover:text-text transition">
        Copyright / DMCA
      </Link>
    </div>
  );
}
