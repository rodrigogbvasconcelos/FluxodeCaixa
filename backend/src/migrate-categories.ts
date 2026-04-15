/**
 * Migration script to add hierarchical categories for construction expenses and revenues
 * Run with: npx tsx src/migrate-categories.ts
 */
import db, { initDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

initDatabase();

// Check if we already have hierarchical categories
const existingHierarchical = db.prepare('SELECT COUNT(*) as c FROM categories WHERE parent_id IS NOT NULL').get() as any;
if (existingHierarchical.c > 0) {
  console.log('Hierarchical categories already exist. Skipping migration.');
  process.exit(0);
}

// Get existing default categories to avoid duplicates
const existingCats = db.prepare('SELECT id, name, type FROM categories').all() as any[];
const getExistingCat = (name: string, type: string) => existingCats.find(c => c.name === name && c.type === type)?.id;

// Define the hierarchical structure
const expenseCategories = [
  {
    name: '001 – Projetos',
    type: 'expense',
    color: '#06B6D4',
    icon: 'file-text',
    subitems: [
      { code: '0001', name: 'Arquitetura' },
      { code: '0002', name: 'Maquete' },
      { code: '0003', name: 'Paisagismo' },
      { code: '0004', name: 'Desenho Decorativo' },
      { code: '0005', name: 'Instalações' },
      { code: '0006', name: 'Cálculo Estrutural' },
      { code: '0007', name: 'Exaustão Mecânica' },
      { code: '0008', name: 'Ar Condicionado' },
      { code: '0009', name: 'Acústica' },
      { code: '0010', name: 'Prevenção a Incêndio' },
      { code: '0011', name: 'Piscina' },
    ]
  },
  {
    name: '002 – Análise de Solos',
    type: 'expense',
    color: '#8B5CF6',
    icon: 'search',
    subitems: [
      { code: '0001', name: 'Sondagem' },
      { code: '0002', name: 'Serviços Topográficos' },
      { code: '0003', name: 'Serviços Aerofotogramétricos' },
      { code: '0004', name: 'Aspectos Geológicos' },
    ]
  },
  {
    name: '003 – Análises de Custos',
    type: 'expense',
    color: '#EC4899',
    icon: 'calculator',
    subitems: [
      { code: '0001', name: 'Orçamento' },
      { code: '0002', name: 'NBR 12721' },
      { code: '0003', name: 'Cronograma Físico-Financeiro' },
      { code: '0004', name: 'Documentação para Financiamentos' },
      { code: '0005', name: 'Assessoria e Acompanhamento de Custos' },
      { code: '0006', name: 'Avaliações' },
      { code: '0007', name: 'Consultoria e Gerenciamento' },
    ]
  },
  {
    name: '004 - Cópias e Reproduções',
    type: 'expense',
    color: '#64748B',
    icon: 'copy',
    subitems: [
      { code: '0001', name: 'Cópias Heliográficas' },
      { code: '0002', name: 'Xerox' },
      { code: '0003', name: 'Vegetal Copiativa' },
      { code: '0004', name: 'Plotagem e Digitalização' },
    ]
  },
  {
    name: '005 – Instalações Provisórias da Obra',
    type: 'expense',
    color: '#F59E0B',
    icon: 'settings',
    subitems: [
      { code: '0001', name: 'Barracão' },
      { code: '0002', name: 'Tapume' },
      { code: '0003', name: 'Banheiros Provisórios' },
      { code: '0004', name: 'Cantinas' },
      { code: '0005', name: 'PC Provisório' },
      { code: '0006', name: 'Caixa-D\'água Provisória' },
      { code: '0007', name: 'Materiais de Segurança' },
      { code: '0008', name: 'Placas de Obra' },
      { code: '0009', name: 'Demolição' },
      { code: '0010', name: 'Locação de Obra' },
      { code: '0011', name: 'Estande de Vendas' },
    ]
  },
  {
    name: '006 - Equipamentos e Ferramentas',
    type: 'expense',
    color: '#EAB308',
    icon: 'wrench',
    subitems: [
      { code: '0001', name: 'Equipamentos' },
      { code: '0002', name: 'Ferramentas' },
    ]
  },
  {
    name: '007 - Transportes e Carretos',
    type: 'expense',
    color: '#8B5CF6',
    icon: 'truck',
    subitems: [
      { code: '0001', name: 'Transportes' },
      { code: '0002', name: 'Entulhos' },
    ]
  },
  {
    name: '008 - Impostos e Taxas',
    type: 'expense',
    color: '#DC2626',
    icon: 'file-x',
    subitems: [
      { code: '0001', name: 'Licenças' },
      { code: '0002', name: 'Taxas' },
      { code: '0003', name: 'Registros' },
      { code: '0004', name: 'Seguros' },
      { code: '0005', name: 'Impostos' },
      { code: '0006', name: 'Multas' },
      { code: '0007', name: 'Certidões' },
    ]
  },
  {
    name: '009 – Escritório da Obra',
    type: 'expense',
    color: '#EC4899',
    icon: 'building',
    subitems: [
      { code: '0001', name: 'Manutenções' },
      { code: '0002', name: 'Medicamentos' },
      { code: '0003', name: 'Conduções' },
      { code: '0004', name: 'Telefonemas' },
      { code: '0005', name: 'Limpeza' },
      { code: '0006', name: 'Pagamentos' },
      { code: '0007', name: 'Vigilância' },
    ]
  },
  {
    name: '010 - Administração',
    type: 'expense',
    color: '#6B7280',
    icon: 'briefcase',
    subitems: [
      { code: '0001', name: 'Administração da Construtora' },
      { code: '0002', name: 'Impostos de Serviços da Construtora' },
    ]
  },
  {
    name: '011 - Diversos',
    type: 'expense',
    color: '#64748B',
    icon: 'more-horizontal',
    subitems: [
      { code: '0001', name: 'Proteção de Transeuntes' },
      { code: '0002', name: 'Reparo dos Vizinhos' },
      { code: '0003', name: 'Diversos' },
    ]
  },
  {
    name: '012 - Trabalhos em Terra',
    type: 'expense',
    color: '#F97316',
    icon: 'shovel',
    subitems: [
      { code: '0001', name: 'Escavação' },
      { code: '0002', name: 'Muros' },
      { code: '0003', name: 'Escoramentos' },
      { code: '0004', name: 'Cortes' },
      { code: '0005', name: 'Aterros' },
      { code: '0006', name: 'Rebaixamento do Lençol Freático' },
      { code: '0007', name: 'Retirada de Terra e Materiais' },
    ]
  },
  {
    name: '013 – Fundações',
    type: 'expense',
    color: '#EF4444',
    icon: 'foundation',
    subitems: [
      { code: '0001', name: 'Ferro' },
      { code: '0002', name: 'Madeira' },
      { code: '0003', name: 'Concreto Pré-Misturado' },
      { code: '0004', name: 'Estacas Metálicas' },
      { code: '0005', name: 'Estacas Pré-Moldadas' },
      { code: '0006', name: 'Materiais Auxiliares' },
      { code: '0007', name: 'Controle Tecnológico' },
    ]
  },
  {
    name: '014 – Estruturas',
    type: 'expense',
    color: '#F97316',
    icon: 'building-2',
    subitems: [
      { code: '0001', name: 'Ferro' },
      { code: '0002', name: 'Madeira' },
      { code: '0003', name: 'Escoras Metálicas' },
      { code: '0004', name: 'Concreto Pré-Misturado' },
      { code: '0005', name: 'Materiais Auxiliares' },
      { code: '0006', name: 'Controle Tecnológico' },
      { code: '0007', name: 'Protensão' },
      { code: '0008', name: 'Formas de Isopor' },
    ]
  },
  {
    name: '015 – Instalações',
    type: 'expense',
    color: '#06B6D4',
    icon: 'zap',
    subitems: [
      { code: '0001', name: 'Instalações Hidráulicas' },
      { code: '0002', name: 'Instalações Elétricas' },
      { code: '0003', name: 'Instalações de Esgotos' },
      { code: '0004', name: 'Instalações de Gás' },
      { code: '0005', name: 'Pára-Raios' },
      { code: '0006', name: 'Antena Coletiva' },
      { code: '0007', name: 'Instalações Contra Incêndio' },
      { code: '0008', name: 'Compactador' },
      { code: '0009', name: 'Elevadores' },
      { code: '0010', name: 'Escada Rolante' },
      { code: '0011', name: 'Exaustão Mecânica' },
      { code: '0012', name: 'Ar Condicionado' },
      { code: '0013', name: 'Subempreitada' },
      { code: '0014', name: 'Instalações de Infra-Estrutura' },
      { code: '0015', name: 'Drenagem' },
    ]
  },
  {
    name: '016 – Alvenarias',
    type: 'expense',
    color: '#84CC16',
    icon: 'wall',
    subitems: [
      { code: '0001', name: 'Barro' },
      { code: '0002', name: 'Concreto' },
      { code: '0003', name: 'Placas Pré-Moldadas' },
      { code: '0004', name: 'Diversos' },
      { code: '0005', name: 'Painéis de Gesso Cartonado' },
      { code: '0006', name: 'Painéis de Isopor com Gradeamento Galvanizado' },
    ]
  },
  {
    name: '017 – Coberturas',
    type: 'expense',
    color: '#10B981',
    icon: 'home',
    subitems: [
      { code: '0001', name: 'Madeiramento' },
      { code: '0002', name: 'Telhamento' },
      { code: '0003', name: 'Subempreitada' },
    ]
  },
  {
    name: '018 – Tratamentos',
    type: 'expense',
    color: '#3B82F6',
    icon: 'shield',
    subitems: [
      { code: '0001', name: 'Impermeabilizantes' },
      { code: '0002', name: 'Proteção Térmica' },
      { code: '0003', name: 'Proteção Acústica' },
      { code: '0004', name: 'Juntas de Dilatação' },
      { code: '0005', name: 'Subempreitada' },
    ]
  },
  {
    name: '019 – Esquadrias',
    type: 'expense',
    color: '#6366F1',
    icon: 'window',
    subitems: [
      { code: '0001', name: 'Madeira' },
      { code: '0002', name: 'Ferro' },
      { code: '0003', name: 'Alumínio' },
      { code: '0004', name: 'P.V.C.' },
    ]
  },
  {
    name: '020 – Revestimento',
    type: 'expense',
    color: '#14B8A6',
    icon: 'paintbrush',
    subitems: [
      { code: '0001', name: 'Aditivos' },
      { code: '0002', name: 'Pastilhas' },
      { code: '0003', name: 'Andaimes' },
      { code: '0004', name: 'Lambris' },
      { code: '0005', name: 'Azulejos' },
      { code: '0006', name: 'Cerâmicas' },
      { code: '0007', name: 'Mármore' },
      { code: '0008', name: 'Granito' },
      { code: '0009', name: 'Gesso' },
      { code: '0010', name: 'Pedras' },
      { code: '0011', name: 'Fórmica' },
      { code: '0012', name: 'Papel de Parede' },
    ]
  },
  {
    name: '021 – Pavimentações',
    type: 'expense',
    color: '#F59E0B',
    icon: 'grid',
    subitems: [
      { code: '0001', name: 'Cimentado' },
      { code: '0002', name: 'Enchimentos' },
      { code: '0003', name: 'Tacos' },
      { code: '0004', name: 'Frisos' },
      { code: '0005', name: 'Cerâmica' },
      { code: '0006', name: 'Asfaltos' },
      { code: '0007', name: 'Mármore' },
      { code: '0008', name: 'Granito' },
      { code: '0009', name: 'Pedras' },
      { code: '0010', name: 'Carpete' },
      { code: '0011', name: 'Deck de Madeira' },
      { code: '0012', name: 'Marmorite' },
      { code: '0013', name: 'Pedra Portuguesa' },
      { code: '0014', name: 'Elementos Pré-Moldados' },
    ]
  },
  {
    name: '022 – Rodapés',
    type: 'expense',
    color: '#EC4899',
    icon: 'minus',
    subitems: [
      { code: '0001', name: 'Mármore' },
      { code: '0002', name: 'Granito' },
      { code: '0003', name: 'Madeira' },
      { code: '0004', name: 'Cerâmica' },
      { code: '0005', name: 'Cimentado' },
    ]
  },
  {
    name: '023 – Soleiras',
    type: 'expense',
    color: '#8B5CF6',
    icon: 'door-open',
    subitems: [
      { code: '0001', name: 'Mármore' },
      { code: '0002', name: 'Granito' },
      { code: '0003', name: 'Madeira' },
      { code: '0004', name: 'Cerâmica' },
      { code: '0005', name: 'Cimentado' },
      { code: '0006', name: 'Alumínio' },
    ]
  },
  {
    name: '024 – Peitoris',
    type: 'expense',
    color: '#06B6D4',
    icon: 'window',
    subitems: [
      { code: '0001', name: 'Mármore' },
      { code: '0002', name: 'Granito' },
      { code: '0003', name: 'Madeira' },
      { code: '0004', name: 'Alumínio' },
      { code: '0005', name: 'Cimentado' },
    ]
  },
  {
    name: '025 – Ferragens para Esquadrias',
    type: 'expense',
    color: '#EF4444',
    icon: 'lock',
    subitems: [
      { code: '0001', name: 'Material' },
      { code: '0002', name: 'Subempreitada' },
    ]
  },
  {
    name: '026 – Pinturas',
    type: 'expense',
    color: '#84CC16',
    icon: 'paintbrush',
    subitems: [
      { code: '0001', name: 'Material' },
      { code: '0002', name: 'Subempreitada' },
    ]
  },
  {
    name: '027 – Vidros',
    type: 'expense',
    color: '#3B82F6',
    icon: 'eye',
    subitems: [
      { code: '0001', name: 'Liso' },
      { code: '0002', name: 'Laminado' },
      { code: '0003', name: 'Temperado' },
    ]
  },
  {
    name: '028 – Aparelhos Sanitários',
    type: 'expense',
    color: '#10B981',
    icon: 'droplet',
    subitems: [
      { code: '0001', name: 'Louças' },
      { code: '0002', name: 'Metais' },
    ]
  },
  {
    name: '029 – Ligações',
    type: 'expense',
    color: '#6366F1',
    icon: 'plug',
    subitems: [
      { code: '0001', name: 'Provisórias' },
      { code: '0002', name: 'Definitivas' },
    ]
  },
  {
    name: '030 – Utensílios Complementares',
    type: 'expense',
    color: '#14B8A6',
    icon: 'settings',
    subitems: [
      { code: '0001', name: 'Ajardinamento' },
      { code: '0002', name: 'Interfone' },
      { code: '0003', name: 'Aparelho de Iluminação' },
      { code: '0004', name: 'Sauna' },
      { code: '0005', name: 'Piscina' },
      { code: '0006', name: 'Play-Ground' },
    ]
  },
  {
    name: '031 – Limpeza Final',
    type: 'expense',
    color: '#F59E0B',
    icon: 'broom',
    subitems: [
      { code: '0001', name: 'Material' },
      { code: '0002', name: 'Subempreitada' },
    ]
  },
];

const incomeCategories = [
  {
    name: '001 - Venda',
    type: 'income',
    color: '#10B981',
    icon: 'shopping-cart',
    subitems: [
      { code: '0001', name: 'Casa' },
      { code: '0002', name: 'Apartamento' },
      { code: '0003', name: 'Terreno' },
      { code: '0004', name: 'Equipamento' },
      { code: '0005', name: 'Automóvel' },
    ]
  },
  {
    name: '002 - Aplicação',
    type: 'income',
    color: '#3B82F6',
    icon: 'trending-up',
    subitems: []
  },
  {
    name: '003 - Restituição',
    type: 'income',
    color: '#6366F1',
    icon: 'refresh-cw',
    subitems: []
  },
  {
    name: '004 - Aporte Capital',
    type: 'income',
    color: '#14B8A6',
    icon: 'dollar-sign',
    subitems: []
  },
];

// Insert parent categories and their subitems
const insertCategory = db.prepare('INSERT INTO categories (id, name, type, color, icon, parent_id, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)');

for (const category of [...expenseCategories, ...incomeCategories]) {
  // Check if parent category already exists
  let parentId = getExistingCat(category.name, category.type);
  if (!parentId) {
    parentId = uuidv4();
    insertCategory.run(parentId, category.name, category.type, category.color, category.icon, null);
    console.log(`Created parent category: ${category.name}`);
  }

  // Insert subitems
  for (const subitem of category.subitems) {
    const subName = `${subitem.code} ${subitem.name}`;
    const existingSub = db.prepare('SELECT id FROM categories WHERE name = ? AND parent_id = ?').get(subName, parentId) as any;
    if (!existingSub) {
      const subId = uuidv4();
      insertCategory.run(subId, subName, category.type, category.color, 'tag', parentId);
      console.log(`Created subitem: ${subName}`);
    }
  }
}

console.log('Migration completed successfully!');