export interface Part {
  id: string;
  name: string;
  description: string;
  images: string[];
  pricePerUnit: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  parts: Part[];
}

export interface Category {
  id: string;
  name: string;
  image: string;
  products: Product[];
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const img = (name: string) => `${basePath}/images/catalog/${name}`;

export const categories: Category[] = [
  {
    id: "body",
    name: "Кузовные элементы",
    image: img("body-cat.jpg"),
    products: [
      {
        id: "up-100",
        name: "Усилитель порога УП-100",
        description: "Усилитель порога кузова. Холодная штамповка, сталь 08пс 2мм, оцинковка.",
        images: [img("body-cat.jpg"), img("body-reinforcement.jpg")],
        parts: [
          {
            id: "up-100-p1",
            name: "Основание усилителя",
            description: "Штампованная пластина 450x80x2мм с рёбрами жёсткости",
            images: [img("part-flat-bracket.jpg"), img("part-mounting-plate.jpg")],
            pricePerUnit: 65,
          },
          {
            id: "up-100-p2",
            name: "Ребро жёсткости продольное",
            description: "Продольное ребро 400x30x2мм, П-образный профиль",
            images: [img("part-rib.jpg")],
            pricePerUnit: 35,
          },
          {
            id: "up-100-p3",
            name: "Ребро жёсткости поперечное",
            description: "Поперечное ребро 70x30x2мм, 4 шт в комплекте",
            images: [img("part-strip.jpg")],
            pricePerUnit: 12,
          },
          {
            id: "up-100-p4",
            name: "Монтажная пластина",
            description: "Пластина крепления 60x40x2мм с 4 отверстиями",
            images: [img("part-mounting-plate.jpg")],
            pricePerUnit: 18,
          },
        ],
      },
      {
        id: "pp-200",
        name: "Поперечина пола ПП-200",
        description: "Поперечина пола кузова. Холодная штамповка, сталь 08кп 1.5мм.",
        images: [img("body-crossmember.jpg"), img("part-cross.jpg")],
        parts: [
          {
            id: "pp-200-p1",
            name: "Балка поперечины",
            description: "Штампованная балка 800x60x40мм, швеллерный профиль",
            images: [img("body-crossmember.jpg"), img("part-cross.jpg")],
            pricePerUnit: 95,
          },
          {
            id: "pp-200-p2",
            name: "Косынка левая",
            description: "Угловая косынка 80x80x1.5мм с отверстиями",
            images: [img("part-gusset.jpg")],
            pricePerUnit: 22,
          },
          {
            id: "pp-200-p3",
            name: "Косынка правая",
            description: "Угловая косынка 80x80x1.5мм, зеркальная",
            images: [img("part-gusset.jpg")],
            pricePerUnit: 22,
          },
          {
            id: "pp-200-p4",
            name: "Опорная пластина",
            description: "Пластина 100x60x2мм для крепления к лонжерону",
            images: [img("part-mounting-plate.jpg")],
            pricePerUnit: 28,
          },
        ],
      },
      {
        id: "ak-300",
        name: "Арка колеса задняя АК-300",
        description: "Внутренняя арка заднего колеса. Холодная штамповка, сталь 08пс 1.2мм.",
        images: [img("body-wheel-arch.jpg")],
        parts: [
          {
            id: "ak-300-p1",
            name: "Наружная панель арки",
            description: "Штампованная панель сложной формы 600x400x1.2мм",
            images: [img("body-wheel-arch.jpg"), img("part-side-panel.jpg")],
            pricePerUnit: 120,
          },
          {
            id: "ak-300-p2",
            name: "Внутренний усилитель",
            description: "Усилитель арки 500x80x1.5мм с рёбрами",
            images: [img("part-rib.jpg")],
            pricePerUnit: 55,
          },
          {
            id: "ak-300-p3",
            name: "Соединительная пластина",
            description: "Пластина стыка 120x60x1.2мм",
            images: [img("part-flat-bracket.jpg")],
            pricePerUnit: 15,
          },
        ],
      },
    ],
  },
  {
    id: "suspension",
    name: "Элементы подвески",
    image: img("suspension-cat.jpg"),
    products: [
      {
        id: "cp-100",
        name: "Чашка пружины передняя ЧП-100",
        description: "Опорная чашка передней пружины. Холодная вытяжка, сталь 10 3мм.",
        images: [img("suspension-cat.jpg"), img("part-cup.jpg")],
        parts: [
          {
            id: "cp-100-p1",
            name: "Чашка верхняя",
            description: "Штампованная чашка D140xH25x3мм",
            images: [img("part-cup.jpg")],
            pricePerUnit: 75,
          },
          {
            id: "cp-100-p2",
            name: "Чашка нижняя",
            description: "Штампованная чашка D150xH20x3мм с дренажным отверстием",
            images: [img("part-cup.jpg"), img("suspension-cat.jpg")],
            pricePerUnit: 80,
          },
          {
            id: "cp-100-p3",
            name: "Опорное кольцо",
            description: "Штампованное кольцо D140xD100x2мм",
            images: [img("part-ring.jpg")],
            pricePerUnit: 30,
          },
          {
            id: "cp-100-p4",
            name: "Усилительная шайба",
            description: "Шайба D60x4мм с центровочным выступом",
            images: [img("part-washer.jpg")],
            pricePerUnit: 15,
          },
        ],
      },
      {
        id: "ks-200",
        name: "Кронштейн стабилизатора КС-200",
        description: "Кронштейн крепления стабилизатора поперечной устойчивости. Сталь 09Г2С 3мм.",
        images: [img("suspension-stabilizer.jpg"), img("brackets-cat.jpg")],
        parts: [
          {
            id: "ks-200-p1",
            name: "Скоба стабилизатора",
            description: "U-образная скоба 60x45x3мм под D22 стабилизатор",
            images: [img("part-clamp.jpg")],
            pricePerUnit: 40,
          },
          {
            id: "ks-200-p2",
            name: "Основание кронштейна",
            description: "Пластина 80x60x3мм с двумя крепёжными отверстиями",
            images: [img("suspension-plate.jpg")],
            pricePerUnit: 35,
          },
          {
            id: "ks-200-p3",
            name: "Прижимная пластина",
            description: "Пластина 60x40x2мм, ответная часть скобы",
            images: [img("part-flat-bracket.jpg")],
            pricePerUnit: 20,
          },
        ],
      },
      {
        id: "op-300",
        name: "Опорная пластина подвески ОП-300",
        description: "Опорная пластина нижнего рычага. Холодная штамповка, сталь 09Г2С 4мм.",
        images: [img("suspension-plate.jpg")],
        parts: [
          {
            id: "op-300-p1",
            name: "Пластина опорная",
            description: "Штампованная пластина 120x100x4мм с рельефом жёсткости",
            images: [img("suspension-plate.jpg"), img("part-mounting-plate.jpg")],
            pricePerUnit: 55,
          },
          {
            id: "op-300-p2",
            name: "Упорная шайба",
            description: "Шайба D50x3мм со стопорным выступом",
            images: [img("part-washer.jpg")],
            pricePerUnit: 12,
          },
          {
            id: "op-300-p3",
            name: "Пластина крепления",
            description: "Монтажная пластина 80x50x3мм",
            images: [img("part-mounting-plate.jpg")],
            pricePerUnit: 25,
          },
        ],
      },
    ],
  },
  {
    id: "brakes",
    name: "Тормозная система",
    image: img("brake-cat.jpg"),
    products: [
      {
        id: "ts-100",
        name: "Тормозной щит передний ТЩ-100",
        description: "Пылезащитный щит переднего тормоза. Холодная штамповка, сталь 08кп 1мм.",
        images: [img("brake-cat.jpg"), img("part-dust-cover.jpg")],
        parts: [
          {
            id: "ts-100-p1",
            name: "Щит основной",
            description: "Штампованный диск D300x1мм с вырезами",
            images: [img("brake-cat.jpg"), img("part-dust-cover.jpg")],
            pricePerUnit: 85,
          },
          {
            id: "ts-100-p2",
            name: "Кожух пылезащитный",
            description: "Полукольцо D280x50x0.8мм",
            images: [img("part-cover.jpg")],
            pricePerUnit: 45,
          },
          {
            id: "ts-100-p3",
            name: "Кронштейн шланга",
            description: "Кронштейн крепления тормозного шланга 40x20x1.5мм",
            images: [img("part-strip.jpg")],
            pricePerUnit: 10,
          },
        ],
      },
      {
        id: "pk-200",
        name: "Пластина колодочная ПК-200",
        description: "Противоскрипная пластина тормозных колодок. Сталь 65Г 0.5мм.",
        images: [img("brake-backing.jpg"), img("brake-shim.jpg")],
        parts: [
          {
            id: "pk-200-p1",
            name: "Пластина направляющая",
            description: "Штампованная пластина 80x50x0.5мм",
            images: [img("brake-shim.jpg")],
            pricePerUnit: 18,
          },
          {
            id: "pk-200-p2",
            name: "Пружинная скоба",
            description: "Скоба фиксации 40x15x0.8мм, пружинная сталь",
            images: [img("part-strip.jpg")],
            pricePerUnit: 12,
          },
          {
            id: "pk-200-p3",
            name: "Фиксатор",
            description: "Штампованный фиксатор 20x10x0.5мм",
            images: [img("brake-backing.jpg")],
            pricePerUnit: 8,
          },
        ],
      },
      {
        id: "ksu-300",
        name: "Кронштейн суппорта КСУ-300",
        description: "Кронштейн крепления суппорта. Холодная штамповка, сталь 09Г2С 5мм.",
        images: [img("brackets-cat.jpg")],
        parts: [
          {
            id: "ksu-300-p1",
            name: "Корпус кронштейна",
            description: "Штампованный кронштейн 120x80x5мм с направляющими",
            images: [img("brackets-cat.jpg"), img("part-flat-bracket.jpg")],
            pricePerUnit: 95,
          },
          {
            id: "ksu-300-p2",
            name: "Упорная пластина",
            description: "Пластина 60x40x3мм",
            images: [img("part-mounting-plate.jpg")],
            pricePerUnit: 25,
          },
        ],
      },
    ],
  },
  {
    id: "brackets",
    name: "Кронштейны и крепёж",
    image: img("brackets-cat.jpg"),
    products: [
      {
        id: "kd-100",
        name: "Кронштейн двигателя КД-100",
        description: "Кронштейн опоры двигателя. Холодная штамповка, сталь 09Г2С 4мм.",
        images: [img("brackets-cat.jpg"), img("part-flat-bracket.jpg")],
        parts: [
          {
            id: "kd-100-p1",
            name: "Основание кронштейна",
            description: "Штампованная пластина 150x100x4мм с рельефом",
            images: [img("part-flat-bracket.jpg")],
            pricePerUnit: 75,
          },
          {
            id: "kd-100-p2",
            name: "Ребро жёсткости",
            description: "Треугольное ребро 80x60x3мм",
            images: [img("part-gusset.jpg")],
            pricePerUnit: 30,
          },
          {
            id: "kd-100-p3",
            name: "Подушка опоры",
            description: "Штампованная чашка D60xH15x3мм под резиновый демпфер",
            images: [img("part-cup.jpg")],
            pricePerUnit: 35,
          },
          {
            id: "kd-100-p4",
            name: "Монтажная площадка",
            description: "Пластина 80x60x4мм с 4 отверстиями M10",
            images: [img("part-mounting-plate.jpg")],
            pricePerUnit: 28,
          },
        ],
      },
      {
        id: "hv-200",
        name: "Хомут выхлопной системы ХВ-200",
        description: "Хомут крепления выхлопной трубы. Холодная штамповка, сталь 12Х18Н10Т 2мм.",
        images: [img("brackets-exhaust.jpg"), img("part-clamp.jpg")],
        parts: [
          {
            id: "hv-200-p1",
            name: "Полухомут верхний",
            description: "Штампованный полухомут D55x2мм",
            images: [img("part-clamp.jpg")],
            pricePerUnit: 30,
          },
          {
            id: "hv-200-p2",
            name: "Полухомут нижний",
            description: "Штампованный полухомут D55x2мм с опорной лапой",
            images: [img("part-clamp.jpg"), img("brackets-exhaust.jpg")],
            pricePerUnit: 35,
          },
          {
            id: "hv-200-p3",
            name: "Стяжная пластина",
            description: "Пластина 40x20x2мм с прорезью",
            images: [img("part-strip.jpg")],
            pricePerUnit: 10,
          },
        ],
      },
      {
        id: "st-300",
        name: "Скоба топливопровода СТ-300",
        description: "Скоба крепления топливной трубки. Холодная штамповка, сталь оцинк. 1мм.",
        images: [img("brackets-fuelclip.jpg")],
        parts: [
          {
            id: "st-300-p1",
            name: "Скоба",
            description: "Штампованная скоба 30x15x1мм под трубку D8",
            images: [img("brackets-fuelclip.jpg")],
            pricePerUnit: 8,
          },
          {
            id: "st-300-p2",
            name: "Демпферная прокладка",
            description: "Штампованная прокладка 25x12x0.5мм",
            images: [img("part-damper.jpg")],
            pricePerUnit: 5,
          },
        ],
      },
    ],
  },
  {
    id: "shields",
    name: "Защитные кожухи",
    image: img("shields-cat.jpg"),
    products: [
      {
        id: "kb-100",
        name: "Кожух бака защитный КБ-100",
        description: "Защитный кожух топливного бака. Холодная штамповка, сталь 08пс 1.2мм.",
        images: [img("shields-cat.jpg"), img("shields-underbody.jpg")],
        parts: [
          {
            id: "kb-100-p1",
            name: "Панель нижняя",
            description: "Штампованная панель 500x400x1.2мм с рельефом жёсткости",
            images: [img("shields-underbody.jpg")],
            pricePerUnit: 110,
          },
          {
            id: "kb-100-p2",
            name: "Панель боковая левая",
            description: "Боковая панель 400x100x1.2мм с отбортовкой",
            images: [img("part-side-panel.jpg")],
            pricePerUnit: 55,
          },
          {
            id: "kb-100-p3",
            name: "Панель боковая правая",
            description: "Боковая панель 400x100x1.2мм, зеркальная",
            images: [img("part-side-panel.jpg")],
            pricePerUnit: 55,
          },
          {
            id: "kb-100-p4",
            name: "Поперечина жёсткости",
            description: "Штампованная поперечина 380x30x1.5мм",
            images: [img("part-cross.jpg")],
            pricePerUnit: 25,
          },
        ],
      },
      {
        id: "te-200",
        name: "Теплозащитный экран ТЭ-200",
        description: "Теплозащитный экран выхлопной системы. Алюминий 0.8мм с перфорацией.",
        images: [img("shields-exhaust.jpg")],
        parts: [
          {
            id: "te-200-p1",
            name: "Экран основной",
            description: "Штампованный экран 350x200x0.8мм с перфорацией",
            images: [img("shields-exhaust.jpg")],
            pricePerUnit: 70,
          },
          {
            id: "te-200-p2",
            name: "Кронштейн крепления экрана",
            description: "Г-образный кронштейн 40x25x1мм",
            images: [img("part-strip.jpg")],
            pricePerUnit: 10,
          },
          {
            id: "te-200-p3",
            name: "Виброизолятор",
            description: "Штампованная шайба D20x0.5мм с лепестками",
            images: [img("part-damper.jpg")],
            pricePerUnit: 6,
          },
        ],
      },
      {
        id: "kd-300",
        name: "Кожух днища КД-300",
        description: "Защита днища кузова. Холодная штамповка, сталь 08пс 1мм, оцинковка.",
        images: [img("shields-underbody.jpg"), img("shields-cat.jpg")],
        parts: [
          {
            id: "kd-300-p1",
            name: "Панель защитная",
            description: "Штампованная панель 600x500x1мм с рёбрами",
            images: [img("shields-underbody.jpg")],
            pricePerUnit: 115,
          },
          {
            id: "kd-300-p2",
            name: "Усилитель кромки",
            description: "Штампованный профиль 550x20x1.2мм",
            images: [img("part-rib.jpg")],
            pricePerUnit: 30,
          },
          {
            id: "kd-300-p3",
            name: "Монтажный лепесток",
            description: "Пластина 30x20x1мм с отверстием, 6 шт в комплекте",
            images: [img("part-strip.jpg")],
            pricePerUnit: 5,
          },
        ],
      },
    ],
  },
  {
    id: "products",
    name: "Изделия",
    image: img("body-cat.jpg"),
    products: [
      {
        id: "product-1",
        name: "Изделие 1",
        description: "Изделие 1 — парное (левое/правое). Выберите сторону и укажите количество.",
        images: [img("body-cat.jpg")],
        parts: [
          {
            id: "59c51dfb-b45f-429a-bf8f-fb5048d7377f",
            name: "Изделие 1 левое",
            description: "Изделие 1, левая сторона",
            images: [img("body-cat.jpg")],
            pricePerUnit: 0,
          },
          {
            id: "a51a4918-1391-4c68-9b7e-39d0768433ee",
            name: "Изделие 1 правое",
            description: "Изделие 1, правая сторона",
            images: [img("body-cat.jpg")],
            pricePerUnit: 0,
          },
        ],
      },
    ],
  },
];

export const workers = [
  { id: "w1", name: "Иванов А.С.", pin: "1234" },
  { id: "w2", name: "Петров В.И.", pin: "5678" },
  { id: "w3", name: "Сидоров К.М.", pin: "9012" },
  { id: "w4", name: "Козлов Д.А.", pin: "3456" },
  { id: "w5", name: "Морозов Е.В.", pin: "7890" },
];
