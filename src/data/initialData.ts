import { Product, ProductCategory, Client, Supplier, StockMovement, PriceInquiry, PurchaseOrder, GoodsReception, SaleOrder, PointDeVente, FinancialTransaction, TreasuryAccount, TreasuryMovement, ApprovisionnementRecord, StorageSite } from '../types';

export const INITIAL_CATEGORIES: ProductCategory[] = [
  {
    id: 'cat1',
    code: 'CAT-ALI',
    name: 'Alimentation',
    description: 'Produits vivriers, céréales, farines, féculents et huiles alimentaires',
    color: '#2563EB'
  },
  {
    id: 'cat2',
    code: 'CAT-EPI',
    name: 'Epicerie',
    description: 'Produits d\'épicerie sèche, sucre, café, laits et conserves',
    color: '#059669'
  },
  {
    id: 'cat3',
    code: 'CAT-BOI',
    name: 'Boissons',
    description: 'Eaux minérales, jus de fruits, boissons gazeuses et nectars',
    color: '#D97706'
  },
  {
    id: 'cat4',
    code: 'CAT-HYG',
    name: 'Hygiène & Entretien',
    description: 'Savons corporels, lessives, détergents et produits d\'entretien ménager',
    color: '#7C3AED'
  },
  {
    id: 'cat5',
    code: 'CAT-DIV',
    name: 'Divers',
    description: 'Articles divers, emballages et consommables de point de vente',
    color: '#4B5563'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    code: 'PRD-001',
    barcode: '6181100234512',
    name: 'Riz Parfumé 25kg (Marly)',
    category: 'Alimentation',
    categoryId: 'cat1',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
    buyPrice: 14500,
    sellPrice: 17500,
    vatPurchase: 0,
    vatSale: 0,
    stock: 45,
    minStock: 10,
    unit: 'sac',
    storageUnit: 'sac',
    measurementUnit: 'kilogramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u1_1', label: 'Sac individuel 25kg', type: 'UOV', quantity: 1, price: 17500 },
      { id: 'u1_2', label: 'Demi-gros (Lot de 5 sacs)', type: 'UOV', quantity: 5, price: 85000 },
      { id: 'u1_3', label: 'Palette standard 40 sacs', type: 'UOA', quantity: 40, price: 580000 },
      { id: 'u1_4', label: 'Camion 200 sacs', type: 'UOA', quantity: 200, price: 2850000 }
    ],
    uov: { label: 'Sac 25kg', type: 'UOV', quantity: 1, price: 17500 },
    uoa: { label: 'Palette 40 sacs', type: 'UOA', quantity: 40, price: 580000 },
    lastRestocked: '2026-07-28'
  },
  {
    id: 'p2',
    code: 'PRD-002',
    barcode: '6181100234529',
    name: 'Huile de Palme Raffinée 5L (Dinor)',
    category: 'Alimentation',
    categoryId: 'cat1',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
    buyPrice: 5800,
    sellPrice: 7000,
    vatPurchase: 18,
    vatSale: 18,
    stock: 18,
    minStock: 5,
    unit: 'bidon',
    storageUnit: 'bidon',
    measurementUnit: 'litre',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u2_1', label: 'Bidon 5L au détail', type: 'UOV', quantity: 1, price: 7000 },
      { id: 'u2_2', label: 'Carton de 4 Bidons (Vente)', type: 'UOV', quantity: 4, price: 27500 },
      { id: 'u2_3', label: 'Carton 4 Bidons (Fournisseur)', type: 'UOA', quantity: 4, price: 23200 },
      { id: 'u2_4', label: 'Palette 50 cartons', type: 'UOA', quantity: 200, price: 1150000 }
    ],
    uov: { label: 'Bidon 5L', type: 'UOV', quantity: 1, price: 7000 },
    uoa: { label: 'Carton 4 Bidons', type: 'UOA', quantity: 4, price: 23200 },
    lastRestocked: '2026-07-25'
  },
  {
    id: 'p3',
    code: 'PRD-003',
    barcode: '6181100234536',
    name: 'Sucre Blanc en Morceaux 1kg',
    category: 'Epicerie',
    categoryId: 'cat2',
    imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=400&q=80',
    buyPrice: 800,
    sellPrice: 1000,
    vatPurchase: 0,
    vatSale: 0,
    stock: 4, // Low stock alert!
    minStock: 15,
    unit: 'paquet',
    storageUnit: 'paquet',
    measurementUnit: 'kilogramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u3_1', label: 'Paquet 1kg au détail', type: 'UOV', quantity: 1, price: 1000 },
      { id: 'u3_2', label: 'Pack de 10 paquets', type: 'UOV', quantity: 10, price: 9500 },
      { id: 'u3_3', label: 'Carton 25 Paquets', type: 'UOA', quantity: 25, price: 20000 }
    ],
    uov: { label: 'Paquet 1kg', type: 'UOV', quantity: 1, price: 1000 },
    uoa: { label: 'Carton 25 Paquets', type: 'UOA', quantity: 25, price: 20000 },
    lastRestocked: '2026-07-15'
  },
  {
    id: 'p4',
    code: 'PRD-004',
    barcode: '6181100234543',
    name: 'Lait Concentré Sucré Nestlé (397g)',
    category: 'Epicerie',
    categoryId: 'cat2',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    buyPrice: 550,
    sellPrice: 750,
    vatPurchase: 18,
    vatSale: 18,
    stock: 120,
    minStock: 25,
    unit: 'boîte',
    storageUnit: 'boîte',
    measurementUnit: 'gramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u4_1', label: 'Boîte individuelle 397g', type: 'UOV', quantity: 1, price: 750 },
      { id: 'u4_2', label: 'Pack de 6 boîtes', type: 'UOV', quantity: 6, price: 4400 },
      { id: 'u4_3', label: 'Carton 48 boîtes', type: 'UOA', quantity: 48, price: 26400 }
    ],
    uov: { label: 'Boîte individuelle', type: 'UOV', quantity: 1, price: 750 },
    uoa: { label: 'Carton 48 boîtes', type: 'UOA', quantity: 48, price: 26400 },
    lastRestocked: '2026-07-30'
  },
  {
    id: 'p5',
    code: 'PRD-005',
    barcode: '6181100234550',
    name: 'Savon de Marseille 400g (BF)',
    category: 'Hygiène & Entretien',
    categoryId: 'cat4',
    imageUrl: 'https://images.unsplash.com/photo-1607006314642-83b632932f91?auto=format&fit=crop&w=400&q=80',
    buyPrice: 350,
    sellPrice: 500,
    vatPurchase: 18,
    vatSale: 18,
    stock: 2, // Low stock alert!
    minStock: 20,
    unit: 'pièce',
    storageUnit: 'pièce',
    measurementUnit: 'pièce',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u5_1', label: 'Morceau 400g', type: 'UOV', quantity: 1, price: 500 },
      { id: 'u5_2', label: 'Pack de 4 morceaux', type: 'UOV', quantity: 4, price: 1900 },
      { id: 'u5_3', label: 'Carton 36 barres', type: 'UOA', quantity: 36, price: 12600 }
    ],
    uov: { label: 'Morceau 400g', type: 'UOV', quantity: 1, price: 500 },
    uoa: { label: 'Carton 36 barres', type: 'UOA', quantity: 36, price: 12600 },
    lastRestocked: '2026-07-10'
  },
  {
    id: 'p6',
    code: 'PRD-006',
    barcode: '6181100234567',
    name: 'Eau Minérale Awa 1.5L (Carton 12)',
    category: 'Boissons',
    categoryId: 'cat3',
    imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80',
    buyPrice: 2200,
    sellPrice: 3000,
    vatPurchase: 18,
    vatSale: 18,
    stock: 35,
    minStock: 8,
    unit: 'carton',
    storageUnit: 'carton',
    measurementUnit: 'litre',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u6_1', label: 'Bouteille 1.5L à l\'unité', type: 'UOV', quantity: 0.083, price: 300 },
      { id: 'u6_2', label: 'Pack 12 bouteilles (Carton)', type: 'UOV', quantity: 1, price: 3000 },
      { id: 'u6_3', label: 'Palette 60 cartons', type: 'UOA', quantity: 60, price: 132000 }
    ],
    uov: { label: 'Pack 12 bouteilles', type: 'UOV', quantity: 1, price: 3000 },
    uoa: { label: 'Palette 60 cartons', type: 'UOA', quantity: 60, price: 132000 },
    lastRestocked: '2026-07-29'
  },
  {
    id: 'p7',
    code: 'PRD-007',
    barcode: '6181100234574',
    name: 'Farine de Blé Panifiable 50kg',
    category: 'Alimentation',
    categoryId: 'cat1',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    buyPrice: 21000,
    sellPrice: 24500,
    vatPurchase: 0,
    vatSale: 0,
    stock: 8,
    minStock: 10,
    unit: 'sac',
    storageUnit: 'sac',
    measurementUnit: 'kilogramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u7_1', label: 'Sac 50kg au détail', type: 'UOV', quantity: 1, price: 24500 },
      { id: 'u7_2', label: 'Palette 20 sacs', type: 'UOA', quantity: 20, price: 420000 }
    ],
    uov: { label: 'Sac 50kg', type: 'UOV', quantity: 1, price: 24500 },
    uoa: { label: 'Palette 20 sacs', type: 'UOA', quantity: 20, price: 420000 },
    lastRestocked: '2026-07-20'
  },
  {
    id: 'p8',
    code: 'PRD-008',
    barcode: '6181100234581',
    name: 'Café Nescafé Classic 200g',
    category: 'Epicerie',
    categoryId: 'cat2',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    buyPrice: 2800,
    sellPrice: 3500,
    vatPurchase: 18,
    vatSale: 18,
    stock: 24,
    minStock: 10,
    unit: 'boîte',
    storageUnit: 'boîte',
    measurementUnit: 'gramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u8_1', label: 'Bocal 200g individuel', type: 'UOV', quantity: 1, price: 3500 },
      { id: 'u8_2', label: 'Carton 12 bocaux', type: 'UOA', quantity: 12, price: 33600 }
    ],
    uov: { label: 'Bocal 200g', type: 'UOV', quantity: 1, price: 3500 },
    uoa: { label: 'Carton 12 bocaux', type: 'UOA', quantity: 12, price: 33600 },
    lastRestocked: '2026-07-22'
  },
  {
    id: 'p9',
    code: 'PRD-009',
    barcode: '6181100234598',
    name: 'Bière Bleu',
    category: 'Boissons',
    categoryId: 'cat3',
    imageUrl: 'https://images.unsplash.com/photo-1608270191873-a4c000f684bb?auto=format&fit=crop&w=400&q=80',
    buyPrice: 500,
    sellPrice: 700,
    vatPurchase: 18,
    vatSale: 18,
    stock: 80,
    minStock: 20,
    unit: 'bouteille',
    storageUnit: 'casier',
    measurementUnit: 'centilitre',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: [
      { id: 'u9_1', label: 'Bouteille 65cl', type: 'UOV', quantity: 1, price: 700 },
      { id: 'u9_2', label: 'Casier', type: 'UOA', quantity: 12, price: 6000 },
      { id: 'u9_3', label: 'Demi-casier', type: 'UOA', quantity: 6, price: 3000 }
    ],
    uov: { label: 'Bouteille 65cl', type: 'UOV', quantity: 1, price: 700 },
    uoa: { label: 'Casier', type: 'UOA', quantity: 12, price: 6000 },
    lastRestocked: '2026-08-01'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Boulangerie du Marché',
    phone: '+225 07 08 12 34 56',
    email: 'contact@boulangeriemarche.ci',
    address: 'Abidjan, Cocody Blockhauss',
    type: 'Entreprise',
    creditBalance: 45000,
    totalPurchases: 680000,
    creditLines: [
      {
        id: 'crd1',
        clientId: 'c1',
        creditNumber: 'CRD-2026-001',
        invoiceRef: 'VTE-2026-098',
        date: '2026-07-30 15:20',
        initialAmount: 75000,
        paidAmount: 30000,
        remainingAmount: 45000,
        dueDate: '2026-08-15',
        status: 'En cours',
        notes: 'Crédit accordé sur fourniture farine et sucre.',
        payments: [
          {
            id: 'pay1_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-31 10:15',
            amount: 20000,
            remainingAmount: 55000,
            operator: 'Awa Cissé',
            paymentMethod: 'Espèces',
            reference: 'REC-0091'
          },
          {
            id: 'pay1_2',
            paymentNumber: 'Paiement n° 2',
            date: '2026-08-02 16:40',
            amount: 10000,
            remainingAmount: 45000,
            operator: 'Kouassi Marc',
            paymentMethod: 'Mobile Money',
            reference: 'MM-78412'
          }
        ]
      },
      {
        id: 'crd2',
        clientId: 'c1',
        creditNumber: 'CRD-2026-002',
        invoiceRef: 'VTE-2026-054',
        date: '2026-07-15 11:30',
        initialAmount: 40000,
        paidAmount: 40000,
        remainingAmount: 0,
        dueDate: '2026-07-25',
        status: 'Soldé',
        notes: 'Crédit entièrement apuré.',
        payments: [
          {
            id: 'pay2_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-20 09:10',
            amount: 25000,
            remainingAmount: 15000,
            operator: 'Awa Cissé',
            paymentMethod: 'Chèque',
            reference: 'CHQ-5412'
          },
          {
            id: 'pay2_2',
            paymentNumber: 'Paiement n° 2',
            date: '2026-07-24 14:05',
            amount: 15000,
            remainingAmount: 0,
            operator: 'Awa Cissé',
            paymentMethod: 'Espèces',
            reference: 'REC-0082'
          }
        ]
      }
    ],
    avoirLines: [
      {
        id: 'av1',
        clientId: 'c1',
        avoirNumber: 'AV-2026-001',
        sourceRef: 'RET-2026-003',
        date: '2026-07-28 14:00',
        reason: 'Retour sacs farine emballage déchiré',
        totalAmount: 25000,
        refundedAmount: 10000,
        remainingBalance: 15000,
        status: 'Partiellement remboursé',
        notes: 'Avoir émis suite à réclamation livraison.',
        refunds: [
          {
            id: 'ref1_1',
            refundNumber: 'Remboursement n° 1',
            date: '2026-07-29 11:30',
            amount: 10000,
            remainingBalance: 15000,
            operator: 'Awa Cissé',
            refundMethod: 'Espèces',
            notes: 'Acompte remboursé en caisse'
          }
        ]
      }
    ]
  },
  {
    id: 'c2',
    name: 'Mme Koné Aminata',
    phone: '+225 05 44 88 99 00',
    email: 'konne.ami@gmail.com',
    address: 'Abidjan, Marcory Zone 4',
    type: 'Particulier',
    creditBalance: 0,
    totalPurchases: 125000,
    creditLines: [],
    avoirLines: [
      {
        id: 'av2',
        clientId: 'c2',
        avoirNumber: 'AV-2026-002',
        sourceRef: 'VTE-2026-088',
        date: '2026-07-26 10:20',
        reason: 'Remise fidélité / Trop-perçu caisse',
        totalAmount: 5000,
        refundedAmount: 5000,
        remainingBalance: 0,
        status: 'Totalement remboursé',
        notes: 'Avoir déduit lors de la commande suivante.',
        refunds: [
          {
            id: 'ref2_1',
            refundNumber: 'Remboursement n° 1',
            date: '2026-07-27 16:00',
            amount: 5000,
            remainingBalance: 0,
            operator: 'Awa Cissé',
            refundMethod: 'Avoir sur vente',
            notes: 'Déduit sur ticket VTE-2026-089'
          }
        ]
      }
    ]
  },
  {
    id: 'c3',
    name: 'Restaurant La Grillade',
    phone: '+225 01 22 33 44 55',
    email: 'lagrillade@resto.ci',
    address: 'Abidjan, Plateau Rue Commerce',
    type: 'Entreprise',
    creditBalance: 12000,
    totalPurchases: 940000,
    creditLines: [
      {
        id: 'crd3',
        clientId: 'c3',
        creditNumber: 'CRD-2026-003',
        invoiceRef: 'VTE-2026-071',
        date: '2026-07-22 17:30',
        initialAmount: 32000,
        paidAmount: 20000,
        remainingAmount: 12000,
        dueDate: '2026-08-08',
        status: 'En cours',
        notes: 'Fourniture boîtes de conserves et huile.',
        payments: [
          {
            id: 'pay3_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-25 12:00',
            amount: 20000,
            remainingAmount: 12000,
            operator: 'Kouassi Marc',
            paymentMethod: 'Mobile Money',
            reference: 'MM-99321'
          }
        ]
      }
    ],
    avoirLines: []
  },
  {
    id: 'c4',
    name: 'M. Yao Jean-Philippe',
    phone: '+225 07 55 66 77 88',
    email: 'jp.yao@yahoo.fr',
    address: 'Abidjan, Yopougon Ananeraie',
    type: 'Particulier',
    creditBalance: 5000,
    totalPurchases: 42000,
    creditLines: [
      {
        id: 'crd4',
        clientId: 'c4',
        creditNumber: 'CRD-2026-004',
        invoiceRef: 'VTE-2026-095',
        date: '2026-07-29 18:00',
        initialAmount: 15000,
        paidAmount: 10000,
        remainingAmount: 5000,
        dueDate: '2026-08-10',
        status: 'En cours',
        notes: 'Crédit dépannage week-end.',
        payments: [
          {
            id: 'pay4_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-08-01 08:45',
            amount: 10000,
            remainingAmount: 5000,
            operator: 'Awa Cissé',
            paymentMethod: 'Espèces',
            reference: 'REC-0104'
          }
        ]
      }
    ],
    avoirLines: [
      {
        id: 'av3',
        clientId: 'c4',
        avoirNumber: 'AV-2026-003',
        sourceRef: 'RET-2026-008',
        date: '2026-08-02 09:30',
        reason: 'Retour article erreur de référence',
        totalAmount: 3500,
        refundedAmount: 0,
        remainingBalance: 3500,
        status: 'Actif',
        notes: 'Avoir disponible pour prochain achat.',
        refunds: []
      }
    ]
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    name: 'SANIA Distribution',
    contactPerson: 'M. Bakayoko Ibrahima',
    phone: '+225 27 21 35 40 00',
    email: 'commandes@sania.ci',
    address: 'Zone Industrielle de Vridi, Abidjan',
    categories: ['Alimentation', 'Epicerie'],
    balance: 150000,
    totalPurchases: 1450000,
    creditLines: [
      {
        id: 'scrd1',
        supplierId: 's1',
        creditNumber: 'DET-SAN-2026-001',
        invoiceRef: 'FAC-SAN-8891',
        date: '2026-07-28 10:00',
        initialAmount: 250000,
        paidAmount: 100000,
        remainingAmount: 150000,
        dueDate: '2026-08-28',
        status: 'En cours',
        notes: 'Achat huiles végétales et savons en gros.',
        payments: [
          {
            id: 'spay1_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-30 11:30',
            amount: 60000,
            remainingAmount: 190000,
            operator: 'Awa Cissé',
            paymentMethod: 'Virement bancaire',
            reference: 'VIR-9012'
          },
          {
            id: 'spay1_2',
            paymentNumber: 'Paiement n° 2',
            date: '2026-08-01 15:45',
            amount: 40000,
            remainingAmount: 150000,
            operator: 'Kouassi Marc',
            paymentMethod: 'Chèque',
            reference: 'CHQ-8821'
          }
        ]
      },
      {
        id: 'scrd2',
        supplierId: 's1',
        creditNumber: 'DET-SAN-2026-002',
        invoiceRef: 'FAC-SAN-8720',
        date: '2026-07-10 09:15',
        initialAmount: 180000,
        paidAmount: 180000,
        remainingAmount: 0,
        dueDate: '2026-07-25',
        status: 'Soldé',
        notes: 'Facture entièrement soldée par virement.',
        payments: [
          {
            id: 'spay2_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-22 14:00',
            amount: 180000,
            remainingAmount: 0,
            operator: 'Awa Cissé',
            paymentMethod: 'Virement bancaire',
            reference: 'VIR-8755'
          }
        ]
      }
    ],
    avoirLines: [
      {
        id: 'sav1',
        supplierId: 's1',
        avoirNumber: 'AVF-SAN-2026-001',
        sourceRef: 'RET-SAN-004',
        date: '2026-07-29 16:20',
        reason: 'Retour 5 bidons huile d\'arachide opercules percés',
        totalAmount: 45000,
        refundedAmount: 20000,
        remainingBalance: 25000,
        status: 'Partiellement remboursé',
        notes: 'Avoir accordé par le commercial Bakayoko.',
        refunds: [
          {
            id: 'sref1_1',
            refundNumber: 'Remboursement n° 1',
            date: '2026-07-31 14:00',
            amount: 20000,
            remainingBalance: 25000,
            operator: 'Awa Cissé',
            refundMethod: 'Déduction sur facture',
            notes: 'Déduit sur prochain bon de commande'
          }
        ]
      }
    ]
  },
  {
    id: 's2',
    name: 'SOCIETE IVOIRIENNE DE RAFINAGE',
    contactPerson: 'Mme Traoré Fatou',
    phone: '+225 27 20 22 11 00',
    email: 'commercial@sir.ci',
    address: 'Abidjan Plateau, Rue du Commerce',
    categories: ['Hygiène & Entretien'],
    balance: 0,
    totalPurchases: 650000,
    creditLines: [
      {
        id: 'scrd3',
        supplierId: 's2',
        creditNumber: 'DET-SIR-2026-001',
        invoiceRef: 'FAC-SIR-1029',
        date: '2026-07-05 10:00',
        initialAmount: 120000,
        paidAmount: 120000,
        remainingAmount: 0,
        dueDate: '2026-07-20',
        status: 'Soldé',
        notes: 'Commande réactifs et solvants.',
        payments: [
          {
            id: 'spay3_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-18 10:30',
            amount: 120000,
            remainingAmount: 0,
            operator: 'Kouassi Marc',
            paymentMethod: 'Chèque',
            reference: 'CHQ-7714'
          }
        ]
      }
    ],
    avoirLines: []
  },
  {
    id: 's3',
    name: 'SOLIBRA SA',
    contactPerson: 'M. Koffi Kouadio',
    phone: '+225 27 21 21 88 88',
    email: 'ventes@solibra.ci',
    address: 'Treichville Boulevard de Marseille',
    categories: ['Boissons'],
    balance: 85000,
    totalPurchases: 980000,
    creditLines: [
      {
        id: 'scrd4',
        supplierId: 's3',
        creditNumber: 'DET-SOL-2026-001',
        invoiceRef: 'FAC-SOL-9912',
        date: '2026-07-25 14:00',
        initialAmount: 135000,
        paidAmount: 50000,
        remainingAmount: 85000,
        dueDate: '2026-08-15',
        status: 'En cours',
        notes: 'Livraison packs boissons gazeuses et bières.',
        payments: [
          {
            id: 'spay4_1',
            paymentNumber: 'Paiement n° 1',
            date: '2026-07-28 09:30',
            amount: 50000,
            remainingAmount: 85000,
            operator: 'Awa Cissé',
            paymentMethod: 'Espèces',
            reference: 'REC-SOL-099'
          }
        ]
      }
    ],
    avoirLines: [
      {
        id: 'sav2',
        supplierId: 's3',
        avoirNumber: 'AVF-SOL-2026-001',
        sourceRef: 'RET-SOL-012',
        date: '2026-07-27 10:15',
        reason: 'Consignes de casiers et bouteilles vides retournées',
        totalAmount: 18000,
        refundedAmount: 0,
        remainingBalance: 18000,
        status: 'Actif',
        notes: 'Avoir pour retour d\'emballages consignés.',
        refunds: []
      }
    ]
  }
];

