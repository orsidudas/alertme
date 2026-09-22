import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  database: boolean;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health request failed: ${response.status}`);
        }
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to reach API');
      });
  }, []);

  return (
    <main>
      <p className="eyebrow">Alertme foundation</p>
      <h1>News alerts, built one clear step at a time.</h1>
      <p className="description">The frontend is connected to the Fastify API and SQLite database.</p>
      <section className="status" aria-live="polite">
        <span className={`indicator ${health ? 'healthy' : error ? 'failed' : ''}`} />
        {health ? `API connected. Database: ${health.database ? 'ready' : 'unavailable'}.` : error ?? 'Connecting to API...'}
      </section>
    </main>
  );
}

export default App;
