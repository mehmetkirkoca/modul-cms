import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../client.js';
import { users, type User } from '../../../db/schema.js';
import { ConflictError, NotFoundError } from '../../errors/index.js';

export type PublicUser = Omit<User, 'password'>;

export type CreateUserInput = {
  email: string;
  name: string;
  password: string;
  role?: string;
};

export type UpdateUserInput = Partial<{
  name: string;
  email: string;
  role: string;
  password: string;
}>;

export function toPublic(user: User): PublicUser {
  const { password: _, ...rest } = user;
  return rest;
}

export const userRepository = {
  async findById(id: string): Promise<PublicUser> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundError('User', id);
    return toPublic(user);
  },

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  },

  async list(params: { page?: number; perPage?: number; role?: string } = {}) {
    const { page = 1, perPage = 20, role } = params;
    const offset = (page - 1) * perPage;

    const query = db.select().from(users);
    const countQuery = db.select({ count: count() }).from(users);

    if (role) {
      query.where(eq(users.role, role));
      countQuery.where(eq(users.role, role));
    }

    const [rows, [{ count: total }]] = await Promise.all([
      query.limit(perPage).offset(offset),
      countQuery,
    ]);

    return { users: rows.map(toPublic), total: Number(total) };
  },

  async create(input: CreateUserInput): Promise<PublicUser> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError(`Email already in use: ${input.email}`);

    const hashed = await bcrypt.hash(input.password, 12);
    const [user] = await db.insert(users).values({
      email:    input.email,
      name:     input.name,
      password: hashed,
      role:     input.role ?? 'subscriber',
    }).returning();

    return toPublic(user!);
  },

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!current) throw new NotFoundError('User', id);

    if (input.email && input.email !== current.email) {
      const taken = await userRepository.findByEmail(input.email);
      if (taken) throw new ConflictError(`Email already in use: ${input.email}`);
    }

    const data: Partial<User> = {
      ...(input.name  ? { name: input.name }   : {}),
      ...(input.email ? { email: input.email }  : {}),
      ...(input.role  ? { role: input.role }    : {}),
      updatedAt: new Date(),
    };
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }

    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return toPublic(updated!);
  },

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  },
};
