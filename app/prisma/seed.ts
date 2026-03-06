import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const connectionString = process.env["GORCHEV_DATABASE_URL"] || process.env["DATABASE_URL"] || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Базовые справочники — создаются всегда
const itemTypes = [
  { id: "material", name: "Сырьё", order: 1, color: "amber" },
  { id: "blank", name: "Заготовка", order: 2, color: "orange" },
  { id: "product", name: "Изделие", order: 3, color: "emerald" },
];

const units = [
  { id: "kg", name: "кг" },
  { id: "pcs", name: "шт" },
  { id: "m", name: "м" },
];

const categoriesList = [
  { id: "body", name: "Кузовные элементы" },
  { id: "suspension", name: "Элементы подвески" },
  { id: "brakes", name: "Тормозная система" },
  { id: "brackets", name: "Кронштейны и крепёж" },
  { id: "shields", name: "Защитные кожухи" },
];

const roles = [
  { id: "admin", name: "Администратор" },
  { id: "director", name: "Директор" },
  { id: "warehouse", name: "Кладовщик" },
];

const defaultAppConfig = [
  { key: "companyName", value: "Производство", description: "Название компании" },
  { key: "companyLogo", value: "", description: "URL логотипа компании" },
];

const processGroups = [
  { id: "stamping", name: "Штамповка / Прессовые", order: 1 },
  { id: "welding", name: "Сварка", order: 2 },
  { id: "finishing", name: "Финишные", order: 3 },
];

const processes = [
  { id: "cutting", name: "Порезка", groupId: "stamping", order: 1 },
  { id: "blanking", name: "Вырубка", groupId: "stamping", order: 2 },
  { id: "drawing", name: "Вытяжка", groupId: "stamping", order: 3 },
  { id: "trimming", name: "Обрезка", groupId: "stamping", order: 4 },
  { id: "punching", name: "Пробивка", groupId: "stamping", order: 5 },
  { id: "flaring", name: "Развальцовка", groupId: "stamping", order: 6 },
  { id: "coining", name: "Чеканка", groupId: "stamping", order: 7 },
  { id: "bending", name: "Гибка", groupId: "stamping", order: 8 },
  { id: "welding-general", name: "Сварка", groupId: "welding", order: 1 },
  { id: "welding-mig", name: "Сварка полуавтомат", groupId: "welding", order: 2 },
  { id: "welding-mks", name: "Сварка МКС", groupId: "welding", order: 3 },
  { id: "welding-laser", name: "Сварка лазером", groupId: "welding", order: 4 },
  { id: "rework", name: "Доработка", groupId: "finishing", order: 1 },
  { id: "coating", name: "Покрытие", groupId: "finishing", order: 2 },
  { id: "packaging", name: "Упаковка", groupId: "finishing", order: 3 },
];

async function seedBase() {
  console.log("=== Базовые справочники ===");

  console.log("Создание типов...");
  for (const t of itemTypes) {
    await prisma.itemType.upsert({ where: { id: t.id }, update: t, create: t });
  }

  console.log("Создание единиц измерения...");
  for (const u of units) {
    await prisma.unit.upsert({ where: { id: u.id }, update: u, create: u });
  }

  console.log("Создание категорий...");
  for (const c of categoriesList) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }

  console.log("Создание ролей...");
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, update: r, create: r });
  }

  console.log("Создание конфигурации...");
  for (const c of defaultAppConfig) {
    await prisma.appConfig.upsert({ where: { key: c.key }, update: {}, create: c });
  }

  // Admin user (email/password из env или дефолтные)
  const adminEmail = process.env["ADMIN_EMAIL"] || "admin@gorchev.local";
  const adminPassword = process.env["ADMIN_PASSWORD"] || "admin123";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: hash, name: "Администратор", roleId: "admin" },
    });
    console.log(`Admin user создан: ${adminEmail}`);
  }

  console.log("Создание производственных процессов...");
  for (const g of processGroups) {
    await prisma.processGroup.upsert({ where: { id: g.id }, update: g, create: g });
  }
  for (const p of processes) {
    await prisma.process.upsert({ where: { id: p.id }, update: p, create: p });
  }

  console.log("Базовые справочники готовы.");
}

