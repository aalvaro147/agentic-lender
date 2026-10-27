/* Temporary content for pages built in later sprints. */

export function PagePlaceholder({ title, note }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">{note}</p>
    </section>
  )
}