export const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: 'm1',
    date: '2026-07-30 14:30',
    productId: 'p1',
    productName: 'Riz Parfumé 25kg (Marly)',
    type: 'Entrée',
    quantity: 20,
    reason: 'Arrivage Bon de Commande BC-2026-003',
    reference: 'BC-2026-003',
    performedBy: 'Kouassi Marc'
  },
  {
    id: 'm2',
    date: '2026-07-30 11:15',
    productId: 'p3',
    productName: 'Sucre Blanc en Morceaux 1kg',
    type: 'Sortie',
    quantity: 10,
    reason: 'Vente Comptoir POS-1042',
    reference: 'VTE-1042',
    performedBy: 'Awa Cissé'
  },
  {
    id: 'm3',
    date: '2026-07-29 09:40',
    productId: 'p5',
    productName: 'Savon de Marseille 400g (BF)',
    type: 'Périmé/Casse',
    quantity: 3,
    reason: 'Emballage endommagé lors du déchargement',
    reference: 'AJU-001',
    performedBy: 'Kouassi Marc'
  }
];

export const INITIAL_PRICE_INQUIRIES: PriceInquiry[] = [
  {
    id: 'dp1',
    code: 'DEV-202610-0001',
    date: '2026-10-02',
    buyer: 'Kouassi Marc',
    orderDeadline: '2026-10-15',
    supplierId: 's1',
    supplierName: 'SANIA Distribution',
    vatRate: 18,
    totalHT: 899000,
    totalVAT: 161820,
    totalTTC: 1060820,
    items: [
      {
        productId: 'p1',
        barcode: '6181100234512',
        productName: 'Riz Parfumé 25kg (Marly)',
        supplierId: 's1',
        supplierName: 'SANIA Distribution',
        requestedQty: 50,
        estimatedPrice: 14500,
        vatRate: 18,
        vatAmount: 130500,
        totalAmount: 855500
      },
      {
        productId: 'p2',
        barcode: '6181100234529',
        productName: 'Huile de Palme Raffinée 5L (Dinor)',
        supplierId: 's1',
        supplierName: 'SANIA Distribution',
        requestedQty: 30,
        estimatedPrice: 5800,
        vatRate: 18,
        vatAmount: 31320,
        totalAmount: 205320
      }
    ],
    status: 'En cours',
    notes: 'Demande pour réapprovisionnement de début de mois.'
  },
  {
    id: 'dp2',
    code: 'DEV-202610-0002',
    date: '2026-10-04',
    buyer: 'Aya Chantal',
    orderDeadline: '2026-10-18',
    supplierId: 's3',
    supplierName: 'SOLIBRA SA',
    vatRate: 18,
    totalHT: 88000,
    totalVAT: 15840,
    totalTTC: 103840,
    items: [
      {
        productId: 'p6',
        barcode: '6181100234567',
        productName: 'Eau Minérale Awa 1.5L (Carton 12)',
        supplierId: 's3',
        supplierName: 'SOLIBRA SA',
        requestedQty: 40,
        estimatedPrice: 2200,
        vatRate: 18,
        vatAmount: 15840,
        totalAmount: 103840
      }
    ],
    status: 'En cours',
    notes: 'Attente du devis officiel sous 24h.'
  },
  {
    id: 'dp3',
    code: 'DEV-202610-0003',
    date: '2026-10-05',
    buyer: 'Kouassi Marc',
    orderDeadline: '2026-10-20',
    supplierId: 's2',
    supplierName: 'SOCIETE IVOIRIENNE DE RAFINAGE',
    vatRate: 18,
    totalHT: 35000,
    totalVAT: 6300,
    totalTTC: 41300,
    items: [
      {
        productId: 'p5',
        barcode: '6181100234550',
        productName: 'Savon de Marseille 400g (BF)',
        supplierId: 's2',
        supplierName: 'SOCIETE IVOIRIENNE DE RAFINAGE',
        requestedQty: 100,
        estimatedPrice: 350,
        vatRate: 18,
        vatAmount: 6300,
        totalAmount: 41300
      }
    ],
    status: 'Validé',
    notes: 'Demande validée et convertie en Bon de commande BC-2026-004.'
  },
  {
    id: 'dp4',
    code: 'DEV-202610-0004',
    date: '2026-10-07',
    buyer: 'Diomandé Bakary',
    orderDeadline: '2026-10-25',
    supplierId: 's4',
    supplierName: 'BRASSIVOIRE SA',
    vatRate: 18,
    totalHT: 262500,
    totalVAT: 47250,
    totalTTC: 309750,
    items: [
      {
        productId: 'p7',
        barcode: '6181100234574',
        productName: 'Bière Ivoire Spéciale 50cl (Casier 24)',
        supplierId: 's4',
        supplierName: 'BRASSIVOIRE SA',
        requestedQty: 25,
        estimatedPrice: 10500,
        vatRate: 18,
        vatAmount: 47250,
        totalAmount: 309750
      }
    ],
    status: 'En cours',
    notes: 'Vérifier la grille tarifaire promotionnelle avant envoi.'
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'bc1',
    code: 'BC-2026-003',
    date: '2026-07-28',
    buyer: 'Kouassi Marc',
    orderDeadline: '2026-08-02',
    expectedDate: '2026-08-02',
    supplierId: 's1',
    supplierName: 'SANIA Distribution',
    totalHT: 551000,
    vatRate: 18,
    totalVAT: 99180,
    totalTTC: 650180,
    items: [
      { productId: 'p1', barcode: '6181100234512', productName: 'Riz Parfumé 25kg (Marly)', quantity: 30, unitPrice: 14500, vatRate: 18, total: 435000 },
      { productId: 'p2', barcode: '6181100234529', productName: 'Huile de Palme Raffinée 5L (Dinor)', quantity: 20, unitPrice: 5800, vatRate: 18, total: 116000 }
    ],
    totalAmount: 650180,
    status: 'Validé',
    paymentStatus: 'Payé partiellement'
  },
  {
    id: 'bc2',
    code: 'BC-2026-004',
    inquiryId: 'dp3',
    inquiryCode: 'DEV-202610-0003',
    date: '2026-07-30',
    buyer: 'Kouassi Marc',
    orderDeadline: '2026-08-05',
    expectedDate: '2026-08-05',
    supplierId: 's2',
    supplierName: 'SOCIETE IVOIRIENNE DE RAFINAGE',
    totalHT: 35000,
    vatRate: 18,
    totalVAT: 6300,
    totalTTC: 41300,
    items: [
      { productId: 'p5', barcode: '6181100234550', productName: 'Savon de Marseille 400g (BF)', quantity: 100, unitPrice: 350, vatRate: 18, total: 35000 }
    ],
    totalAmount: 41300,
    status: 'En cours',
    paymentStatus: 'Non payé'
  }
];

