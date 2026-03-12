import { ServiceError } from "@/lib/api/handle-route-error";

// --- Types ---

export interface SideValidationError {
  code:
    | "SIDE_MIXED_INPUTS"
    | "SIDE_MIXED_COMPONENTS"
    | "SIDE_INCOMPATIBLE_INPUT"
    | "SIDE_INCOMPATIBLE_COMPONENT"
    | "SIDE_NONE_WITH_LR_CHILDREN";
  entityType: "routingStep" | "bomLine";
  stepNo?: number;
  componentIndex?: number;
  inputIndex?: number;
  path?: string;
  message: string;
}

interface ChildInfo {
  side: string;
  name: string;
  index: number;
}

interface ValidateParams {
  parentSide: string;
  parentName: string;
  children: ChildInfo[];
  entityType: "routingStep" | "bomLine";
  stepNo?: number;
  pathPrefix?: string;
}

// --- Core validator ---

export function validateSideCompatibility(params: ValidateParams): SideValidationError[] {
  const { parentSide, parentName, children, entityType, stepNo, pathPrefix } = params;
  const errors: SideValidationError[] = [];

  const hasLeft = children.some((c) => c.side === "LEFT");
  const hasRight = children.some((c) => c.side === "RIGHT");

  // 1. Смешивание LEFT + RIGHT среди children
  if (hasLeft && hasRight) {
    const code = entityType === "routingStep" ? "SIDE_MIXED_INPUTS" : "SIDE_MIXED_COMPONENTS";
    const message =
      entityType === "routingStep"
        ? `Входы шага ${stepNo} содержат и LEFT, и RIGHT одновременно`
        : "Компоненты состава содержат и LEFT, и RIGHT одновременно";
    errors.push({ code, entityType, stepNo, message });
  }

  // 2. Совместимость каждого child с parent
  for (const child of children) {
    if (child.side === "NONE") continue;

    // parent NONE → children только NONE
    if (parentSide === "NONE") {
      const path = pathPrefix ? `${pathPrefix}[${child.index}]` : undefined;
      errors.push({
        code: "SIDE_NONE_WITH_LR_CHILDREN",
        entityType,
        stepNo,
        ...(entityType === "routingStep" ? { inputIndex: child.index } : { componentIndex: child.index }),
        path,
        message: `Позиция «${parentName}» (NONE) не может содержать компоненты с side ${child.side}`,
      });
      continue;
    }

    // parent LEFT → child LEFT или NONE; parent RIGHT → child RIGHT или NONE
    if (child.side !== parentSide) {
      const path = pathPrefix ? `${pathPrefix}[${child.index}]` : undefined;
      const code =
        entityType === "routingStep" ? "SIDE_INCOMPATIBLE_INPUT" : "SIDE_INCOMPATIBLE_COMPONENT";
      const message =
        entityType === "routingStep"
          ? `Вход «${child.name}» (${child.side}) несовместим с выходом «${parentName}» (${parentSide})`
          : `Компонент «${child.name}» (${child.side}) несовместим с позицией «${parentName}» (${parentSide})`;
      errors.push({
        code,
        entityType,
        stepNo,
        ...(entityType === "routingStep" ? { inputIndex: child.index } : { componentIndex: child.index }),
        path,
        message,
      });
    }
  }

  return errors;
}

// --- Routing wrapper ---

interface RoutingStepData {
  stepNo: number;
  outputItem: { name: string; side: string };
  inputs: { item: { name: string; side: string } }[];
}

export function validateRoutingStepsSide(steps: RoutingStepData[]): void {
  const allErrors: SideValidationError[] = [];

  for (const step of steps) {
    const children: ChildInfo[] = step.inputs.map((inp, i) => ({
      side: inp.item.side ?? "NONE",
      name: inp.item.name,
      index: i,
    }));

    const errors = validateSideCompatibility({
      parentSide: step.outputItem.side ?? "NONE",
      parentName: step.outputItem.name,
      children,
      entityType: "routingStep",
      stepNo: step.stepNo,
      pathPrefix: `steps[${step.stepNo - 1}].inputs`,
    });

    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    throw new ServiceError(
      allErrors.map((e) => e.message).join("; "),
      400,
      allErrors,
    );
  }
}

// --- BOM wrapper ---

interface BomData {
  parentItem: { name: string; side: string };
  components: { name: string; side: string }[];
}

export function validateBomSide(data: BomData): void {
  const children: ChildInfo[] = data.components.map((c, i) => ({
    side: c.side ?? "NONE",
    name: c.name,
    index: i,
  }));

  const errors = validateSideCompatibility({
    parentSide: data.parentItem.side ?? "NONE",
    parentName: data.parentItem.name,
    children,
    entityType: "bomLine",
    pathPrefix: "lines",
  });

  if (errors.length > 0) {
    throw new ServiceError(
      errors.map((e) => e.message).join("; "),
      400,
      errors,
    );
  }
}
