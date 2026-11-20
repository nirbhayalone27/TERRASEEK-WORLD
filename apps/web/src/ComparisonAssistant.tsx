import { useState } from "react";
import { api } from "./lib/api";
export default function ComparisonAssistant({ result }: { result: any }) {
  const [question, setQuestion] = useState(
    "What changed between these two dates?",
  );
  const [messages, setMessages] = useState<
    {
      question: string;
      answer: string;
      limitations: string;
      sources: string[];
    }[]
  >([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const reply = await api<any>("assistant", {
        question,
        location: result.place.name,
        dates: result.dates,
        sensors: result.sensors,
        scenes: [result.beforeScene, result.afterScene],
        sources: result.sources,
        stats: result.stats,
        threshold: result.threshold,
        resolution: result.resolution,
      });
      setMessages((old) => [...old, { question, ...reply }]);
      setQuestion("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="evidence-assistant">
      <h3>Ask about this comparison</h3>
      <p className="micro">
        Grounded evidence Q&A · bounded interpreter, no general AI model
        configured. Uses this comparison’s actual metadata and browser
        measurements.
      </p>
      <div aria-live="polite">
        {messages.map((m, i) => (
          <article key={i}>
            <strong>{m.question}</strong>
            <p>{m.answer}</p>
            <p className="micro">{m.limitations}</p>
            {m.sources.map((source, j) => (
              <a key={j} href={source} target="_blank" rel="noreferrer">
                {j ? "After" : "Before"} source ↗{" "}
              </a>
            ))}
          </article>
        ))}
      </div>
      <form onSubmit={ask}>
        <label htmlFor="evidence-question">
          Question about the selected evidence
        </label>
        <input
          id="evidence-question"
          className="field"
          required
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How much NDVI decreased?"
        />
        <button className="primary" disabled={busy}>
          {busy ? "Reading evidence…" : "Ask about evidence"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