export const INITIAL_GOODS_RECEPTIONS: GoodsReception[] = [
  {
    id: 'rec1',
    code: 'REC-2026-008',
    date: '2026-07-28',
    purchaseOrderId: 'bc1',
    purchaseOrderCode: 'BC-2026-003',
    supplierName: 'SANIA Distribution',
    items: [
      { productId: 'p1', barcode: '6181100234512', productName: 'Riz Parfumé 25kg (Marly)', orderedQty: 30, receivedQty: 30, acceptedQty: 30, expirationDate: '2027-06-30', unitPrice: 14500 },
      { productId: 'p2', barcode: '6181100234529', productName: 'Huile de Palme Raffinée 5L (Dinor)', orderedQty: 20, receivedQty: 20, acceptedQty: 20, expirationDate: '2026-10-25', unitPrice: 5800 }
    ],
    receiverName: 'Kouassi Marc',
    status: 'Validé',
    notes: 'Livraison conforme sans casse. Attention lot Huile proche péremption.'
  },
  {
    id: 'rec2',
    code: 'REC-2026-009',
    date: '2026-08-01',
    purchaseOrderId: 'bc2',
    purchaseOrderCode: 'BC-2026-004',
    supplierName: 'SOCIETE IVOIRIENNE DE RAFINAGE',
    items: [
      { productId: 'p5', barcode: '6181100234550', productName: 'Savon de Marseille 400g (BF)', orderedQty: 50, receivedQty: 50, acceptedQty: 50, expirationDate: '2026-10-04', unitPrice: 350 }
    ],
    receiverName: 'Kouassi Marc',
    status: 'Validé',
    notes: 'Lot à contrôler : date d\'expiration dépassée.'
  },
  {
    id: 'rec3',
    code: 'REC-2026-010',
    date: '2026-08-05',
    supplierName: 'COFRAP Distribution',
    items: [
      { productId: 'p3', barcode: '6181100234536', productName: 'Sucre Blanc en Morceaux 1kg', orderedQty: 100, receivedQty: 100, acceptedQty: 100, expirationDate: '2027-12-31', unitPrice: 850 }
    ],
    receiverName: 'Kouassi Marc',
    status: 'En cours',
    notes: 'En cours de pointage magasin.'
  }
];

