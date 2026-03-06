import { NextResponse } from "next/server";
import { getUsers, createUser, updateUser, deleteUser, getRoles } from "@/services/user.service";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("roles") === "true") {
    const roles = await getRoles();
    return NextResponse.json(roles);
  }

  const users = await getUsers();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, roleId } = body;

    if (!email || !password || !name || !roleId) {
      return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
    }

    const user = await createUser({ email, password, name, roleId });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    const user = await updateUser(id, data);
    return NextResponse.json(user);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
