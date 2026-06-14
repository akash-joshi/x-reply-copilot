import { CaptureView } from './capture.tsx';
import { SettingsForm } from './settings.tsx';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>X-Reply Copilot</h1>
      <p style={{ margin: '0 0 16px', color: '#555' }}>
        Capture the tweet you're looking at to get a vision-model analysis and a suggested reply.
      </p>
      <CaptureView />
      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Settings</summary>
        <SettingsForm />
      </details>
    </main>
  );
}
