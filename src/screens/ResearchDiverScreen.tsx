import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { loadSeason, listSeasons, resultsAvailable } from '../data/resultsDataSource';
import type { Diver } from '../lib/ranking';
import { Card, EmptyState, Input, Pill, ScreenHeader } from '../components/ui';
import { DiverScreen } from './DiverScreen';

/**
 * Search and research any diver in the database. Shows all divers across all seasons,
 * then lets you drill into their full competition history.
 */
export function ResearchDiverScreen() {
  const { gender } = useApp();
  const [allDivers, setAllDivers] = useState<Diver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiver, setSelectedDiver] = useState<Diver | null>(null);

  useEffect(() => {
    if (!resultsAvailable()) {
      setLoading(false);
      return;
    }
    listSeasons()
      .then(async (seasons) => {
        if (!seasons.length) {
          setAllDivers([]);
          setLoading(false);
          return;
        }
        // Load the most recent season to get all divers (divers table has all divers)
        const data = await loadSeason(seasons[0]);
        setAllDivers(data.divers);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load divers.');
        setAllDivers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return allDivers;
    const term = searchTerm.toLowerCase();
    return allDivers.filter((d) => d.name.toLowerCase().includes(term));
  }, [allDivers, searchTerm]);

  const matchingGender = useMemo(() => {
    return filtered.filter((d) => d.gender === gender);
  }, [filtered, gender]);

  if (selectedDiver) {
    return (
      <DiverScreen
        diver={selectedDiver}
        onBack={() => setSelectedDiver(null)}
        onOpenCompetition={() => {}}
      />
    );
  }

  return (
    <div className="p-4 pb-24">
      <ScreenHeader
        title="Research Diver"
        subtitle="Search for any diver and view their career history"
      />

      {error ? (
        <Card className="mb-4 border-danger/30 bg-danger/10 text-danger">{error}</Card>
      ) : null}

      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search diver name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">Loading divers…</p>
      ) : matchingGender.length === 0 ? (
        <EmptyState title="No divers found">
          {searchTerm
            ? 'Try a different name or check the gender filter at the top'
            : 'Start typing a diver name'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {matchingGender.map((diver) => (
            <button
              key={diver.id}
              onClick={() => setSelectedDiver(diver)}
              className="w-full text-left"
            >
              <Card className="hover:bg-text/[0.08] transition cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{diver.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {diver.gender === 'men' ? "Men's" : "Women's"}
                      {diver.country ? ` · ${diver.country}` : ''}
                    </p>
                  </div>
                  <Pill tone="accent">→</Pill>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
