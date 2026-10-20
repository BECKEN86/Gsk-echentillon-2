import { CompanyConfig } from '../types';

/**
 * Guide utilisateur GeStock — contenu structuré + génération du document
 * A4 imprimable (le navigateur permet « Enregistrer au format PDF »).
 * Contenu limité aux modules réellement présents dans l'application.
 */

export interface GuideSection {
  title: string;
  points: string[];
}

export interface GuideChapter {
  id: string;
  title: string;
  intro: string;
  sections: GuideSection[];
}

export const GUIDE_SOFTWARE = 'GeStock — Gestion Commerciale & POS';
export const GUIDE_VERSION = 'v1.0';

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'prise-en-main',
    title: '1. Prise en main',
    intro: 'Connexion, navigation et organisation générale du logiciel.',
    sections: [
      {
        title: 'Connexion',
        points: [
          'Saisissez votre identifiant et votre mot de passe sur l\'écran de connexion.',
          'Le menu affiché dépend de votre rôle (Administrateur, Gérant, Caissier, Responsable Agence) et des sections qui vous sont autorisées.',
          'Votre nom et votre rôle apparaissent en haut à droite ; le bouton de déconnexion met fin à la session.'
        ]
      },
      {
        title: 'Navigation',
        points: [
          'Le menu latéral est organisé en groupes : Accueil, Inventaire, Acteurs, Achat, Vente, Financière et comptabilité, Paramètres.',
          'Le fil d\'Ariane dans l\'en-tête indique toujours le groupe et la section courante.',
          'Chaque vue propose des actions d\'impression et d\'export CSV de la liste affichée.'
        ]
      },
      {
        title: 'Conventions',
        points: [
          'Dates saisies au format JJ/MM/AAAA ou AAAA-MM-JJ ; montants en FCFA.',
          'Les documents sont numérotés automatiquement : VTE (ventes), DP (demandes de prix), BC (bons de commande), REC (réceptions), APP (approvisionnements), INV (inventaires), ADJ (ajustements), TRF (transferts), DEC (pertes), RC/RF (retours), AV/AVF (avoirs).',
          'Les documents validés ne sont jamais supprimés : ils sont annulés ou contre-passés pour préserver la traçabilité.'
        ]
      }
    ]
  },
  {
    id: 'accueil',
    title: '2. Tableau de bord',
    intro: 'Vue synthétique de l\'activité et des alertes.',
    sections: [
      {
        title: 'Indicateurs',
        points: [
          'Ventes du jour / du mois / de l\'année et marge brute associée.',
          'Alertes : produits sous le seuil de stock, commandes en attente, sessions de caisse actives.',
          'Chaque carte renvoie vers le module concerné.'
        ]
      }
    ]
  },
  {
    id: 'inventaire',
    title: '3. Inventaire & stock',
    intro: 'Catalogue produits, emplacements et toutes les opérations sur les quantités.',
    sections: [
      {
        title: 'Produits',
        points: [
          'Fiche article : code, code-barres, famille, prix d\'achat/vente, TVA, seuil d\'alerte, unité de vente (UOV) et unité de stockage.',
          'Le stock global de l\'article est mis à jour automatiquement par chaque entrée/sortie.',
          'Le détail d\'un produit affiche l\'historique complet de ses mouvements.'
        ]
      },
      {
        title: 'Magasins & rayons',
        points: [
          'Créez vos magasins puis les rayons rattachés (capacité, nombre d\'étagères).',
          'Chaque produit est rattaché à un emplacement affiché dans les listes et exports.'
        ]
      },
      {
        title: 'Approvisionnement',
        points: [
          'L\'approvisionnement transforme une réception validée en entrée de stock.',
          'Une réception déjà approvisionnée ne peut pas être réutilisée (garde anti double entrée).',
          'L\'annulation d\'un approvisionnement retire le stock (refusée si le stock a déjà été vendu).'
        ]
      },
      {
        title: 'Inventaire physique',
        points: [
          'Comptage par dépôt ou famille, avec simple ou double comptage selon le mode choisi.',
          'Les écarts sont chiffrés en quantité et en valeur ; la régularisation génère les mouvements correspondants.',
          'La clôture archive l\'inventaire avec ses lignes et justifications.'
        ]
      },
      {
        title: 'Valorisation du stock',
        points: [
          'Valorisation CUMP ou FIFO à une date de référence, avec filtres dépôt/famille.',
          'Réconciliation en direct : stock théorique (mouvements) vs stock réel (fiche produit) avec colonne d\'écart.',
          'Les états clôturés sont archivés et ré-imprimables.'
        ]
      },
      {
        title: 'Ajustements, transferts, pertes',
        points: [
          'Ajustement : correction d\'un écart constaté (motif obligatoire), validé par un gestionnaire.',
          'Transfert : sortie du dépôt source puis réception au dépôt cible — le coût CUMP est figé à l\'expédition.',
          'Pertes & avariés : constat sans impact stock, puis déstockage validé qui génère la sortie et la valeur de perte.'
        ]
      },
      {
        title: 'Alertes péremption',
        points: [
          'Liste des lots expirés, expirant sous 7 ou 30 jours (dates saisies à la réception).',
          'Valeur à risque chiffrée par lot ; impression et export CSV disponibles.'
        ]
      }
    ]
  },
  {
    id: 'achats',
    title: '4. Achats & fournisseurs',
    intro: 'Circuit complet : Demande de prix → Bon de commande → Réception → Approvisionnement.',
    sections: [
      {
        title: 'Cycle d\'achat',
        points: [
          'Demande de prix (DP) : consultation fournisseur, lignes produits en UOA, option de suggestion de réapprovisionnement pour les produits sous seuil.',
          'Bon de commande (BC) : créé depuis une DP, avec totaux HT/TVA/TTC et règlement éventuel.',
          'Réception (REC) : quantités commandées/reçues/acceptées et dates de péremption par lot.',
          'Approvisionnement (APP) : mise en stock des quantités acceptées.'
        ]
      },
      {
        title: 'Retours fournisseurs',
        points: [
          'Document RF : sort le stock retourné et déduit d\'abord la dette fournisseur ; l\'excédent devient un avoir AVF.',
          'L\'annulation contre-passe le retour (refusée si l\'avoir a été utilisé ou remboursé).'
        ]
      },
      {
        title: 'Dettes & paiements',
        points: [
          'Chaque réception créditée crée une dette ; les paiements partiels sont historisés par ligne.',
          'La fiche fournisseur affiche dettes, paiements et avoirs disponibles.'
        ]
      }
    ]
  },
  {
    id: 'ventes',
    title: '5. Ventes & point de vente',
    intro: 'Sessions de caisse, ventes comptoir, retours et avoirs.',
    sections: [
      {
        title: 'Session de caisse',
        points: [
          'Ouverture avec fond de caisse, fermeture avec comptage et écart automatique.',
          'Le Z de caisse (bouton dans la fiche session) édite la ventilation par mode de règlement avec écart et signatures.'
        ]
      },
      {
        title: 'Point de vente (POS)',
        points: [
          'Scan code-barres ou recherche produit ; vente en UOV avec conversion automatique en unité de stockage.',
          'Règlements : espèces, mobile money, carte, crédit client.',
          'Les commandes peuvent être suspendues (« En cours ») puis reprises et validées.'
        ]
      },
      {
        title: 'Annulation de vente',
        points: [
          'Une vente validée n\'est jamais supprimée : l\'annulation contre-passe la recette et réintègre le stock.',
          'Seuls les gestionnaires peuvent annuler une vente.'
        ]
      },
      {
        title: 'Retours clients & avoirs',
        points: [
          'Document RC créé depuis une vente validée : quantités retournables limitées à ce qui reste non retourné.',
          'Le montant est déduit d\'abord du crédit client, puis l\'excédent crée un avoir AV utilisable en règlement.',
          'Ticket 80 mm du retour imprimable.'
        ]
      }
    ]
  },
  {
    id: 'acteurs',
    title: '6. Clients & fournisseurs',
    intro: 'Fiches tiers, crédits et historiques financiers.',
    sections: [
      {
        title: 'Clients',
        points: [
          'Fiche : coordonnées, type, total des achats et solde de crédit.',
          'Crédits : lignes par vente avec échéance ; règlements partiels tracés (numéro, montant, reste).',
          'Avoirs : montant total, remboursé/utilisé et solde restant.'
        ]
      },
      {
        title: 'Fournisseurs',
        points: [
          'Fiche : coordonnées, catégories, dette et total des achats.',
          'Dettes par document source avec paiements historisés ; avoirs fournisseurs suivis séparément.'
        ]
      }
    ]
  },
  {
    id: 'finance',
    title: '7. Financière et comptabilité',
    intro: 'Flux de caisse et suivi de trésorerie.',
    sections: [
      {
        title: 'Recettes & dépenses',
        points: [
          'Saisie par type, catégorie, compte et mode de règlement, avec statut de validation.',
          'Les contre-passations issues des annulations y figurent pour préserver le journal.'
        ]
      },
      {
        title: 'Caisses & trésorerie',
        points: [
          'Comptes : caisse, banque, mobile money — soldes en temps réel.',
          'Mouvements internes (transferts entre comptes) tracés avec motif et référence.'
        ]
      },
      {
        title: 'Marges & résultat',
        points: ['Estimation des marges par période à partir des ventes et coûts figés.']
      }
    ]
  },
  {
    id: 'parametres',
    title: '8. Paramètres',
    intro: 'Administration du logiciel — réservée aux rôles autorisés.',
    sections: [
      {
        title: 'Utilisateurs',
        points: [
          'Création de comptes avec rôle, sections autorisées et section par défaut.',
          'Les mots de passe sont stockés hachés ; réinitialisation possible par un administrateur.'
        ]
      },
      {
        title: 'Configuration société',
        points: ['Raison sociale, adresse, contacts, RCCM/NCC et logo utilisés sur les documents imprimés.']
      },
      {
        title: 'Savegarder — exportation des données',
        points: [
          'Export Excel (.xlsx) de tout ou partie des données : articles, stocks, mouvements, ventes, achats, tiers, trésorerie, audit…',
          'Deux modes : classeur unique à feuilles, ou un fichier par partie regroupé en ZIP.',
          'Filtres disponibles : période, dépôt, client, fournisseur ; l\'export est en lecture seule et journalisé dans l\'audit.'
        ]
      },
      {
        title: 'Journal d\'audit',
        points: ['Toutes les actions sensibles sont tracées : utilisateur, date/heure, action, document concerné.']
      }
    ]
  },
  {
    id: 'bonnes-pratiques',
    title: '9. Bonnes pratiques & sécurité',
    intro: 'Règles d\'usage pour des données fiables.',
    sections: [
      {
        title: 'Bonnes pratiques',
        points: [
          'Fermez les sessions de caisse chaque jour et archivez le Z de caisse.',
          'Réalisez un inventaire physique périodique et justifiez chaque écart.',
          'Ne supprimez jamais un document validé : utilisez l\'annulation, qui conserve la trace.',
          'Sauvegardez régulièrement via Paramètres → Savegarder et conservez le fichier hors du poste.'
        ]
      },
      {
        title: 'Sécurité',
        points: [
          'Chaque utilisateur travaille avec son propre compte ; ne partagez pas les identifiants.',
          'Les validations de stock sont réservées aux rôles gestionnaires.',
          'Les exports contiennent des données sensibles : stockez-les dans un emplacement protégé.'
        ]
      }
    ]
  }
];

