import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/settings';
import { DEFAULT_SETTINGS, type Settings } from '../../lib/types';
import { PROVIDERS, providerForBaseUrl, CUSTOM_PROVIDER_KEY } from '../../lib/providers';

const fieldStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, marginTop: 4 };
const labelStyle = { display: 'block', marginTop: 12, fontSize: 13, fontWeight: 600 };

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const updateLlm = (patch: Partial<Settings['llm']>) =>
    setSettings((current) => ({ ...current, llm: { ...current.llm, ...patch } }));

  const updateScoring = (patch: Partial<Settings['scoring']>) =>
    setSettings((current) => ({ ...current, scoring: { ...current.scoring, ...patch } }));

  const selectedProvider = providerForBaseUrl(settings.llm.baseUrl);
  const providerHint = PROVIDERS.find((provider) => provider.key === selectedProvider)?.hint;

  const onSelectProvider = (key: string) => {
    if (key === CUSTOM_PROVIDER_KEY) return;
    const provider = PROVIDERS.find((entry) => entry.key === key);
    if (provider) updateLlm({ baseUrl: provider.baseUrl, model: provider.model });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveSettings({ llm: settings.llm, scoring: settings.scoring });
    setStatus('saved');
    window.setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <label style={labelStyle}>
        Provider
        <select
          style={fieldStyle}
          value={selectedProvider}
          onChange={(event) => onSelectProvider(event.target.value)}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.key} value={provider.key}>
              {provider.label}
            </option>
          ))}
          <option value={CUSTOM_PROVIDER_KEY}>Custom</option>
        </select>
      </label>
      {providerHint && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#71767b' }}>{providerHint}</p>}

      <label style={labelStyle}>
        Base URL
        <input
          style={fieldStyle}
          value={settings.llm.baseUrl}
          onChange={(event) => updateLlm({ baseUrl: event.target.value })}
        />
      </label>

      <label style={labelStyle}>
        API key (leave empty for local Ollama)
        <input
          style={fieldStyle}
          type="password"
          value={settings.llm.apiKey}
          onChange={(event) => updateLlm({ apiKey: event.target.value })}
        />
      </label>

      <label style={labelStyle}>
        Model
        <input
          style={fieldStyle}
          value={settings.llm.model}
          onChange={(event) => updateLlm({ model: event.target.value })}
        />
      </label>

      <label style={labelStyle}>
        System prompt
        <textarea
          style={{ ...fieldStyle, minHeight: 96 }}
          value={settings.llm.systemPrompt}
          onChange={(event) => updateLlm({ systemPrompt: event.target.value })}
        />
      </label>

      <label style={labelStyle}>
        Green-pill threshold ({settings.scoring.greenThreshold.toFixed(2)})
        <input
          style={fieldStyle}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.scoring.greenThreshold}
          onChange={(event) => updateScoring({ greenThreshold: Number(event.target.value) })}
        />
      </label>

      <label style={{ ...labelStyle, fontWeight: 400 }}>
        <input
          type="checkbox"
          checked={settings.scoring.pillsEnabled}
          onChange={(event) => updateScoring({ pillsEnabled: event.target.checked })}
        />{' '}
        Show pills on the timeline
      </label>

      <button type="submit" style={{ marginTop: 16 }}>
        {status === 'saved' ? 'Saved' : 'Save settings'}
      </button>
    </form>
  );
}
