import { Link } from 'react-router-dom';
import { useApp } from '../app/AppState';
import { Card, Pill, ScreenHeader } from '../components/ui';

export type MoreTarget = 'table' | 'settings' | 'admin';

/**
 * The overflow menu. The bottom bar holds the four things a diver does repeatedly; the
 * dive table, settings and the admin tools are destinations you go to deliberately, so
 * they live one tap deeper rather than crowding a phone-width tab bar.
 */
export function MoreScreen({ onOpen }: { onOpen: (target: MoreTarget) => void }) {
  const { admin, rules, gender } = useApp();

  const items: { id: MoreTarget; title: string; description: string; adminOnly?: boolean }[] = [
    {
      id: 'table',
      title: 'Dive table',
      description: `Every dive and its DD under ${rules.shortName}, ${
        gender === 'men' ? "men's" : "women's"
      } height.`,
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Rule set, default competition, account.',
    },
    {
      id: 'admin',
      title: 'Admin',
      description: 'Add competitions and upload results.',
      adminOnly: true,
    },
  ];

  const legalItems = [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/dmca', label: 'Copyright / DMCA' },
  ];

  return (
    <div className="p-4 pb-24">
      <ScreenHeader title="More" />

      <ul className="space-y-2 mb-6">
        {items
          .filter((item) => !item.adminOnly || admin)
          .map((item) => (
            <li key={item.id}>
              <Card>
                <button onClick={() => onOpen(item.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.title}</span>
                    {item.adminOnly ? <Pill tone="accent">admin</Pill> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                </button>
              </Card>
            </li>
          ))}
      </ul>

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Legal</h2>
      <ul className="space-y-2">
        {legalItems.map((item) => (
          <li key={item.href}>
            <Link to={item.href}>
              <Card>
                <span className="font-semibold">{item.label}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