// ------------------------------------------------------------------ PDF
const esc = (s?: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ouvre l'impression du guide utilisateur — « Enregistrer au format PDF » dans la boîte d'impression. */
export function printUserGuide(company: CompanyConfig | null) {
  const today = new Date().toLocaleDateString('fr-FR');
  const companyName = company?.name || 'GESTOCK';

  const toc = GUIDE_CHAPTERS.map(
    (c, i) => `<tr><td class="toc-n">${i + 1}</td><td>${esc(c.title)}</td></tr>`
  ).join('');

  const body = GUIDE_CHAPTERS.map(
    c => `
    <section class="chapter">
      <h2>${esc(c.title)}</h2>
      <p class="intro">${esc(c.intro)}</p>
      ${c.sections
        .map(
          s => `
        <h3>${esc(s.title)}</h3>
        <ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        )
        .join('')}
    </section>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guide utilisateur ${esc(companyName)}</title>
    <style>
      @page { size: A4 portrait; margin: 18mm 16mm; }
      body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; font-size: 11.5px; line-height: 1.55; margin: 0; }
      .cover { height: 240mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
      .cover .brand { font-size: 42px; font-weight: 900; color: #001F3F; letter-spacing: 2px; }
      .cover h1 { font-size: 24px; color: #0f172a; margin: 18px 0 6px; }
      .cover .sub { color: #64748b; font-size: 12px; }
      .cover .badge { margin-top: 30px; padding: 8px 22px; border: 2px solid #001F3F; border-radius: 30px; color: #001F3F; font-weight: 700; font-size: 12px; }
      .tocbox { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; page-break-after: always; }
      .tocbox h2 { margin-top: 0; }
      .tocbox table { width: 100%; border-collapse: collapse; }
      .tocbox td { padding: 5px 6px; border-bottom: 1px dotted #cbd5e1; font-size: 12px; }
      .toc-n { width: 26px; font-weight: 800; color: #001F3F; }
      .chapter { page-break-before: always; }
      .chapter:first-of-type { page-break-before: auto; }
      h2 { color: #001F3F; font-size: 18px; border-bottom: 2px solid #001F3F; padding-bottom: 6px; margin: 4px 0 8px; }
      h3 { color: #0f172a; font-size: 13px; margin: 14px 0 4px; }
      .intro { color: #64748b; font-style: italic; margin: 0 0 10px; }
      ul { margin: 4px 0 10px; padding-left: 18px; }
      li { margin: 3px 0; }
      .footer-note { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9.5px; text-align: center; }
    </style></head><body>
    <div class="cover">
      <div class="brand">${esc(companyName)}</div>
      <h1>Guide utilisateur</h1>
      <div class="sub">${esc(GUIDE_SOFTWARE)}</div>
      <div class="badge">${esc(GUIDE_VERSION)} — Édité le ${today}</div>
    </div>
    <div class="tocbox">
      <h2>Sommaire</h2>
      <table><tbody>${toc}</tbody></table>
    </div>
    ${body}
    <div class="footer-note">${esc(companyName)} — Guide utilisateur ${esc(GUIDE_SOFTWARE)} — Document généré le ${today}</div>
  </body></html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  setTimeout(() => {
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  }, 250);
}