export const INITIAL_SALE_ORDERS: SaleOrder[] = [
  {
    id: 'vte1',
    code: 'VTE-2026-098',
    date: '2026-07-30 15:20',
    clientId: 'c1',
    clientName: 'Boulangerie du Marché',
    items: [
      { productId: 'p7', productName: 'Farine de Blé Panifiable 50kg', quantity: 2, unitPrice: 24500, total: 49000 },
      { productId: 'p3', productName: 'Sucre Blanc en Morceaux 1kg', quantity: 5, unitPrice: 1000, total: 5000 }
    ],
    totalAmount: 54000,
    discount: 0,
    tax: 0,
    finalAmount: 54000,
    paymentMethod: 'Crédit',
    status: 'Terminé',
    sellerName: 'Awa Cissé',
    pointDeVenteId: 'pv1',
    pointDeVenteCode: 'PV0001'
  },
  {
    id: 'vte2',
    code: 'VTE-2026-099',
    date: '2026-07-31 09:10',
    clientName: 'Client Comptoir',
    items: [
      { productId: 'p1', productName: 'Riz Parfumé 25kg (Marly)', quantity: 1, unitPrice: 17500, total: 17500 },
      { productId: 'p6', productName: 'Eau Minérale Awa 1.5L (Carton 12)', quantity: 1, unitPrice: 3000, total: 3000 }
    ],
    totalAmount: 20500,
    discount: 500,
    tax: 0,
    finalAmount: 20000,
    paymentMethod: 'Mobile Money',
    status: 'Terminé',
    sellerName: 'Moussa Koné',
    pointDeVenteId: 'pv2',
    pointDeVenteCode: 'PV0002'
  }
];