async function seedDemo() {
  console.log("\n=== Демо-данные (клиент Горчёв) ===");

  // Динамический импорт данных из data/
  const { allItems, bom } = await import("../src/data/nomenclature.js");

  console.log("Очистка клиентских данных...");
  await prisma.productionLog.deleteMany();
  await prisma.productionOrderItem.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany({ where: { roleId: { not: "admin" } } });
  await prisma.bomEntry.deleteMany();
  await prisma.item.deleteMany();

  console.log(`Создание ${allItems.length} позиций...`);
  const codeCounters: Record<string, number> = { material: 0, blank: 0, product: 0 };
  const codePrefixes: Record<string, string> = { material: "MAT", blank: "BLK", product: "PRD" };
  for (const item of allItems) {
    codeCounters[item.type] = (codeCounters[item.type] || 0) + 1;
    const prefix = codePrefixes[item.type] || "ITM";
    const code = `${prefix}-${String(codeCounters[item.type]).padStart(3, "0")}`;
    await prisma.item.create({
      data: {
        id: item.id,
        code,
        name: item.name,
        typeId: item.type,
        unitId: item.unit,
        categoryId: item.category || null,
        description: item.description || null,
        images: item.images || [],
        pricePerUnit: item.pricePerUnit || null,
      },
    });
  }

  console.log(`Создание ${bom.length} связей BOM...`);
  const itemIds = new Set(allItems.map((i: { id: string }) => i.id));
  let bomCreated = 0;
  for (const entry of bom) {
    if (!itemIds.has(entry.parentId) || !itemIds.has(entry.childId)) {
      continue;
    }
    await prisma.bomEntry.create({
      data: { parentId: entry.parentId, childId: entry.childId, quantity: entry.quantity },
    });
    bomCreated++;
  }
  console.log(`  Создано ${bomCreated} связей`);

  console.log("Создание начальных остатков...");
  const demoStock: Record<string, number> = {
    "raw-08ps-2.0": 2500, "raw-08kp-1.5": 1800, "raw-08ps-1.2": 3200,
    "raw-08kp-1.0": 1400, "raw-09g2s-3.0": 950, "raw-09g2s-4.0": 680,
    "raw-09g2s-5.0": 420, "raw-65g-0.5": 85, "raw-amg2-0.8": 180,
    "raw-12x18-2.0": 320, "raw-oцинк-1.0": 560, "raw-rivets-4.8": 15000,
    "raw-bolts-m8": 8000, "raw-nuts-m8": 8000, "raw-washers-m8": 10000,
    "blank-450x120-08ps-2": 340, "blank-400x50-08ps-2": 280,
    "blank-70x50-08ps-2": 1200, "blank-60x40-08ps-2": 600,
    "blank-d180-09g2s-3": 150, "blank-d160-09g2s-3": 150,
    "blank-d340-08kp-1": 90, "blank-180x120-09g2s-4": 110,
    "blank-100x80-09g2s-3": 220, "blank-550x450-08ps-1.2": 45,
    "blank-400x200-amg2-0.8": 80,
    "prod-up100": 45, "prod-pp200": 30, "prod-ak300": 18,
    "prod-cp100": 25, "prod-ks200": 60, "prod-op300": 35,
    "prod-ts100": 20, "prod-pk200": 80, "prod-ksu300": 12,
    "prod-kd100": 10, "prod-hv200": 150, "prod-st300": 1500,
    "prod-kb100": 6, "prod-te200": 15, "prod-kd300": 10,
  };
  let stockCreated = 0;
  for (const [id, qty] of Object.entries(demoStock)) {
    if (!itemIds.has(id)) continue;
    await prisma.stockMovement.create({
      data: { type: "ADJUSTMENT_INCOME", itemId: id, quantity: qty, comment: "Начальные остатки" },
    });
    stockCreated++;
  }
  console.log(`  Создано ${stockCreated} движений`);

  console.log("Создание рабочих и пользователей...");
  const directorHash = await bcrypt.hash("director123", 10);
  const warehouseHash = await bcrypt.hash("warehouse123", 10);

  const directorUser = await prisma.user.create({
    data: { email: "director@gorchev.local", passwordHash: directorHash, name: "Горчев В.А.", roleId: "director" },
  });
  const warehouseUser = await prisma.user.create({
    data: { email: "warehouse@gorchev.local", passwordHash: warehouseHash, name: "Смирнова Н.П.", roleId: "warehouse" },
  });

  const workers = [
    { name: "Горчев В.А.", pin: "0000", role: "DIRECTOR" as const, userId: directorUser.id },
    { name: "Смирнова Н.П.", pin: "1111", role: "WAREHOUSE" as const, userId: warehouseUser.id },
    { name: "Иванов А.С.", pin: "1234", role: "WORKER" as const },
    { name: "Петров В.И.", pin: "5678", role: "WORKER" as const },
    { name: "Сидоров К.М.", pin: "9012", role: "WORKER" as const },
    { name: "Козлов Д.А.", pin: "3456", role: "WORKER" as const },
    { name: "Морозов Е.В.", pin: "7890", role: "WORKER" as const },
  ];
  for (const w of workers) {
    await prisma.worker.create({ data: w });
  }
  console.log(`  Создано ${workers.length} рабочих`);
}

async function main() {
  await seedBase();
  await seedDemo();

  console.log("\nГотово!");
  const counts = {
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    types: await prisma.itemType.count(),
    units: await prisma.unit.count(),
    categories: await prisma.category.count(),
    items: await prisma.item.count(),
    bom: await prisma.bomEntry.count(),
    stock: await prisma.stockMovement.count(),
    workers: await prisma.worker.count(),
    processGroups: await prisma.processGroup.count(),
    processes: await prisma.process.count(),
    config: await prisma.appConfig.count(),
  };
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
