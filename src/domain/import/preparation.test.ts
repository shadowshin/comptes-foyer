import { describe, expect, it } from 'vitest'
import type { Compte, Transaction } from '../types'
import { construireImport, preparerImport, type EntreePreparation } from './preparation'
import { modeDepuisBanque, suggererMotif, trouverRegle, type Regle } from './regles'
import type { OperationBancaire, Releve } from './types'

const op = (o: Partial<OperationBancaire>): OperationBancaire => ({
  date: '2026-10-10',
  libelle: 'Paiement par carte · X1234 BOULANGERIE DEMO AU 09/10',
  detail: 'Paiement par carte | X1234 BOULANGERIE DEMO AU 09/10',
  typeBanque: 'Paiement par carte',
  montant: -4.2,
  categorieBanque: null,
  ...o,
})

const compte = (id: string, o: Partial<Compte> = {}): Compte => ({
  id,
  nom: id,
  banque: 'Banque',
  nature: 'courant',
  disponible: true,
  solde_initial: 0,
  date_solde_initial: '2026-10-01',
  plafond: null,
  date_echeance: null,
  cle_import: null,
  actif: true,
  ordre: 0,
  ...o,
})

const regle = (o: Partial<Regle>): Regle => ({
  id: 'r',
  motif: 'BOULANGERIE',
  type: 'depense_variable',
  categorie_id: 'courses',
  compte_cible_id: null,
  priorite: 0,
  ...o,
})

const releveCA = (operationsCourant: OperationBancaire[], operationsLivret: OperationBancaire[] = []): Releve => ({
  nomFichier: 'ca.csv',
  banque: 'CA',
  blocs: [
    { banque: 'CA', cleImport: 'CA|A|COURANT', titre: 'Courant', solde: null, operations: operationsCourant },
    { banque: 'CA', cleImport: 'CA|A|LIVRET', titre: 'Livret', solde: null, operations: operationsLivret },
  ],
})

const entree = (o: Partial<EntreePreparation>): EntreePreparation => ({
  releves: [],
  rattachements: { 'CA|A|COURANT': 'courant', 'CA|A|LIVRET': 'livret' },
  comptes: [compte('courant'), compte('livret', { nature: 'livret' })],
  existantes: [],
  regles: [],
  choixManuels: {},
  exclues: new Set(),
  ...o,
})

describe('règles de catégorisation', () => {
  it('trouve une règle sans tenir compte de la casse ni des accents', () => {
    expect(trouverRegle(op({ detail: 'Prélèvement | Électricité Démo' }), [regle({ motif: 'electricite demo' })])).not.toBeNull()
  })

  it('préfère la priorité, puis le motif le plus précis', () => {
    const large = regle({ id: 'large', motif: 'DEMO' })
    const precise = regle({ id: 'precise', motif: 'BOULANGERIE DEMO' })
    expect(trouverRegle(op({}), [large, precise])?.id).toBe('precise')
    expect(trouverRegle(op({}), [{ ...large, priorite: 5 }, precise])?.id).toBe('large')
  })

  it('suggère le nom du commerçant comme motif', () => {
    expect(suggererMotif(op({}))).toBe('BOULANGERIE DEMO')
    expect(
      suggererMotif(op({ libelle: 'Prélèvement · ASSUREUR DEMO VIE - Assureur - CONTRAT 12345678', typeBanque: 'Prélèvement' })),
    ).toBe('ASSUREUR DEMO VIE')
    expect(suggererMotif(op({ libelle: 'VIR SEPA MADAME DEMO', typeBanque: 'Virement recu' }))).toBe('MADAME DEMO')
  })

  it('déduit le mode de paiement de la nature bancaire', () => {
    expect(modeDepuisBanque('Paiement par carte')).toBe('carte')
    expect(modeDepuisBanque('Prélèvement')).toBe('prelevement')
    expect(modeDepuisBanque('Virement émis')).toBe('virement')
    expect(modeDepuisBanque('Chèque emis')).toBe('cheque')
    expect(modeDepuisBanque('Retrait au distributeur')).toBe('especes')
    expect(modeDepuisBanque('Cotisation')).toBeNull()
  })
})