export const INITIAL_POINTS_DE_VENTE: PointDeVente[] = [
  {
    id: 'pv1',
    code: 'PV0001',
    date: '2026-07-30',
    operator: 'Awa Cissé',
    openingAmount: 50000,
    closingAmount: 104000,
    openedAt: '2026-07-30 08:00:00',
    closedAt: '2026-07-30 18:30:00',
    status: 'Fermé',
    sales: [INITIAL_SALE_ORDERS[0]],
    totalSalesAmount: 54000,
    cashSalesAmount: 0,
    creditSalesAmount: 54000,
    mobileSalesAmount: 0,
    cardSalesAmount: 0,
    expectedClosingAmount: 50000,
    cashDifference: 0,
    notes: 'Clôture de journée effectuée avec succès.'
  },
  {
    id: 'pv2',
    code: 'PV0002',
    date: '2026-07-31',
    operator: 'Moussa Koné',
    openingAmount: 50000,
    closingAmount: undefined,
    openedAt: '2026-07-31 08:30:00',
    closedAt: undefined,
    status: 'En cours',
    sales: [INITIAL_SALE_ORDERS[1]],
    totalSalesAmount: 20000,
    cashSalesAmount: 0,
    creditSalesAmount: 0,
    mobileSalesAmount: 20000,
    cardSalesAmount: 0,
    expectedClosingAmount: 50000,
    cashDifference: undefined,
    notes: 'Session de caisse active au comptoir principal.'
  }
];

