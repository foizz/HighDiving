import { useState } from 'react';
import { useApp } from '../app/AppState';
import { RULE_SETS, RULE_SET_IDS } from '../rules';
import { Button, Card, Pill, ScreenHeader, Segmented } from '../components/ui';
import {
  analyticsConfigured,
  setAnalyticsConsent,
  useAnalyticsConsent,
} from '../lib/analytics';

export function SettingsScreen() {
  const {
    rules,
    ruleSet,
    setRuleSet,
    gender,
    setGender,
    account,
    signOut,
    pendingGuestLists,
    migrateGuestLists,
  } = useApp();
  const [migrated, setMigrated] = useState<number | null>(null);
  const analyticsConsent = useAnalyticsConsent();
  const gpcActive = navigator.globalPrivacyControl === true;

  const slots = rules.slots(gender);

  return (
    <div className="p-4 pb-24">
      <ScreenHeader title="Settings" />

      <Card className="mb-3">
        <h2 className="mb-2 font-bold">Rule set</h2>
        <Segmented
          ariaLabel="Rule set"
          value={ruleSet}
          onChange={setRuleSet}
          options={RULE_SET_IDS.map((id) => ({
            value: id,
            label: RULE_SETS[id].shortName,
          }))}
        />
        <p className="mt-3 text-xs text-muted">{rules.source}</p>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-2 font-bold">Default competition</h2>
        <Segmented
          ariaLabel="Default competition"
          value={gender}
          onChange={setGender}
          options={[
            { value: 'men', label: 'Men', sublabel: rules.heights.men.label },
            { value: 'women', label: 'Women', sublabel: rules.heights.women.label },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Used for new lists and for the dive table. Each list keeps its own setting, which
          you can change while editing it.
        </p>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-2 font-bold">What these rules require</h2>
        <p className="mb-2 text-xs text-muted">
          For the {gender === 'men' ? "men's" : "women's"} competition.
        </p>
        <ul className="space-y-1.5 text-sm">
          {slots.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span className="text-muted">{s.label}</span>
              <span className="tabular">
                {s.maxDD == null ? 'no DD limit' : `max DD ${s.maxDD.toFixed(1)}`}
              </span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1.5 text-xs text-muted">
          <li>
            {rules.takeoffRule === 'allDistinct'
              ? 'All four dives must use different take-offs.'
              : 'The required and intermediate must differ; the two optionals must differ.'}{' '}
            ({rules.citations.takeoff})
          </li>
          <li>
            {rules.overLimit === 'cap'
              ? 'A dive above its limit still counts, scored at the limit.'
              : 'A dive above its limit is a failed dive and scores zero.'}{' '}
            ({rules.citations.overLimit})
          </li>
          <li>No dive may be repeated. ({rules.citations.repeat})</li>
          <li>
            Panel of {rules.judgeCounts.join(' or ')}; drop the highest and lowest, add the rest,
            multiply by DD. ({rules.citations.scoring})
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">Account</h2>
        <p className="text-sm text-muted">
          {account?.isGuest ? 'Signed in as a guest — lists stay on this device.' : account?.name}
        </p>

        {!account?.isGuest && pendingGuestLists > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-sm">
              {pendingGuestLists} guest {pendingGuestLists === 1 ? 'list is' : 'lists are'} still
              on this device.
            </p>
            <Button
              variant="secondary"
              onClick={async () => setMigrated(await migrateGuestLists())}
            >
              Move them into this account
            </Button>
          </div>
        ) : null}

        {migrated != null ? (
          <p className="mt-2 text-sm text-ok">Moved {migrated} list{migrated === 1 ? '' : 's'}.</p>
        ) : null}

        <div className="mt-3">
          <Button variant="secondary" onClick={() => void signOut()}>
            {account?.isGuest ? 'Leave guest mode' : 'Sign out'}
          </Button>
        </div>
      </Card>

      {analyticsConfigured ? (
        <Card className="mt-3">
          <h2 className="mb-2 font-bold">Usage analytics</h2>
          <Segmented
            ariaLabel="Usage analytics"
            value={analyticsConsent === true ? 'on' : 'off'}
            onChange={(v) => setAnalyticsConsent(v === 'on')}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            {gpcActive
              ? 'Off because your browser sends a Global Privacy Control signal.'
              : 'When on, Google Analytics records which screens you use. Turning it off stops collection and clears its cookies.'}
          </p>
        </Card>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted">
        <Pill>DD figures come from the published rule books</Pill>
      </p>
    </div>
  );
}