describe('preparerImport', () => {
  it('classe par règle, sinon en revenu ou dépense à catégoriser', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({}), op({ libelle: 'Avoir · DEMO', detail: 'Avoir | DEMO', montant: 10 }), op({ libelle: 'Paiement · AUTRE', detail: 'AUTRE' })])],
        regles: [regle({})],
      }),
    )
    expect(lignes.map((l) => [l.origine, l.classement.type, l.classement.categorieId])).toEqual([
      ['regle', 'depense_variable', 'courses'],
      ['defaut', 'revenu', null],
      ['defaut', 'depense_variable', null],
    ])
  })

  it('le choix manuel l’emporte sur la règle', () => {
    const premiere = preparerImport(entree({ releves: [releveCA([op({})])], regles: [regle({})] })).lignes[0]
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({})])],
        regles: [regle({})],
        choixManuels: { [premiere.empreinte]: { type: 'depense_variable', categorieId: 'restaurants', compteCibleId: null } },
      }),
    )
    expect(lignes[0]).toMatchObject({ origine: 'manuel', classement: { categorieId: 'restaurants' } })
  })

  it('distingue deux opérations identiques le même jour', () => {
    const { lignes } = preparerImport(entree({ releves: [releveCA([op({}), op({})])] }))
    expect(new Set(lignes.map((l) => l.empreinte)).size).toBe(2)
    expect(lignes.every((l) => l.statut === 'nouvelle')).toBe(true)
  })

  it('écarte les opérations déjà importées, y compris présentes dans deux fichiers', () => {
    const premier = preparerImport(entree({ releves: [releveCA([op({})])] })).lignes[0]
    const deja = { empreinte_import: premier.empreinte } as Transaction
    expect(preparerImport(entree({ releves: [releveCA([op({})])], existantes: [deja] })).lignes[0].statut).toBe('doublon')
    const deuxFichiers = preparerImport(entree({ releves: [releveCA([op({})]), releveCA([op({})])] })).lignes
    expect(deuxFichiers.map((l) => l.statut)).toEqual(['nouvelle', 'doublon'])
  })

  it('écarte les opérations antérieures au solde initial et les blocs ignorés', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({ date: '2026-09-30' })], [op({})])],
        rattachements: { 'CA|A|COURANT': 'courant', 'CA|A|LIVRET': null },
      }),
    )
    expect(lignes.map((l) => l.statut)).toEqual(['avant_solde', 'bloc_ignore'])
  })

  it('apparie un virement entre deux comptes importés, à quelques jours d’écart', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [
          releveCA(
            [op({ date: '2026-10-06', libelle: 'Virement émis · VERS LIVRET', detail: 'Virement émis | VERS LIVRET', montant: -100 })],
            [op({ date: '2026-10-08', libelle: 'Virement en votre faveur', detail: 'Virement en votre faveur', montant: 100 })],
          ),
        ],
      }),
    )
    expect(lignes.map((l) => [l.classement.type, l.classement.compteCibleId, l.origine])).toEqual([
      ['virement_interne', 'livret', 'virement'],
      ['virement_interne', 'courant', 'virement'],
    ])
    const { insertions } = construireImport(lignes, () => 'transfert')
    expect(insertions.map((t) => t.transfert_id)).toEqual(['transfert', 'transfert'])
  })

  it('n’apparie pas des montants égaux qui ne ressemblent pas à des virements', () => {
    const { lignes } = preparerImport(entree({ releves: [releveCA([op({ montant: -100 })], [op({ montant: 100 })])] }))
    expect(lignes.every((l) => l.paire === null)).toBe(true)
  })

  it('n’apparie pas au-delà de 3 jours', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({ date: '2026-10-01', detail: 'VIREMENT', montant: -100 })], [op({ date: '2026-10-06', detail: 'VIREMENT', montant: 100 })])],
      }),
    )
    expect(lignes.every((l) => l.paire === null)).toBe(true)
  })

  it('apparie avec une opération déjà en base et la met à jour', () => {
    const existante = {
      id: 'deja',
      compte_id: 'livret',
      date_operation: '2026-10-06',
      libelle: 'VIR. VERS LIVRET A',
      description: null,
      type: 'revenu',
      montant: 100,
      transfert_id: null,
      empreinte_import: 'autre',
    } as Transaction
    const { lignes } = preparerImport(
      entree({ releves: [releveCA([op({ date: '2026-10-06', detail: 'Virement émis', montant: -100 })])], existantes: [existante] }),
    )
    expect(lignes[0].paire).toEqual({ transactionId: 'deja' })
    expect(construireImport(lignes, () => 't').misesAJour).toEqual([
      { id: 'deja', transfert_id: 't', type: 'virement_interne', categorie_id: null },
    ])
  })

  it('crée l’autre moitié d’un versement vers un placement jamais importé', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({ libelle: 'Prélèvement · ASSUREUR DEMO', detail: 'CONTRAT EPARGNE DEMO', typeBanque: 'Prélèvement', montant: -60 })])],
        comptes: [compte('courant'), compte('livret'), compte('placement', { nature: 'placement', disponible: false })],
        regles: [regle({ motif: 'CONTRAT EPARGNE', type: 'virement_interne', categorie_id: null, compte_cible_id: 'placement' })],
      }),
    )
    expect(lignes[0].contrepartieCreee).toBe(true)
    const { insertions } = construireImport(lignes, () => 't')
    expect(insertions.map((t) => [t.compte_id, t.montant, t.type, t.transfert_id])).toEqual([
      ['courant', -60, 'virement_interne', 't'],
      ['placement', 60, 'virement_interne', 't'],
    ])
    expect(insertions[1].empreinte_import).toBe(`${insertions[0].empreinte_import}|contrepartie`)
  })

  it('ne crée pas l’entrée sur le placement pour un versement déjà inclus dans son solde initial', () => {
    const { lignes } = preparerImport(
      entree({
        releves: [releveCA([op({ date: '2026-10-09', detail: 'CONTRAT EPARGNE DEMO', montant: -60 })])],
        comptes: [
          compte('courant'),
          compte('livret'),
          compte('placement', { nature: 'placement', disponible: false, date_solde_initial: '2026-11-02' }),
        ],
        regles: [regle({ motif: 'CONTRAT EPARGNE', type: 'virement_interne', categorie_id: null, compte_cible_id: 'placement' })],
      }),
    )
    expect(lignes[0]).toMatchObject({ contrepartieCreee: false, classement: { type: 'virement_interne' } })
    expect(construireImport(lignes).insertions).toHaveLength(1)
  })

  it('n’importe pas les lignes décochées', () => {
    const premiere = preparerImport(entree({ releves: [releveCA([op({})])] })).lignes[0]
    const { lignes } = preparerImport(entree({ releves: [releveCA([op({})])], exclues: new Set([premiere.empreinte]) }))
    expect(lignes[0].statut).toBe('exclue')
    expect(construireImport(lignes).insertions).toHaveLength(0)
  })

  it('contrôle le solde indiqué par la banque', () => {
    const releve: Releve = {
      nomFichier: 'ca.csv',
      banque: 'CA',
      blocs: [
        {
          banque: 'CA',
          cleImport: 'CA|A|COURANT',
          titre: 'Courant',
          solde: { date: '2026-10-15', montant: 95.8 },
          operations: [op({ date: '2026-10-10' }), op({ date: '2026-10-20', montant: -50 })],
        },
      ],
    }
    const existante = { compte_id: 'courant', date_operation: '2026-10-02', montant: 0, empreinte_import: null } as Transaction
    const ok = preparerImport(
      entree({ releves: [releve], comptes: [compte('courant', { solde_initial: 100 })], existantes: [existante] }),
    ).controles
    expect(ok).toMatchObject([{ soldeBanque: 95.8, soldeCalcule: 95.8, ecart: 0 }])
    const ecart = preparerImport(entree({ releves: [releve], comptes: [compte('courant', { solde_initial: 90 })] })).controles
    expect(ecart[0].ecart).toBe(10)
  })
})
