// Relevés entièrement fictifs, au format exact des exports bancaires
import { describe, expect, it } from 'vitest'
import { decoderFichier, lireCsv, lireDateFr, lireMontantBancaire } from './csv'
import { lireReleve } from './lireReleve'

const CA = [
  'Téléchargement du 15/10/2026;;;',
  ';;;',
  ';;;',
  'MADAME   DUPONT ALICE;;;',
  'Compte de Dépôt carte n° ;;;',
  'Solde au 15/10/2026 1 479,01 €;;;',
  ';;;',
  'Liste des opérations du compte entre le 20/08/2026 et le 15/10/2026;;;',
  ';;;',
  'Date;Libellé;Débit euros;Crédit euros',
  '12/10/2026;"Paiement par carte',
  'X1234 STATION DU VILLAGE AU 09/10 - Carburants',
  '',
  '',
  '";54,30;',
  '09/10/2026;"Prélèvement',
  'ASSUREUR VIE DEMO - CONTRAT EPARGNE DEMO',
  'VERSEMENT REGULIER',
  '00/123/456/01',
  'FR00ZZZ000000',
  'REF0001',
  '";60;',
  '03/10/2026;"Virement en votre faveur',
  'FRANCE TRAVAIL',
  '";;1 420,00',
  ';;;',
  'MADAME   DUPONT ALICE OU MADAME MARTIN BRIGITTE;;;',
  'Compte de Dépôt carte n° ;;;',
  'Solde au 15/10/2026 -12,50 €;;;',
  ';;;',
  'Liste des opérations du compte entre le 20/08/2026 et le 15/10/2026;;;',
  ';;;',
  'Date;Libellé;Débit euros;Crédit euros',
  '05/10/2026;"Prélèvement',
  'BAILLEUR DEMO',
  '";560,00;',
  ';;;',
  'MADAME   MARTIN BRIGITTE;;;',
  'Livret Epargne Populaire carte n° ;;;',
  'Solde au 15/10/2026 2 400,00 €;;;',
  'Aucune opération effectuée sur ce compte sur la période renseignée;;;',
].join('\r\n')

const CE = [
  'Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation',
  '02/10/2026;VIR. VERS LIVRET A;VIR. VERS LIVRET A;1234567IN0000001;;Virement recu;Transaction exclue;Virement interne;;+100,00;01/10/2026;02/10/2026;0',
  '15/10/2026;BOULANGERIE DEMO;CB BOULANGERIE DEMO 14/10;;;Carte bancaire;Alimentation;Boulangerie;-4,20;;14/10/2026;15/10/2026;0',
].join('\r\n')

describe('outils CSV', () => {
  it('garde les retours à la ligne et les guillemets doublés dans un champ', () => {
    expect(lireCsv('a;"b\r\nc";"d ""e"""\r\nf;g;h')).toEqual([
      ['a', 'b\r\nc', 'd "e"'],
      ['f', 'g', 'h'],
    ])
  })

  it('lit les dates françaises et refuse les dates impossibles', () => {
    expect(lireDateFr('09/10/2026')).toBe('2026-10-09')
    expect(lireDateFr('31/02/2026')).toBeNull()
    expect(lireDateFr('Date')).toBeNull()
  })

  it('lit les montants des banques', () => {
    expect(lireMontantBancaire('1 420,00')).toBe(1420)
    expect(lireMontantBancaire('1 420,00')).toBe(1420)
    expect(lireMontantBancaire('-4,20')).toBe(-4.2)
    expect(lireMontantBancaire('+100,00')).toBe(100)
    expect(lireMontantBancaire('42')).toBe(42)
    expect(lireMontantBancaire('')).toBeNull()
  })

  it('décode un fichier Windows-1252 comme un fichier UTF-8', () => {
    const windows1252 = new Uint8Array([0x54, 0xe9, 0x6c, 0xe9]) // « Télé »
    expect(decoderFichier(windows1252.buffer)).toBe('Télé')
    expect(decoderFichier(new TextEncoder().encode('﻿Télé').buffer)).toBe('Télé')
  })
})