export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx1',
    code: 'REC-2026-001',
    date: '2026-07-28',
    type: 'Recette',
    category: 'Vente marchandises',
    amount: 250000,
    paymentMethod: 'Espèces',
    account: 'Caisse Principale',
    reference: 'FAC-2026-0044',
    thirdParty: 'Client Comptoir',
    notes: 'Recettes ventes comptoir journée',
    status: 'Validé',
    recordedBy: 'Awa Cissé'
  },
  {
    id: 'tx2',
    code: 'DEP-2026-001',
    date: '2026-07-29',
    type: 'Dépense',
    category: 'Loyer & Charges',
    amount: 180000,
    paymentMethod: 'Virement bancaire',
    account: 'Banque BICICI',
    reference: 'VIR-LOY-07',
    thirdParty: 'SCI Abidjan Immobilier',
    notes: 'Loyer mensuel local commercial & magasin',
    status: 'Validé',
    recordedBy: 'Awa Cissé'
  },
  {
    id: 'tx3',
    code: 'REC-2026-002',
    date: '2026-07-30',
    type: 'Recette',
    category: 'Vente marchandises',
    amount: 120000,
    paymentMethod: 'Mobile Money',
    account: 'Compte Mobile Money',
    reference: 'OM-2026-9812',
    thirdParty: 'Mme Koné Aminata',
    notes: 'Règlement facture par Orange Money',
    status: 'Validé',
    recordedBy: 'Kouassi Marc'
  },
  {
    id: 'tx4',
    code: 'DEP-2026-002',
    date: '2026-07-30',
    type: 'Dépense',
    category: 'Factures & Énergie',
    amount: 45000,
    paymentMethod: 'Mobile Money',
    account: 'Compte Mobile Money',
    reference: 'CIE-2026-07',
    thirdParty: 'CIE Côte d Ivoire',
    notes: 'Facture électricité magasin principal',
    status: 'Validé',
    recordedBy: 'Awa Cissé'
  },
  {
    id: 'tx5',
    code: 'DEP-2026-003',
    date: '2026-07-31',
    type: 'Dépense',
    category: 'Salaires & Primes',
    amount: 350000,
    paymentMethod: 'Virement bancaire',
    account: 'Banque BICICI',
    reference: 'SAL-07-2026',
    thirdParty: 'Personnel GeStock',
    notes: 'Paiement des salaires du personnel du mois',
    status: 'Validé',
    recordedBy: 'Awa Cissé'
  },
  {
    id: 'tx6',
    code: 'DEP-2026-004',
    date: '2026-07-31',
    type: 'Dépense',
    category: 'Transport & Carburant',
    amount: 25000,
    paymentMethod: 'Espèces',
    account: 'Caisse Principale',
    reference: 'TICK-TOT-088',
    thirdParty: 'Station Total Marcory',
    notes: 'Plein carburant véhicule utilitaire approvisionnement',
    status: 'Validé',
    recordedBy: 'Kouassi Marc'
  },
  {
    id: 'tx7',
    code: 'REC-2026-003',
    date: '2026-08-01',
    type: 'Recette',
    category: 'Recouvrement créance',
    amount: 75000,
    paymentMethod: 'Chèque',
    account: 'Banque BICICI',
    reference: 'CHQ-889120',
    thirdParty: 'Restaurant La Grillade',
    notes: 'Acompte sur facture crédit client',
    status: 'Validé',
    recordedBy: 'Awa Cissé'
  },
  {
    id: 'tx8',
    code: 'DEP-2026-005',
    date: '2026-08-01',
    type: 'Dépense',
    category: 'Entretien & Maintenance',
    amount: 15000,
    paymentMethod: 'Espèces',
    account: 'Caisse Principale',
    reference: 'DEP-REP-12',
    thirdParty: 'Artisan Frigo SARL',
    notes: 'Entretien groupe froid et climatiseur caisse',
    status: 'Validé',
    recordedBy: 'Kouassi Marc'
  }
];

