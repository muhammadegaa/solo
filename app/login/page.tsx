export default async function Login({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const { wrong } = await searchParams;
  return (
    <main className="fl fl-start">
      <div className="fl-orb" aria-hidden="true" />
      <h1>Solo</h1>
      <form action="/api/login" method="post" className="fl-login">
        <label htmlFor="passcode">Passcode</label>
        <input id="passcode" name="passcode" type="password" autoComplete="current-password" required />
        {wrong && <p className="fl-error">That passcode is wrong. Try again.</p>}
        <button className="fl-big" type="submit">Continue</button>
      </form>
    </main>
  );
}
