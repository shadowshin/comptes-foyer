import type { Locator, Page } from '@playwright/test'

export class FormulaireTransaction {
  readonly formulaire: Locator

  constructor(page: Page) {
    this.formulaire = page.getByRole('form', { name: 'Nouvelle transaction' })
  }

  async saisirDepense(d: { description: string; montant: string; compte: string; categorie: string }) {
    await this.formulaire.getByRole('textbox', { name: 'Description' }).fill(d.description)
    await this.formulaire.getByRole('textbox', { name: 'Montant (€)' }).fill(d.montant)
    await this.formulaire.getByRole('combobox', { name: 'Compte' }).selectOption(d.compte)
    await this.formulaire.getByRole('combobox', { name: 'Catégorie' }).selectOption(d.categorie)
    await this.formulaire.getByRole('button', { name: 'Ajouter la transaction' }).click()
  }

  async saisirVirement(d: { description: string; montant: string; compte: string; destination: string }) {
    await this.formulaire.getByRole('textbox', { name: 'Description' }).fill(d.description)
    await this.formulaire.getByRole('textbox', { name: 'Montant (€)' }).fill(d.montant)
    await this.formulaire.getByRole('combobox', { name: 'Type' }).selectOption('Virement interne')
    await this.formulaire.getByRole('combobox', { name: 'Compte de départ' }).selectOption(d.compte)
    await this.formulaire.getByRole('combobox', { name: 'Compte de destination' }).selectOption(d.destination)
    await this.formulaire.getByRole('button', { name: 'Ajouter la transaction' }).click()
  }
}