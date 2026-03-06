// Типы номенклатуры

export type ItemType = "material" | "blank" | "product";

export const itemTypeLabels: Record<ItemType, string> = {
  material: "Сырьё",
  blank: "Заготовка",
  product: "Изделие",
};

export type Unit = "kg" | "pcs" | "m";

export const unitLabels: Record<Unit, string> = {
  kg: "кг",
  pcs: "шт",
  m: "м",
};

export interface NomenclatureItem {
  id: string;
  name: string;
  type: ItemType;
  unit: Unit;
  category?: string;
  description?: string;
  images?: string[];
  pricePerUnit?: number;
}

export interface BomEntry {
  parentId: string;
  childId: string;
  quantity: number; // сколько единиц child нужно на 1 единицу parent
}

export interface StockMovement {
  id: string;
  type: "SUPPLIER_INCOME" | "PRODUCTION_INCOME" | "ASSEMBLY_WRITE_OFF" | "ASSEMBLY_INCOME" | "ADJUSTMENT_INCOME" | "ADJUSTMENT_WRITE_OFF";
  itemId: string;
  quantity: number;
  date: string;
  workerId?: string;
  comment?: string;
}

// Категории для группировки
export const categories = [
  { id: "body", name: "Кузовные элементы" },
  { id: "suspension", name: "Элементы подвески" },
  { id: "brakes", name: "Тормозная система" },
  { id: "brackets", name: "Кронштейны и крепёж" },
  { id: "shields", name: "Защитные кожухи" },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const img = (name: string) => `${basePath}/images/catalog/${name}`;

// ============================================================
// СЫРЬЁ
// ============================================================
const materials: NomenclatureItem[] = [
  {
    id: "raw-08ps-2.0",
    name: "Рулон 08пс 2.0мм, ш.1250мм",
    type: "material",
    unit: "kg",
    description: "Сталь холоднокатаная 08пс, толщина 2.0мм, ширина рулона 1250мм. ГОСТ 16523-97. Для штамповки кузовных деталей с высокими требованиями к прочности.",
  },
  {
    id: "raw-08kp-1.5",
    name: "Рулон 08кп 1.5мм, ш.1000мм",
    type: "material",
    unit: "kg",
    description: "Сталь холоднокатаная 08кп, толщина 1.5мм, ширина рулона 1000мм. ГОСТ 16523-97. Для штамповки поперечин, балок, швеллерных профилей.",
  },
  {
    id: "raw-08ps-1.2",
    name: "Рулон 08пс 1.2мм, ш.1000мм",
    type: "material",
    unit: "kg",
    description: "Сталь холоднокатаная 08пс, толщина 1.2мм, ширина рулона 1000мм. ГОСТ 16523-97. Для штамповки панелей, арок, кожухов.",
  },
  {
    id: "raw-08kp-1.0",
    name: "Рулон 08кп 1.0мм, ш.1250мм",
    type: "material",
    unit: "kg",
    description: "Сталь холоднокатаная 08кп, толщина 1.0мм, ширина рулона 1250мм. ГОСТ 16523-97. Для тонколистовой штамповки: щиты, кожухи, экраны.",
  },
  {
    id: "raw-09g2s-3.0",
    name: "Лист 09Г2С 3.0мм, 1500x6000мм",
    type: "material",
    unit: "kg",
    description: "Сталь конструкционная низколегированная 09Г2С, толщина 3.0мм. ГОСТ 19281-2014. Повышенная прочность, для кронштейнов и опорных деталей.",
  },
  {
    id: "raw-09g2s-4.0",
    name: "Лист 09Г2С 4.0мм, 1500x6000мм",
    type: "material",
    unit: "kg",
    description: "Сталь конструкционная низколегированная 09Г2С, толщина 4.0мм. ГОСТ 19281-2014. Для силовых кронштейнов, опор двигателя.",
  },
  {
    id: "raw-09g2s-5.0",
    name: "Лист 09Г2С 5.0мм, 1500x6000мм",
    type: "material",
    unit: "kg",
    description: "Сталь конструкционная низколегированная 09Г2С, толщина 5.0мм. ГОСТ 19281-2014. Для тяжелонагруженных кронштейнов суппорта.",
  },
  {
    id: "raw-65g-0.5",
    name: "Лента 65Г 0.5мм, ш.200мм",
    type: "material",
    unit: "kg",
    description: "Сталь пружинная 65Г, толщина 0.5мм, ширина 200мм. ГОСТ 2283-79. Для противоскрипных пластин, фиксаторов, пружинных скоб.",
  },
  {
    id: "raw-amg2-0.8",
    name: "Лист АМг2 0.8мм, 1200x3000мм",
    type: "material",
    unit: "kg",
    description: "Алюминий АМг2, толщина 0.8мм. ГОСТ 21631-76. Для теплозащитных экранов с перфорацией.",
  },
  {
    id: "raw-12x18-2.0",
    name: "Рулон 12Х18Н10Т 2.0мм, ш.1000мм",
    type: "material",
    unit: "kg",
    description: "Нержавеющая сталь 12Х18Н10Т, толщина 2.0мм. ГОСТ 5582-75. Для хомутов и деталей выхлопной системы, стойких к коррозии и нагреву.",
  },
  {
    id: "raw-oцинк-1.0",
    name: "Рулон оцинкованный 1.0мм, ш.1200мм",
    type: "material",
    unit: "kg",
    description: "Сталь тонколистовая оцинкованная, толщина 1.0мм. ГОСТ 14918-80. Для мелких скоб, лепестков, прокладок.",
  },
  {
    id: "raw-rivets-4.8",
    name: "Заклёпки вытяжные 4.8x12мм",
    type: "material",
    unit: "pcs",
    description: "Заклёпки вытяжные алюминий/сталь, D4.8мм, L12мм. DIN 7337. Для соединения тонколистовых деталей.",
  },
  {
    id: "raw-bolts-m8",
    name: "Болты М8x20 оцинк.",
    type: "material",
    unit: "pcs",
    description: "Болт с шестигранной головкой М8x20, оцинковка. ГОСТ 7798-70. Для крепления кронштейнов, кожухов.",
  },
  {
    id: "raw-nuts-m8",
    name: "Гайки М8 оцинк.",
    type: "material",
    unit: "pcs",
    description: "Гайка шестигранная М8, оцинковка. ГОСТ 5915-70.",
  },
  {
    id: "raw-washers-m8",
    name: "Шайбы плоские М8 оцинк.",
    type: "material",
    unit: "pcs",
    description: "Шайба плоская М8, оцинковка. ГОСТ 11371-78.",
  },
];

// ============================================================
// ЗАГОТОВКИ (вырубленные/отрезанные из листа)
// ============================================================
const blanks: NomenclatureItem[] = [
  // Кузовные
  {
    id: "blank-450x120-08ps-2",
    name: "Заготовка 450x120мм, 08пс 2.0мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 450x120мм, вырубка из рулона 08пс 2.0мм. Для основания усилителя порога.",
  },
  {
    id: "blank-400x50-08ps-2",
    name: "Заготовка 400x50мм, 08пс 2.0мм",
    type: "blank",
    unit: "pcs",
    description: "Полоса 400x50мм, вырубка из рулона 08пс 2.0мм. Для продольного ребра жёсткости.",
  },
  {
    id: "blank-70x50-08ps-2",
    name: "Заготовка 70x50мм, 08пс 2.0мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 70x50мм, вырубка из рулона 08пс 2.0мм. Для поперечных рёбер жёсткости.",
  },
  {
    id: "blank-60x40-08ps-2",
    name: "Заготовка 60x40мм, 08пс 2.0мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 60x40мм, вырубка из рулона 08пс 2.0мм. Для монтажных пластин.",
  },
  // Подвеска
  {
    id: "blank-d180-09g2s-3",
    name: "Заготовка D180мм, 09Г2С 3.0мм",
    type: "blank",
    unit: "pcs",
    description: "Круглая заготовка D180мм, вырубка из листа 09Г2С 3.0мм. Для вытяжки чашки пружины.",
  },
  {
    id: "blank-d160-10-3",
    name: "Заготовка D160мм, 09Г2С 3.0мм",
    type: "blank",
    unit: "pcs",
    description: "Круглая заготовка D160мм. Для нижней чашки пружины с дренажным отверстием.",
  },
  // Тормоза
  {
    id: "blank-d340-08kp-1",
    name: "Заготовка D340мм, 08кп 1.0мм",
    type: "blank",
    unit: "pcs",
    description: "Круглая заготовка D340мм, вырубка из рулона 08кп 1.0мм. Для тормозного щита.",
  },
  // Кронштейны
  {
    id: "blank-180x120-09g2s-4",
    name: "Заготовка 180x120мм, 09Г2С 4.0мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 180x120мм, вырубка из листа 09Г2С 4.0мм. Для основания кронштейна двигателя.",
  },
  {
    id: "blank-100x80-09g2s-3",
    name: "Заготовка 100x80мм, 09Г2С 3.0мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 100x80мм. Для ребра жёсткости кронштейна.",
  },
  // Защитные кожухи
  {
    id: "blank-550x450-08ps-1.2",
    name: "Заготовка 550x450мм, 08пс 1.2мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка 550x450мм, вырубка из рулона 08пс 1.2мм. Для нижней панели кожуха бака.",
  },
  {
    id: "blank-400x200-amg2-0.8",
    name: "Заготовка 400x200мм, АМг2 0.8мм",
    type: "blank",
    unit: "pcs",
    description: "Карточка из алюминия 400x200мм. Для теплозащитного экрана.",
  },
];

// ============================================================
// ИЗДЕЛИЯ (готовая продукция)
// ============================================================
const products: NomenclatureItem[] = [
  {
    id: "prod-up100",
    name: "Усилитель порога УП-100",
    type: "product",
    unit: "pcs",
    category: "body",
    description: "Усилитель порога кузова. Холодная штамповка, сталь 08пс 2мм, оцинковка. Состоит из сварного соединителя, 4 поперечных рёбер и 2 монтажных пластин.",
    images: [img("body-cat.jpg"), img("body-reinforcement.jpg")],
  },
  {
    id: "prod-pp200",
    name: "Поперечина пола ПП-200",
    type: "product",
    unit: "pcs",
    category: "body",
    description: "Поперечина пола кузова. Холодная штамповка, сталь 08кп 1.5мм. Балка швеллерного профиля с косынками и опорными пластинами.",
    images: [img("body-crossmember.jpg"), img("part-cross.jpg")],
  },
  {
    id: "prod-ak300",
    name: "Арка колеса задняя АК-300",
    type: "product",
    unit: "pcs",
    category: "body",
    description: "Внутренняя арка заднего колеса. Холодная штамповка, сталь 08пс 1.2мм. Наружная панель с усилителем и соединительными пластинами.",
    images: [img("body-wheel-arch.jpg")],
  },
  {
    id: "prod-cp100",
    name: "Чашка пружины передняя ЧП-100",
    type: "product",
    unit: "pcs",
    category: "suspension",
    description: "Опорная чашка передней пружины. Холодная вытяжка, сталь 09Г2С 3мм. Сварной узел чашек с опорным кольцом и усилительной шайбой.",
    images: [img("suspension-cat.jpg"), img("part-cup.jpg")],
  },
  {
    id: "prod-ks200",
    name: "Кронштейн стабилизатора КС-200",
    type: "product",
    unit: "pcs",
    category: "suspension",
    description: "Кронштейн крепления стабилизатора поперечной устойчивости. Сталь 09Г2С 3мм. U-скоба с основанием и прижимной пластиной.",
    images: [img("suspension-stabilizer.jpg"), img("brackets-cat.jpg")],
  },
  {
    id: "prod-op300",
    name: "Опорная пластина подвески ОП-300",
    type: "product",
    unit: "pcs",
    category: "suspension",
    description: "Опорная пластина нижнего рычага. Холодная штамповка, сталь 09Г2С 4мм.",
    images: [img("suspension-plate.jpg")],
  },
  {
    id: "prod-ts100",
    name: "Тормозной щит передний ТЩ-100",
    type: "product",
    unit: "pcs",
    category: "brakes",
    description: "Пылезащитный щит переднего тормоза. Холодная штамповка, сталь 08кп 1мм. Основной диск с кожухом и кронштейном шланга.",
    images: [img("brake-cat.jpg"), img("part-dust-cover.jpg")],
  },
  {
    id: "prod-pk200",
    name: "Пластина колодочная ПК-200",
    type: "product",
    unit: "pcs",
    category: "brakes",
    description: "Противоскрипная пластина тормозных колодок. Комплект: направляющая + скоба + фиксатор. Пружинная сталь 65Г.",
    images: [img("brake-backing.jpg"), img("brake-shim.jpg")],
  },
  {
    id: "prod-ksu300",
    name: "Кронштейн суппорта КСУ-300",
    type: "product",
    unit: "pcs",
    category: "brakes",
    description: "Кронштейн крепления суппорта. Холодная штамповка, сталь 09Г2С 5мм.",
    images: [img("brackets-cat.jpg")],
  },
  {
    id: "prod-kd100",
    name: "Кронштейн двигателя КД-100",
    type: "product",
    unit: "pcs",
    category: "brackets",
    description: "Кронштейн опоры двигателя. Сварной узел рамы с чашкой опоры и монтажной площадкой. Сталь 09Г2С 4мм.",
    images: [img("brackets-cat.jpg"), img("part-flat-bracket.jpg")],
  },
  {
    id: "prod-hv200",
    name: "Хомут выхлопной системы ХВ-200",
    type: "product",
    unit: "pcs",
    category: "brackets",
    description: "Хомут крепления выхлопной трубы. Нержавейка 12Х18Н10Т 2мм. Два полухомута со стяжной пластиной.",
    images: [img("brackets-exhaust.jpg"), img("part-clamp.jpg")],
  },
  {
    id: "prod-st300",
    name: "Скоба топливопровода СТ-300",
    type: "product",
    unit: "pcs",
    category: "brackets",
    description: "Скоба крепления топливной трубки. Оцинкованная сталь 1мм. Скоба с демпферной прокладкой.",
    images: [img("brackets-fuelclip.jpg")],
  },
  {
    id: "prod-kb100",
    name: "Кожух бака защитный КБ-100",
    type: "product",
    unit: "pcs",
    category: "shields",
    description: "Защитный кожух топливного бака. Сварной короб с поперечинами жёсткости. Сталь 08пс 1.2мм.",
    images: [img("shields-cat.jpg"), img("shields-underbody.jpg")],
  },
  {
    id: "prod-te200",
    name: "Теплозащитный экран ТЭ-200",
    type: "product",
    unit: "pcs",
    category: "shields",
    description: "Теплозащитный экран выхлопной системы. Алюминий АМг2 0.8мм с перфорацией. Экран с кронштейнами и виброизоляторами.",
    images: [img("shields-exhaust.jpg")],
  },
  {
    id: "prod-kd300",
    name: "Кожух днища КД-300",
    type: "product",
    unit: "pcs",
    category: "shields",
    description: "Защита днища кузова. Сталь 08пс 1мм, оцинковка. Панель с усилителями кромки и монтажными лепестками.",
    images: [img("shields-underbody.jpg"), img("shields-cat.jpg")],
  },
];

// ============================================================
// BOM (Bill of Materials) — спецификации
// ============================================================
export const bom: BomEntry[] = [
  // === ЗАГОТОВКИ ← СЫРЬЁ (кг на 1 заготовку) ===
  { parentId: "blank-450x120-08ps-2", childId: "raw-08ps-2.0", quantity: 0.85 },
  { parentId: "blank-400x50-08ps-2", childId: "raw-08ps-2.0", quantity: 0.32 },
  { parentId: "blank-70x50-08ps-2", childId: "raw-08ps-2.0", quantity: 0.055 },
  { parentId: "blank-60x40-08ps-2", childId: "raw-08ps-2.0", quantity: 0.038 },
  { parentId: "blank-d180-09g2s-3", childId: "raw-09g2s-3.0", quantity: 0.60 },
  { parentId: "blank-d160-09g2s-3", childId: "raw-09g2s-3.0", quantity: 0.48 },
  { parentId: "blank-d340-08kp-1", childId: "raw-08kp-1.0", quantity: 0.71 },
  { parentId: "blank-180x120-09g2s-4", childId: "raw-09g2s-4.0", quantity: 0.68 },
  { parentId: "blank-100x80-09g2s-3", childId: "raw-09g2s-3.0", quantity: 0.19 },
  { parentId: "blank-550x450-08ps-1.2", childId: "raw-08ps-1.2", quantity: 2.33 },
  { parentId: "blank-400x200-amg2-0.8", childId: "raw-amg2-0.8", quantity: 0.17 },

  // === ИЗДЕЛИЯ ← ЗАГОТОВКИ + СЫРЬЁ (метизы) ===

  // Усилитель порога УП-100
  { parentId: "prod-up100", childId: "raw-rivets-4.8", quantity: 8 },

  // Кронштейн стабилизатора КС-200
  { parentId: "prod-ks200", childId: "raw-bolts-m8", quantity: 2 },
  { parentId: "prod-ks200", childId: "raw-nuts-m8", quantity: 2 },
  { parentId: "prod-ks200", childId: "raw-washers-m8", quantity: 2 },

  // Опорная пластина подвески ОП-300
  { parentId: "prod-op300", childId: "raw-bolts-m8", quantity: 2 },
  { parentId: "prod-op300", childId: "raw-nuts-m8", quantity: 2 },

  // Тормозной щит ТЩ-100
  { parentId: "prod-ts100", childId: "raw-rivets-4.8", quantity: 4 },

  // Кронштейн суппорта КСУ-300
  { parentId: "prod-ksu300", childId: "raw-bolts-m8", quantity: 2 },
  { parentId: "prod-ksu300", childId: "raw-washers-m8", quantity: 2 },

  // Кронштейн двигателя КД-100
  { parentId: "prod-kd100", childId: "raw-bolts-m8", quantity: 4 },
  { parentId: "prod-kd100", childId: "raw-nuts-m8", quantity: 4 },
  { parentId: "prod-kd100", childId: "raw-washers-m8", quantity: 4 },

  // Хомут выхлопной ХВ-200
  { parentId: "prod-hv200", childId: "raw-bolts-m8", quantity: 2 },
  { parentId: "prod-hv200", childId: "raw-nuts-m8", quantity: 2 },

  // Кожух бака КБ-100
  { parentId: "prod-kb100", childId: "raw-bolts-m8", quantity: 6 },
  { parentId: "prod-kb100", childId: "raw-washers-m8", quantity: 6 },

  // Теплозащитный экран ТЭ-200
  { parentId: "prod-te200", childId: "raw-rivets-4.8", quantity: 6 },

  // Кожух днища КД-300
  { parentId: "prod-kd300", childId: "raw-rivets-4.8", quantity: 12 },
];

// ============================================================
// Общий справочник
// ============================================================
export const allItems: NomenclatureItem[] = [
  ...materials,
  ...blanks,
  ...products,
];