export const INITIAL_TREASURY_ACCOUNTS: TreasuryAccount[] = [
  {
    id: 'acc1',
    name: 'Caisse Principale',
    type: 'Caisse',
    accountNumber: 'CAISSE-01',
    balance: 850000,
    currency: 'FCFA',
    lastUpdated: '2026-08-01 10:00',
    description: 'Coffre-fort et espèces magasin central'
  },
  {
    id: 'acc2',
    name: 'Banque BICICI',
    type: 'Banque',
    accountNumber: 'CI092 01001 02345678901 22',
    balance: 3450000,
    currency: 'FCFA',
    lastUpdated: '2026-08-01 08:30',
    description: 'Compte courant commercial entreprise'
  },
  {
    id: 'acc3',
    name: 'Compte Mobile Money',
    type: 'Mobile Money',
    accountNumber: '+225 07 00 11 22 33',
    balance: 580000,
    currency: 'FCFA',
    lastUpdated: '2026-08-01 09:15',
    description: 'Comptes marchands Orange Money & Wave'
  },
  {
    id: 'acc4',
    name: 'Caisse Point de Vente (POS)',
    type: 'Caisse',
    accountNumber: 'POS-PV0002',
    balance: 50000,
    currency: 'FCFA',
    lastUpdated: '2026-07-31 08:30',
    description: 'Fond de roulement actif au comptoir de vente'
  }
];

