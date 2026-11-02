export function AVenir({ titre, etape }: { titre: string; etape: number }) {
  return (
    <section className="carte vide">
      <h1>{titre}</h1>
      <p>Cette page arrive à l'étape {etape} du projet.</p>
    </section>
  )
}
