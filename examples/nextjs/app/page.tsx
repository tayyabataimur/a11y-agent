// Intentionally broken for a11y testing. Do not copy.

export default function Home() {
  return (
    <main>
      <h1>Broken Next.js Demo</h1>

      <img src="https://placehold.co/200" />
      <img src="https://placehold.co/200x100" />

      <button>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" />
        </svg>
      </button>

      <a href="/profile">
        <img src="https://placehold.co/40" />
      </a>

      <form>
        <input type="text" placeholder="Email" />
        <input type="password" placeholder="Password" />
        <button type="submit">Submit</button>
      </form>

      <p style={{ color: "#bbb", background: "#ddd" }}>Low-contrast paragraph.</p>
    </main>
  );
}
