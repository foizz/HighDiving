import { useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { GROUP_NAMES, POSITIONS, POSITION_NAMES } from '../lib/dive';
import { allDives, tableSource, type HeightKey } from '../lib/ddTable';
import { Input, ScreenHeader, Segmented } from '../components/ui';

/** The full DD table for the active rule set, at the competition height. */
export function CatalogScreen() {
  const { rules, gender, setGender } = useApp();
  const [query, setQuery] = useState('');
  const height = rules.heights[gender].table as HeightKey;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDives(rules.id)
      .filter((d) => d.dd[height] && Object.keys(d.dd[height]!).length > 0)
      .filter(
        (d) =>
          !q || d.number.toLowerCase().includes(q) || d.description.toLowerCase().includes(q),
      );
  }, [rules.id, height, query]);

  const byGroup = useMemo(() => {
    const map = new Map<number, typeof rows>();
    for (const d of rows) {
      const list = map.get(d.group) ?? [];
      list.push(d);
      map.set(d.group, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  return (
    <div className="p-4 pb-24">
      <ScreenHeader
        title="Dive table"
        subtitle={`${rules.shortName} · ${rules.heights[gender].label} · ${rows.length} dives`}
      />

      <div className="mb-3">
        <Segmented
          ariaLabel="Competition"
          value={gender}
          onChange={setGender}
          options={[
            { value: 'men', label: 'Men', sublabel: rules.heights.men.label },
            { value: 'women', label: 'Women', sublabel: rules.heights.women.label },
          ]}
        />
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by number or name"
        aria-label="Search dives"
        inputMode="search"
        className="mb-4"
      />

      {byGroup.map(([group, dives]) => (
        <section key={group} className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent-2">
            {GROUP_NAMES[group] ?? `Group ${group}`}
          </h2>
          <div className="glass glass-sheen overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-text/[0.05] text-xs text-muted">
                  <th scope="col" className="px-2 py-2 text-left font-semibold">
                    Dive
                  </th>
                  {POSITIONS.map((p) => (
                    <th
                      key={p}
                      scope="col"
                      title={POSITION_NAMES[p]}
                      className="w-10 px-1 py-2 text-center font-semibold"
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dives.map((d) => {
                  const cells = d.dd[height] ?? {};
                  return (
                    <tr key={d.number} className="border-t border-border/40 align-top">
                      <th scope="row" className="px-2 py-2 text-left font-normal">
                        <span className="tabular font-bold">{d.number}</span>
                        <span className="block text-xs text-muted">{d.description}</span>
                      </th>
                      {POSITIONS.map((p) => (
                        <td key={p} className="tabular px-1 py-2 text-center">
                          {cells[p] != null ? (
                            cells[p]!.toFixed(1)
                          ) : (
                            <span className="text-muted/40" aria-label="not permitted">
                              ·
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs text-muted">
        A · indicates the position is not listed for that dive, which means it may not be
        performed. Positions: {POSITIONS.map((p) => `${p} ${POSITION_NAMES[p]}`).join(', ')}.
      </p>
      <p className="mt-2 text-xs text-muted">Source: {tableSource(rules.id)}</p>
    </div>
  );
}
