import { pgTable, text, numeric, timestamp, serial } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  upc: text("upc").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  photoUrl: text("photo_url").notNull().default("MISSING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  note: text("note"),
  items: text("items").notNull(), // JSON stringified array
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  submittedAt: timestamp("submitted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
