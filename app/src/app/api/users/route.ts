import { NextResponse } from "next/server";
import { getUsers, createUser, updateUser, deleteUser, getRoles } from "@/services/user.service";

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
  const body = await request.json();
  const { email, password, name, roleId } = body;

  if (!email || !password || !name || !roleId) {
    return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
  }

  try {
    const user = await createUser({ email, password, name, roleId });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  try {
    const user = await updateUser(id, data);
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
