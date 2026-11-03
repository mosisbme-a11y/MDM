import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materialMasters = pgTable('material_masters', {
  id: serial('id').primaryKey(),
  product: text('product').notNull(),
  material: text('material').notNull().unique(),
  plant: text('plant').notNull(),
  productType: text('product_type').notNull(),
  productGroup: text('product_group').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({}));