export const INITIAL_TREASURY_MOVEMENTS: TreasuryMovement[] = [
  {
    id: 'tm1',
    code: 'TR-2026-001',
    date: '2026-07-28 09:00',
    type: 'Alimentation',
    fromAccount: 'Banque BICICI',
    toAccount: 'Caisse Principale',
    amount: 200000,
    reason: 'Retrait espèces pour fond de roulement',
    reference: 'RET-CHQ-1102',
    performedBy: 'Awa Cissé'
  },
  {
    id: 'tm2',
    code: 'TR-2026-002',
    date: '2026-07-31 08:25',
    type: 'Virement interne',
    fromAccount: 'Caisse Principale',
    toAccount: 'Caisse Point de Vente (POS)',
    amount: 50000,
    reason: 'Dotation fond de caisse ouverture session PV0002',
    reference: 'FDC-PV0002',
    performedBy: 'Kouassi Marc'
  },
  {
    id: 'tm3',
    code: 'TR-2026-003',
    date: '2026-07-31 19:00',
    type: 'Remise en banque',
    fromAccount: 'Caisse Principale',
    toAccount: 'Banque BICICI',
    amount: 300000,
    reason: 'Versement recettes hebdomadaires espèces',
    reference: 'BORD-VERS-889',
    performedBy: 'Awa Cissé'
  },
  {
    id: 'tm4',
    code: 'TR-2026-004',
    date: '2026-08-01 11:30',
    type: 'Virement interne',
    fromAccount: 'Compte Mobile Money',
    toAccount: 'Banque BICICI',
    amount: 150000,
    reason: 'Rapatriement solde marchand vers compte bancaire',
    reference: 'TRF-WAVE-0801',
    performedBy: 'Awa Cissé'
  }
];

export const INITIAL_APPROVISIONNEMENTS: ApprovisionnementRecord[] = [
  {
    id: 'app1',
    reference: 'APP-2026-001',
    date: '2026-07-28 14:30',
    operator: 'Kouassi Marc',
    receptionNumber: 'REC-2026-008',
    receptionId: 'rec1',
    supplierName: 'SANIA Distribution',
    destinationType: 'Magasin',
    targetLocation: 'Magasin Central - Zone Palettes Riz & Huiles',
    items: [
      {
        productId: 'p1',
        productCode: 'PRD-001',
        productName: 'Riz Parfumé 25kg (Marly)',
        barcode: '6181100234512',
        quantity: 30,
        unitPrice: 14500,
        unit: 'sac',
        targetLocation: 'Magasin Central - Allée 1',
        expirationDate: '2027-06-30'
      },
      {
        productId: 'p2',
        productCode: 'PRD-002',
        productName: 'Huile de Palme Raffinée 5L (Dinor)',
        barcode: '6181100234529',
        quantity: 20,
        unitPrice: 5800,
        unit: 'bidon',
        targetLocation: 'Rayon Huiles & Condiments',
        expirationDate: '2026-10-25'
      }
    ],
    totalItemsCount: 2,
    totalQuantity: 50,
    totalValue: 551000,
    status: 'Validé',
    notes: 'Mise en stock effectuée sans anomalie suite au déchargement de la réception REC-2026-008',
    createdAt: '2026-07-28T14:30:00Z'
  },
  {
    id: 'app2',
    reference: 'APP-2026-002',
    date: '2026-08-01 11:15',
    operator: 'Kouassi Marc',
    receptionNumber: 'REC-2026-009',
    receptionId: 'rec2',
    supplierName: 'SOCIETE IVOIRIENNE DE RAFINAGE',
    destinationType: 'Rayon',
    targetLocation: 'Rayon Hygiène & Entretien',
    items: [
      {
        productId: 'p5',
        productCode: 'PRD-005',
        productName: 'Savon de Marseille 400g (BF)',
        barcode: '6181100234550',
        quantity: 50,
        unitPrice: 350,
        unit: 'morceau',
        targetLocation: 'Rayon Hygiène - Tête de gondole',
        expirationDate: '2026-10-04'
      }
    ],
    totalItemsCount: 1,
    totalQuantity: 50,
    totalValue: 17500,
    status: 'Validé',
    notes: 'Mise en rayon immédiate pour vente libre',
    createdAt: '2026-08-01T11:15:00Z'
  }
];

export const INITIAL_STORAGE_SITES: StorageSite[] = [
  {
    id: 'site-mag-central',
    name: 'Magasin Central',
    type: 'Magasin',
    capacity: 10000,
    location: 'Dépôt principal - Zone industrielle',
    description: 'Entrepôt principal de réception des marchandises',
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'site-mag-reserve',
    name: 'Réserve Générale',
    type: 'Magasin',
    capacity: 4000,
    location: 'Annexe magasin - Cour arrière',
    description: 'Stock tampon et réserve de sécurité',
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'site-ray-epicerie',
    name: 'Rayon Épicerie Sèche',
    type: 'Rayon',
    shelfCount: 12,
    magasinId: 'site-mag-central',
    location: 'Surface de vente - Allée A',
    description: 'Étagères produits secs et conserves',
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'site-ray-boissons',
    name: 'Rayon Boissons & Eaux',
    type: 'Rayon',
    shelfCount: 8,
    magasinId: 'site-mag-central',
    location: 'Surface de vente - Allée B',
    description: 'Boissons, eaux et jus',
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'site-ray-hygiene',
    name: 'Rayon Hygiène & Entretien',
    type: 'Rayon',
    shelfCount: 6,
    location: 'Surface de vente - Allée C',
    description: 'Produits d\'hygiène et d\'entretien',
    createdAt: '2026-01-15T08:00:00Z'
  }
];

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(amount).replace('XOF', 'FCFA');
}