describe('relevé Crédit Agricole', () => {
  const releve = lireReleve('CA20261015_120000.csv', CA)

  it('reconnaît la banque et découpe un bloc par compte, y compris vide', () => {
    expect(releve.banque).toBe('CA')
    expect(releve.blocs.map((b) => b.cleImport)).toEqual([
      'CA|MADAME DUPONT ALICE|COMPTE DE DÉPÔT',
      'CA|MADAME DUPONT ALICE OU MADAME MARTIN BRIGITTE|COMPTE DE DÉPÔT',
      'CA|MADAME MARTIN BRIGITTE|LIVRET EPARGNE POPULAIRE',
    ])
    expect(releve.blocs.map((b) => b.operations.length)).toEqual([3, 1, 0])
  })

  it('lit le solde de chaque bloc, y compris négatif', () => {
    expect(releve.blocs.map((b) => b.solde)).toEqual([
      { date: '2026-10-15', montant: 1479.01 },
      { date: '2026-10-15', montant: -12.5 },
      { date: '2026-10-15', montant: 2400 },
    ])
  })

  it('signe les débits et les crédits', () => {
    expect(releve.blocs[0].operations.map((o) => o.montant)).toEqual([-54.3, -60, 1420])
  })

  it('sépare la nature de l’opération du détail sur plusieurs lignes', () => {
    const [carte, prelevement] = releve.blocs[0].operations
    expect(carte).toMatchObject({
      date: '2026-10-12',
      typeBanque: 'Paiement par carte',
      libelle: 'Paiement par carte · X1234 STATION DU VILLAGE AU 09/10 - Carburants',
    })
    expect(prelevement.detail).toContain('CONTRAT EPARGNE DEMO')
    expect(prelevement.detail).toContain('VERSEMENT REGULIER')
  })
})

describe('relevé Crédit Agricole, format de novembre 2026', () => {
  // Fins de ligne Unix, ligne vide en tête, numéro de compte, en-tête « Date d'opération » et ; final
  const CA_2026_11 = [
    '',
    'Téléchargement du 02/11/2026;',
    '',
    '',
    'MADAME DUPONT ALICE',
    'Compte de Dépôt carte n° 12345678901;',
    'Solde au 02/11/2026 1 234,56 €',
    '',
    'Liste des opérations du compte entre le 01/10/2026 et le 02/11/2026;',
    '',
    "Date d'opération;Libellé;Débit euros;Crédit euros;",
    '30/10/2026;"Virement en votre faveur',
    'EMPLOYEUR DEMO',
    '',
    '";;1 900,00;',
    '28/10/2026;"Paiement par carte',
    'X1234 GARAGE DEMO     27/10 - Garage',
    '";89,90;;',
    'MADAME MARTIN BRIGITTE',
    'LDD Solidaire carte n° 98765432109',
    'Solde au 02/11/2026 25,29 €',
    'Aucune opération effectuée sur ce compte sur la période renseignée',
  ].join('\n')

  const releve = lireReleve('CA20261102_155116.csv', CA_2026_11)

  it('est reconnu comme un relevé Crédit Agricole', () => {
    expect(releve.banque).toBe('CA')
  })

  it('garde la même clé de compte que l’ancien format, malgré le numéro', () => {
    expect(releve.blocs.map((b) => b.cleImport)).toEqual([
      'CA|MADAME DUPONT ALICE|COMPTE DE DÉPÔT',
      'CA|MADAME MARTIN BRIGITTE|LDD SOLIDAIRE',
    ])
  })

  it('ne prend pas l’en-tête « Date d’opération » pour un titulaire', () => {
    expect(releve.blocs[1].titre).toBe('LDD Solidaire · MADAME MARTIN BRIGITTE')
  })

  it('lit les opérations et les soldes', () => {
    expect(releve.blocs[0].operations.map((o) => [o.date, o.montant])).toEqual([
      ['2026-10-30', 1900],
      ['2026-10-28', -89.9],
    ])
    expect(releve.blocs.map((b) => b.solde?.montant)).toEqual([1234.56, 25.29])
  })
})

describe('relevé Caisse d’Épargne', () => {
  const releve = lireReleve('00123456789_01092026_02112026.csv', CE)

  it('reconnaît la banque et tire le numéro de compte du nom du fichier', () => {
    expect(releve.banque).toBe('CE')
    expect(releve.blocs).toHaveLength(1)
    expect(releve.blocs[0]).toMatchObject({ cleImport: 'CE|00123456789', titre: 'Compte n° …6789', solde: null })
  })

  it('lit la date d’opération, le montant signé et la catégorie de la banque', () => {
    expect(releve.blocs[0].operations).toEqual([
      {
        date: '2026-10-01',
        libelle: 'VIR. VERS LIVRET A',
        detail: 'VIR. VERS LIVRET A',
        typeBanque: 'Virement recu',
        montant: 100,
        categorieBanque: 'Transaction exclue / Virement interne',
      },
      {
        date: '2026-10-14',
        libelle: 'BOULANGERIE DEMO',
        detail: 'CB BOULANGERIE DEMO 14/10',
        typeBanque: 'Carte bancaire',
        montant: -4.2,
        categorieBanque: 'Alimentation / Boulangerie',
      },
    ])
  })
})

describe('format inconnu', () => {
  it('refuse clairement un fichier qui n’est pas un relevé', () => {
    expect(() => lireReleve('notes.csv', 'nom;prenom\nA;B')).toThrow(/format non reconnu/)
  })
})
